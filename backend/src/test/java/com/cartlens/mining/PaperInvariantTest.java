package com.cartlens.mining;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.MathContext;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.Test;
import com.cartlens.domain.*;
import com.cartlens.mining.ct.*;
import com.cartlens.mining.dwt.*;
import com.cartlens.service.TwuCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Exact integer reference model; never calls OracleMiner or a production WUS calculator. */
class PaperInvariantTest {
    private static final int DENOMINATOR = 2520; // lcm(1..8)
    private static final BigDecimal EPSILON = new BigDecimal("1E-28");
    private record Input(Transaction transaction, int mask, long units) { }

    @Test void exactReferenceAndAllStateInvariantsHoldAcrossFiftySlidesForThirtyTwoSeeds() throws Exception {
        int checkedWindows = 0;
        for (int seed = 0; seed < 32; seed++) {
            var random = new Random(seed);
            int paneSize = 1 + seed % 3, paneCount = 2 + seed % 4;
            int capacity = paneSize * paneCount;
            var threshold = new BigDecimal(List.of("0", "0.1", "0.25", "0.5", "1").get(seed % 5));
            var config = new MiningConfig(paneSize, paneCount, threshold);
            var ct = new FWUDSCTSession(config); var dwt = new FWUDSDWTSession(config);
            var input = new ArrayList<Input>();
            for (int t = 0; t < (paneCount + 50) * paneSize; t++) {
                int available = Math.min(8, 2 + t / 5);
                int mask = 1 + random.nextInt((1 << available) - 1);
                // Force items to retire and reappear as well as random sparse/dense transactions.
                if (t % 13 == 0) mask = 1 << (t % available);
                var items = new ArrayList<TransactionItem>(); long productSum = 0;
                for (int item = 0; item < 8; item++) if ((mask & (1 << item)) != 0) {
                    int quantity = 1 + random.nextInt(4), weight = 1 + random.nextInt(10);
                    productSum += (long) quantity * weight;
                    items.add(new TransactionItem("I" + item, "I" + item, quantity, BigDecimal.valueOf(weight)));
                }
                long units = productSum * (DENOMINATOR / items.size());
                var transaction = new Transaction("S" + seed + "T" + t, items, new TwuCalculator().calculate(items));
                assertRatio(transaction.twu(), units, DENOMINATOR);
                input.add(new Input(transaction, mask, units));
            }
            for (int end = paneSize; end <= input.size(); end += paneSize) {
                var pane = new Pane(end / paneSize, input.subList(end - paneSize, end).stream().map(Input::transaction).toList());
                var left = ct.accept(pane); var right = dwt.accept(pane);
                assertThat(left.isPresent()).isEqualTo(end >= capacity);
                assertThat(right.isPresent()).isEqualTo(end >= capacity);
                if (end < capacity) continue;
                var active = input.subList(end - capacity, end);
                assertResult(left.orElseThrow(), active, threshold);
                assertResult(right.orElseThrow(), active, threshold);
                assertCt(ct.store(), active, end, capacity);
                assertTree(dwt.tree(), active);
                assertThat(left.orElseThrow().windowId()).isEqualTo(1 + (end - capacity) / paneSize);
                assertThat(right.orElseThrow().windowId()).isEqualTo(left.orElseThrow().windowId());
                checkedWindows++;
            }
        }
        assertThat(checkedWindows).isEqualTo(32 * 51);
        Files.createDirectories(Path.of("target/paper-four-level"));
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(Path.of("target/paper-four-level/invariants.json").toFile(),
                Map.of("seeds", 32, "slidesPerSeed", 50, "windowsChecked", checkedWindows,
                        "algorithmResultsChecked", checkedWindows * 2, "maxItems", 8,
                        "reference", "integer TWU units / 2520; exhaustive nonempty subsets; exact threshold cross-multiplication"));
    }

    @Test void circularIntersectionMatchesSetIntersectionForEverySixSlotPairAndCurrentTid() {
        int checked = 0;
        for (int current = 1; current <= 6; current++) {
            var order = new ArrayList<Integer>();
            for (int n = 1; n <= 6; n++) order.add((current + n - 1) % 6 + 1);
            for (int leftMask = 0; leftMask < 64; leftMask++) for (int rightMask = 0; rightMask < 64; rightMask++) {
                var left = subset(order, leftMask); var right = subset(order, rightMask);
                var expected = left.stream().filter(right::contains).toList();
                assertThat(new CTsetIntersection().intersect(left, right, current, 6)).containsExactlyElementsOf(expected);
                checked++;
            }
        }
        assertThat(checked).isEqualTo(24576);
    }

    private static List<Integer> subset(List<Integer> order, int mask) {
        return order.stream().filter(tid -> (mask & (1 << (tid - 1))) != 0).toList();
    }

