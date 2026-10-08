package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import com.cartlens.domain.*;
import com.cartlens.mining.ct.*;
import com.cartlens.mining.dwt.*;
import com.cartlens.service.TwuCalculator;
import com.cartlens.verification.*;
import com.cartlens.window.SlidingWindowManager;

class StreamingRegressionTest {
    @Test void multipleNewItemsTogetherAndReappearingItemsRemainComplete() {
        var data = List.of(tx("t1", "1", "A"), tx("t2", "1", "A"), tx("t3", "1", "X", "Y"),
                tx("t4", "1", "X", "Y", "Z"), tx("t5", "1", "A", "X", "Y"), tx("t6", "1", "M", "N"),
                tx("t7", "1", "M", "N"), tx("t8", "1", "X", "Y", "Z"));
        verify(data, new MiningConfig(1, 2, new BigDecimal("0.5")));
        verify(data, new MiningConfig(1, 2, BigDecimal.ZERO));
    }
    @Test void zeroUtilityTransactionsKeepLiveTailPathsAndCorrectSupport() {
        verify(List.of(tx("z1", "0", "A", "B"), tx("z2", "1", "A"), tx("z3", "0", "A", "B"),
                tx("z4", "1", "A", "B"), tx("z5", "1", "C"), tx("z6", "0", "A", "B")),
                new MiningConfig(1, 3, BigDecimal.ZERO));
    }
    @Test void randomPersistentSessionsMatchOracleAtEveryWindowWithNewItemsAndDynamicWeights() {
        for (int seed = 0; seed < 150; seed++) {
            var random = new Random(seed); var data = new ArrayList<Transaction>();
            for (int index = 0; index < 24; index++) {
                var items = new ArrayList<TransactionItem>();
                for (int item = 0; item < Math.min(8, 2 + index / 3); item++) {
                    if (random.nextBoolean()) items.add(new TransactionItem("I" + item, "I" + item, 1 + random.nextInt(5),
                            new BigDecimal("0." + (1 + random.nextInt(9)))));
                }
                if (items.isEmpty()) items.add(new TransactionItem("I0", "I0", 1, BigDecimal.ONE));
                data.add(new Transaction("S" + seed + "T" + index, items, new TwuCalculator().calculate(items)));
            }
            verify(data, new MiningConfig(1 + seed % 3, 2 + seed % 3, new BigDecimal(seed % 4 == 0 ? "0" : "0.25")));
        }
    }
    @Test void retiredItemsDoNotAccumulateEmptyCTsetsOrTreeRanks() {
        var config = new MiningConfig(1, 2, new BigDecimal("0.5"));
        var ct = new FWUDSCTSession(config); var dwt = new FWUDSDWTSession(config);
        for (int index = 0; index < 500; index++) {
            var pane = new Pane(index + 1, List.of(tx("t" + index, "1", "I" + index)));
            ct.accept(pane); dwt.accept(pane);
            assertThat(ct.store().oneItemCTsets()).hasSizeLessThanOrEqualTo(2);
            if (dwt.tree() != null) assertThat(dwt.tree().treeRank()).hasSizeLessThanOrEqualTo(2);
        }
    }
    private static void verify(List<Transaction> transactions, MiningConfig config) {
        var ct = new FWUDSCTSession(config); var dwt = new FWUDSDWTSession(config);
        var windows = new SlidingWindowManager(config); var oracle = new OracleMiner(); var comparator = new ResultComparator();
        for (int index = 0; index + config.paneSize() <= transactions.size(); index += config.paneSize()) {
            var pane = new Pane(index / config.paneSize() + 1, transactions.subList(index, index + config.paneSize()));
            var window = windows.accept(pane); var left = ct.accept(pane); var right = dwt.accept(pane);
            assertThat(left.isPresent()).isEqualTo(window.isPresent()); assertThat(right.isPresent()).isEqualTo(window.isPresent());
            if (window.isPresent()) {
                var expected = oracle.mine(window.orElseThrow(), config);
                assertThat(comparator.compare(expected, left.orElseThrow()).differences()).isEmpty();
                assertThat(comparator.compare(expected, right.orElseThrow()).differences()).isEmpty();
            }
        }
    }
    private static Transaction tx(String id, String weight, String... ids) {
        var items = Arrays.stream(ids).map(item -> new TransactionItem(item, item, 1, new BigDecimal(weight))).toList();
        return new Transaction(id, items, new TwuCalculator().calculate(items));
    }
}
