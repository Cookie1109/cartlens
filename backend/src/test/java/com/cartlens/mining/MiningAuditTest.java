package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import java.math.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import com.cartlens.domain.*;
import com.cartlens.mining.ct.FWUDSCTSession;
import com.cartlens.mining.dwt.*;
import com.cartlens.support.TestFixtures;

class MiningAuditTest {
    @Test void bothAuditsExplainActualPaperScoresAndRemainImmutableAfterSliding() {
        var config = new MiningConfig(2, 2, new BigDecimal("0.5"));
        var session = new ParallelMiningSession(config);
        var panes = TestFixtures.panes(TestFixtures.dse(), 2);
        session.accept(panes.get(0));
        var first = session.accept(panes.get(1));
        var ctFirst = session.ctAudit(first.ct().result());
        var dwtFirst = session.dwtAudit(first.dwt().result());
        var second = session.accept(panes.get(2));
        for (var audit : List.of(ctFirst, dwtFirst)) {
            assertThat(audit.windowId()).isEqualTo(1);
            assertRatio(audit.sumTwu(), 301, 120);
            assertThat(audit.expiredTwu().abs()).isLessThan(new BigDecimal("1e-30"));
            checkSample(audit, List.of("A"), 217, 301, true);
            checkSample(audit, List.of("B"), 84, 301, false);
            assertThat(audit.acceptedCandidates()).isEqualTo(audit.patternCount());
            assertThat(audit.evaluatedCandidates()).isEqualTo(audit.acceptedCandidates() + audit.prunedCandidates());
        }
        for (var audit : List.of(session.ctAudit(second.ct().result()), session.dwtAudit(second.dwt().result()))) {
            assertThat(audit.windowId()).isEqualTo(2);
            assertRatio(audit.sumTwu(), 338, 120);
            assertRatio(audit.previousSumTwu(), 301, 120);
            assertRatio(audit.incomingTwu(), 178, 120);
            assertRatio(audit.expiredTwu(), 141, 120);
            checkSample(audit, List.of("A"), 286, 338, true);
            assertThat(audit.samples()).anySatisfy(sample -> {
                assertThat(sample.operation()).endsWith("INTERSECTION");
                assertThat(sample.evidence()).isNotEmpty();
            });
        }
        assertRatio(ctFirst.sumTwu(), 301, 120);
        checkSample(dwtFirst, List.of("A"), 217, 301, true);
    }

    @Test void boundedCaptureNeverTruncatesResultsOrChangesMembershipAcrossManyWindows() {
        var config = new MiningConfig(2, 2, new BigDecimal("0.5"));
        var txs = new ArrayList<Transaction>();
        for (int t = 0; t < 40; t++) {
            var items = new ArrayList<TransactionItem>();
            for (int i = 0; i < 9; i++) items.add(new TransactionItem("item-" + i, "item-" + i, 1, BigDecimal.ONE));
            txs.add(new Transaction("dense-" + t, items, BigDecimal.ONE));
        }
        var ct = new FWUDSCTSession(config); var ctOff = new FWUDSCTSession(config, false);
        var dwt = new FWUDSDWTSession(config); var dwtOff = new FWUDSDWTSession(config, false);
        for (var pane : TestFixtures.panes(txs, 2)) {
            var left = ct.accept(pane); var right = dwt.accept(pane);
            var leftOff = ctOff.accept(pane); var rightOff = dwtOff.accept(pane);
            if (left.isEmpty()) continue;
            assertThat(left.orElseThrow().patterns()).hasSize(511).isEqualTo(leftOff.orElseThrow().patterns());
            assertThat(right.orElseThrow().patterns()).hasSize(511).isEqualTo(rightOff.orElseThrow().patterns());
            for (var audit : List.of(ct.audit(left.orElseThrow().windowId(), 511), dwt.audit(right.orElseThrow().windowId(), 511))) {
                assertThat(audit.samples()).hasSize(48);
                assertThat(audit.evaluatedCandidates()).isEqualTo(511);
                assertThat(audit.omittedCandidates()).isEqualTo(463);
                assertThat(audit.samples()).allSatisfy(sample -> assertThat(sample.evidence()).hasSizeLessThanOrEqualTo(8));
                assertThat(RetainedMemory.estimate(audit)).isLessThan(100_000);
            }
        }
    }

    @Test void earlyDwtPruningReportsABoundRatherThanAnInventedExactScore() {
        var descendant = new WUNList(java.util.stream.IntStream.range(0, 128)
                .mapToObj(i -> new WUNCode(i + 1, i + 1, BigDecimal.ONE)).toList());
        var ancestor = new WUNList(List.of(new WUNCode(1000, 1000, BigDecimal.ONE)));
        var inspection = new WUNListIntersection.Inspection();
        assertThat(new WUNListIntersection().intersect(descendant, ancestor, new BigDecimal("0.9"), new BigDecimal("1000"), inspection)).isEmpty();
        assertThat(inspection.joined).isNull();
        assertThat(inspection.pruningBound).isNotNull().isLessThan(new BigDecimal("900"));
    }

    @Test void manySingletonsCannotCrowdOutTheIntersectionExplanation() {
        var session = new ParallelMiningSession(new MiningConfig(30, 2, new BigDecimal("0.1")));
        var transactions = new ArrayList<Transaction>();
        for (int t = 0; t < 60; t++) {
            var items = new ArrayList<TransactionItem>();
            for (var id : List.of("A", "B", "C", "unique-" + t))
                items.add(new TransactionItem(id, id, 1, BigDecimal.ONE));
            transactions.add(new Transaction("t" + t, items, BigDecimal.ONE));
        }
        var panes = TestFixtures.panes(transactions, 30);
        session.accept(panes.getFirst()); var pair = session.accept(panes.getLast());
        for (var audit : List.of(session.ctAudit(pair.ct().result()), session.dwtAudit(pair.dwt().result()))) {
            assertThat(audit.patternCount()).isEqualTo(7);
            assertThat(audit.samples().stream().filter(s -> s.operation().endsWith("SINGLETON")).count()).isEqualTo(16);
            assertThat(audit.samples()).anyMatch(sample -> sample.operation().endsWith("INTERSECTION"));
            assertThat(audit.omittedCandidates()).isPositive();
        }
    }

    private static void checkSample(MiningAudit.Snapshot audit, List<String> items, long numerator, long denominator, boolean kept) {
        var sample = audit.samples().stream().filter(s -> s.items().equals(items)).findFirst().orElseThrow();
        assertRatio(sample.numerator(), numerator, 120);
        assertRatio(sample.wus(), numerator, denominator);
        assertThat(sample.accepted()).isEqualTo(kept);
    }
    private static void assertRatio(BigDecimal actual, long numerator, long denominator) {
        assertThat(actual.subtract(BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), MathContext.DECIMAL128)).abs())
                .isLessThan(new BigDecimal("1e-30"));
    }
}