    private static void assertResult(MiningResult actual, List<Input> active, BigDecimal threshold) {
        int universe = active.stream().mapToInt(Input::mask).reduce(0, (a,b) -> a | b);
        long total = active.stream().mapToLong(Input::units).sum();
        var expected = new HashMap<List<String>, List<Input>>();
        for (int mask = 1; mask < 256; mask++) {
            if ((mask & universe) != mask) continue;
            final int pattern = mask;
            var matches = active.stream().filter(row -> (row.mask() & pattern) == pattern).toList();
            long numerator = matches.stream().mapToLong(Input::units).sum();
            if (BigDecimal.valueOf(numerator).compareTo(threshold.multiply(BigDecimal.valueOf(total))) < 0) continue;
            var items = new ArrayList<String>();
            for (int item = 0; item < 8; item++) if ((mask & (1 << item)) != 0) items.add("I" + item);
            expected.put(items, matches);
        }
        assertThat(actual.patterns()).hasSize(expected.size());
        assertThat(actual.patterns()).extracting(p -> p.pattern().items()).containsExactlyInAnyOrderElementsOf(expected.keySet());
        for (var result : actual.patterns()) {
            var matches = expected.get(result.pattern().items());
            assertRatio(result.wus(), matches.stream().mapToLong(Input::units).sum(), total);
            assertThat(result.support()).isEqualTo(matches.size());
            assertThat(result.transactionIds()).containsExactlyElementsOf(matches.stream().map(row -> row.transaction().id()).toList());
        }
    }

    private static void assertCt(CTsetStore store, List<Input> active, int end, int capacity) {
        var tids = new TreeMap<String, List<Integer>>();
        var weights = new HashMap<Integer, Long>();
        var ids = new ArrayList<String>(); var chronology = new ArrayList<Integer>();
        for (int i = 0; i < active.size(); i++) {
            int tid = (end - capacity + i) % capacity + 1;
            var row = active.get(i); weights.put(tid, row.units()); chronology.add(tid); ids.add(row.transaction().id());
            for (int item = 0; item < 8; item++) if ((row.mask() & (1 << item)) != 0)
                tids.computeIfAbsent("I" + item, ignored -> new ArrayList<>()).add(tid);
        }
        assertThat(store.currentLcTid()).isEqualTo((end - 1) % capacity + 1);
        assertThat(store.oneItemCTsets().keySet()).containsExactlyInAnyOrderElementsOf(tids.keySet());
        tids.forEach((item, expected) -> assertThat(store.oneItemCTsets().get(item).values()).containsExactlyElementsOf(expected));
        assertThat(store.twuByLcTid()).hasSize(capacity);
        weights.forEach((tid, units) -> assertRatio(store.twuByLcTid().get(tid), units, DENOMINATOR));
        assertThat(store.transactionIdsFor(chronology)).containsExactlyElementsOf(ids);
        assertRatio(store.sumTwu(), active.stream().mapToLong(Input::units).sum(), DENOMINATOR);
    }

    private static void assertTree(DSWUNTree tree, List<Input> active) {
        var tails = tree.tailList().entries();
        assertThat(tails).hasSize(active.size());
        var totals = new IdentityHashMap<DSWUNNode, Long>(); var counts = new IdentityHashMap<DSWUNNode, Integer>();
        var itemSet = new HashSet<String>();
        for (int i = 0; i < active.size(); i++) {
            var tail = tails.get(i); var row = active.get(i);
            assertThat(tail.transactionId()).isEqualTo(row.transaction().id());
            assertRatio(tail.transactionTwu(), row.units(), DENOMINATOR);
            var pathItems = new ArrayList<String>(); var node = tail.tailNode();
            while (node != tree.root()) {
                pathItems.add(node.itemId()); itemSet.add(node.itemId());
                totals.merge(node, row.units(), Long::sum); counts.merge(node, 1, Integer::sum);
                assertThat(node.parent().children().get(node.itemId())).isSameAs(node);
                assertThat(node.parent().pre()).isLessThan(node.pre());
                assertThat(node.parent().post()).isGreaterThan(node.post());
                if (node.parent() != tree.root()) assertThat(tree.rank(node.parent().itemId())).isLessThan(tree.rank(node.itemId()));
                node = node.parent();
            }
            assertThat(pathItems).doesNotHaveDuplicates();
            assertThat(pathItems).containsExactlyInAnyOrderElementsOf(row.transaction().items().stream().map(TransactionItem::itemId).toList());
        }
        assertThat(tree.treeRank().keySet()).containsExactlyInAnyOrderElementsOf(itemSet);
        var all = new ArrayList<DSWUNNode>(); collect(tree.root(), all);
        assertThat(all).extracting(DSWUNNode::pre).doesNotHaveDuplicates();
        assertThat(all).extracting(DSWUNNode::post).doesNotHaveDuplicates();
        assertThat(all).hasSize(totals.size() + 1);
        totals.forEach((node, units) -> {
            assertRatio(node.weight(), units, DENOMINATOR);
            assertThat(node.transactionCount()).isEqualTo(counts.get(node));
        });
    }

    private static void collect(DSWUNNode node, List<DSWUNNode> all) {
        all.add(node); node.children().values().forEach(child -> collect(child, all));
    }

    private static void assertRatio(BigDecimal actual, long numerator, long denominator) {
        var expected = BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), MathContext.DECIMAL128);
        assertThat(actual.subtract(expected).abs()).isLessThanOrEqualTo(EPSILON);
    }
}
