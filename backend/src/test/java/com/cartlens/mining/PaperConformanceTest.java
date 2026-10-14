package com.cartlens.mining;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.junit.jupiter.api.Test;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.MiningResult;
import com.cartlens.support.TestFixtures;

/** Independent expectations transcribed from PDF Fig. 2, Table 2 and Eq. (1)-(2).
 * All six TWUs have the common denominator 120. No production calculator/oracle
 * is used to decide expected membership, support, IDs or WUS.
 */
class PaperConformanceTest {
    private static final List<String> ITEMS = List.of("A", "B", "C", "D", "E");
    private static final List<String> TRANSACTIONS = List.of("ACDE", "BCDE", "ACE", "ACD", "BCD", "ACDE");
    private static final long[] TWU_UNITS = {57, 84, 44, 116, 52, 126};
    private static final BigDecimal EPSILON = new BigDecimal("1E-30");

    @Test void bothAlgorithmsReturnTheCompleteMathematicalPatternSetInEachPaperWindow() {
        for (String threshold : List.of("0.5", "0.615", "0.72", "0.85", "1")) {
            var minWus = new BigDecimal(threshold);
            var session = new ParallelMiningSession(new MiningConfig(2, 2, minWus));
            var panes = TestFixtures.panes(TestFixtures.dse(), 2);
            assertThat(session.accept(panes.getFirst()).ct().result()).isNull();
            for (int pane = 1; pane < panes.size(); pane++) {
                var pair = session.accept(panes.get(pane));
                var expected = expectedPatterns((pane - 1) * 2, minWus);
                assertPatterns(pair.ct().result(), expected);
                assertPatterns(pair.dwt().result(), expected);
            }
        }
    }

    @Test void liveCtSnapshotReproducesEveryCircularTidAndDoesNotRetainEvictedTransactions() {
        var session = new ParallelMiningSession(new MiningConfig(2, 2, new BigDecimal("0.5")));
        var panes = TestFixtures.panes(TestFixtures.dse(), 2);
        session.accept(panes.get(0)); session.accept(panes.get(1));
        assertCt(session.ctStructure(), 4, 301, Map.of(
                "A", List.of(1, 3, 4), "B", List.of(2), "C", List.of(1, 2, 3, 4),
                "D", List.of(1, 2, 4), "E", List.of(1, 2, 3)), 0);
        session.accept(panes.get(2));
        assertCt(session.ctStructure(), 2, 338, Map.of(
                "A", List.of(3, 4, 2), "B", List.of(1), "C", List.of(3, 4, 1, 2),
                "D", List.of(4, 1, 2), "E", List.of(3, 2)), 2);
    }

    @Test void liveDwtSnapshotMatchesFigure11AndFigure13PathsWeightsAndTailLinks() {
        var session = new ParallelMiningSession(new MiningConfig(2, 2, new BigDecimal("0.5")));
        var panes = TestFixtures.panes(TestFixtures.dse(), 2);
        session.accept(panes.get(0)); session.accept(panes.get(1));
        assertTree(session.dwtStructure(), Map.of("C", 301L, "CD", 257L, "CDA", 173L,
                "CDAE", 57L, "CDE", 84L, "CDEB", 84L, "CA", 44L, "CAE", 44L),
                List.of("CDAE", "CDEB", "CAE", "CDA"), 0);
        session.accept(panes.get(2));
        assertTree(session.dwtStructure(), Map.of("C", 338L, "CD", 294L, "CDA", 242L,
                "CDAE", 126L, "CDB", 52L, "CA", 44L, "CAE", 44L),
                List.of("CAE", "CDA", "CDB", "CDAE"), 2);
    }

    @Test void thresholdEqualityIsInclusiveAndPresentationRoundingDoesNotChangeMembership() {
        // A has exact WUS=0.5; it must disappear when the threshold is slightly higher.
        var transactions = TestFixtures.dse().subList(0, 2).stream()
                .map(t -> new com.cartlens.domain.Transaction(t.id(), t.items(), BigDecimal.ONE)).toList();
        for (String threshold : List.of("0.5", "0.50000000000000000001")) {
            var session = new ParallelMiningSession(new MiningConfig(2, 1, new BigDecimal(threshold)));
            var pair = session.accept(new com.cartlens.domain.Pane(1, transactions));
            for (var result : List.of(pair.ct().result(), pair.dwt().result())) {
                assertThat(result.patterns().stream().anyMatch(p -> p.pattern().items().equals(List.of("A"))))
                        .isEqualTo(threshold.equals("0.5"));
            }
        }
    }

    private record Expected(long numerator, long denominator, List<String> ids) { }

    private static Map<List<String>, Expected> expectedPatterns(int start, BigDecimal threshold) {
        var expected = new java.util.HashMap<List<String>, Expected>();
        long denominator = 0;
        for (int t = start; t < start + 4; t++) denominator += TWU_UNITS[t];
        for (int mask = 1; mask < 32; mask++) {
            var pattern = new ArrayList<String>();
            for (int i = 0; i < ITEMS.size(); i++) if ((mask & (1 << i)) != 0) pattern.add(ITEMS.get(i));
            long numerator = 0;
            var ids = new ArrayList<String>();
            for (int t = start; t < start + 4; t++) {
                final String contents = TRANSACTIONS.get(t);
                if (pattern.stream().allMatch(contents::contains)) { numerator += TWU_UNITS[t]; ids.add("t" + (t + 1)); }
            }
            // Compare exact integers before division, including equality at minWUS.
            if (BigDecimal.valueOf(numerator).compareTo(threshold.multiply(BigDecimal.valueOf(denominator))) >= 0)
                expected.put(List.copyOf(pattern), new Expected(numerator, denominator, List.copyOf(ids)));
        }
        return expected;
    }

    private static void assertPatterns(MiningResult result, Map<List<String>, Expected> expected) {
        assertThat(result.patterns()).hasSize(expected.size());
        assertThat(result.patterns()).extracting(p -> p.pattern().items()).containsExactlyInAnyOrderElementsOf(expected.keySet());
        for (var pattern : result.patterns()) {
            var value = expected.get(pattern.pattern().items());
            assertRatio(pattern.wus(), value.numerator(), value.denominator());
            assertThat(pattern.support()).isEqualTo(value.ids().size());
            assertThat(pattern.transactionIds()).containsExactlyElementsOf(value.ids());
        }
    }

    private static void assertCt(ParallelMiningSession.Structure structure, int currentTid, long sumUnits,
            Map<String, List<Integer>> tids, int start) {
        assertThat(structure.currentLcTid()).isEqualTo(currentTid);
        assertRatio(structure.sumTwu(), sumUnits, 120);
        assertThat(structure.ctsets()).hasSize(5);
        for (var row : structure.ctsets()) {
            assertThat(row.tids()).containsExactlyElementsOf(tids.get(row.item()));
            assertThat(row.support()).isEqualTo(tids.get(row.item()).size());
            long numerator = 0;
            for (int t = start; t < start + 4; t++) if (TRANSACTIONS.get(t).contains(row.item())) numerator += TWU_UNITS[t];
            assertRatio(row.wus(), numerator, sumUnits);
        }
    }

    private static void assertTree(ParallelMiningSession.Structure structure, Map<String, Long> weights,
            List<String> tails, int start) {
        var paths = new TreeMap<String, ParallelMiningSession.TreeNode>();
        for (var node : structure.nodes()) {
            if (node.parentId() == null) continue;
            paths.put(path(node, structure.nodes()), node);
            var parent = structure.nodes().stream().filter(n -> n.id() == node.parentId()).findFirst().orElseThrow();
            assertThat(parent.pre()).isLessThan(node.pre());
            assertThat(parent.post()).isGreaterThan(node.post());
        }
        assertThat(paths.keySet()).containsExactlyInAnyOrderElementsOf(weights.keySet());
        weights.forEach((path, units) -> assertRatio(paths.get(path).weight(), units, 120));
        assertThat(structure.totalEntries()).isEqualTo(weights.size() + 1);
        assertThat(structure.tailCount()).isEqualTo(4);
        assertThat(structure.tails()).hasSize(4);
        for (int i = 0; i < 4; i++) {
            var tail = structure.tails().get(i);
            assertThat(tail.transactionId()).isEqualTo("t" + (start + i + 1));
            assertRatio(tail.twu(), TWU_UNITS[start + i], 120);
            assertThat(tail.nodeId()).isEqualTo(paths.get(tails.get(i)).id());
        }
    }

    private static String path(ParallelMiningSession.TreeNode node, List<ParallelMiningSession.TreeNode> nodes) {
        if (node.parentId() == null) return "";
        var parent = nodes.stream().filter(n -> n.id() == node.parentId()).findFirst().orElseThrow();
        return path(parent, nodes) + node.item();
    }

    private static void assertRatio(BigDecimal actual, long numerator, long denominator) {
        var expected = BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), MathContext.DECIMAL128);
        assertThat(actual.subtract(expected).abs()).isLessThanOrEqualTo(EPSILON);
    }
}
