package com.cartlens.infrastructure;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.cartlens.domain.*;
import com.cartlens.verification.*;
import com.cartlens.window.SlidingWindowManager;
import com.fasterxml.jackson.databind.ObjectMapper;

class ParallelStreamingTest {
    @TempDir Path directory;
    @Test void firstWindowIncludesConstructionInEveryInitialPane() {
        var miner = new com.cartlens.mining.ParallelMiningSession(new MiningConfig(2,2,new BigDecimal("0.4")));
        var initial = miner.accept(new Pane(1,List.of(tx("1",true),tx("2",false))));
        assertThat(initial.ct().result()).isNull(); assertThat(initial.dwt().result()).isNull();
        var full = miner.accept(new Pane(2,List.of(tx("3",true),tx("4",false))));
        assertThat(full.ct().result().windowId()).isEqualTo(1);
        assertThat(full.ct().updateTimeMs()).isGreaterThanOrEqualTo(initial.ct().updateTimeMs());
        assertThat(full.dwt().updateTimeMs()).isGreaterThanOrEqualTo(initial.dwt().updateTimeMs());
        if (initial.ct().allocatedBytes() != null) assertThat(full.ct().allocatedBytes()).isGreaterThan(initial.ct().allocatedBytes());
    }
    @Test void bothAlgorithmsUseSamePaneAndMatchOracleAcrossCircularWrapAndRecovery() {
        var json = new ObjectMapper(); String id; StreamState.ComparisonPoint saved;
        try (var archive = new StreamArchive(directory.resolve("parallel").toString(), json)) {
            var state = new StreamStore(archive, json).create(); id = state.id();
            var config = new MiningConfig(2, 2, new BigDecimal("0.4")); state.configure(Algorithm.FWUDS_CT, config);
            var windows = new SlidingWindowManager(config);
            for (int pane = 0; pane < 12; pane++) {
                var transactions = List.of(tx("T" + (2*pane), pane % 3 == 0), tx("T" + (2*pane+1), pane % 2 == 0));
                state.add(transactions);
                var window = windows.accept(new Pane(pane+1, transactions));
                var live = state.liveSnapshot();
                assertThat(live.ctStructure().ctsets()).isNotEmpty();
                if (window.isEmpty()) { assertThat(live.ct()).isNull(); continue; }
                assertThat(live.ct().runId()).isNotEqualTo(live.dwt().runId());
                assertThat(live.ct().result().windowId()).isEqualTo(live.dwt().result().windowId());
                var oracle = new OracleMiner().mine(window.get(), config);
                assertThat(new ResultComparator().compare(oracle, live.ct().result()).equivalent()).isTrue();
                assertThat(new ResultComparator().compare(oracle, live.dwt().result()).equivalent()).isTrue();
                var point = live.points().getLast();
                assertThat(point.equivalent()).isTrue(); assertThat(point.processedTransactions()).isEqualTo(2L * (pane+1));
                assertThat(point.ctMemoryBytes()).isPositive(); assertThat(point.dwtMemoryBytes()).isPositive();
                assertThat(point.ctUpdateMs()).isGreaterThanOrEqualTo(0); assertThat(point.dwtMiningMs()).isGreaterThanOrEqualTo(0);
                assertThat(live.dwtStructure().tailCount()).isEqualTo(4);
                assertThat(live.dwtStructure().nodes()).allSatisfy(n -> assertThat(n.pre()).isGreaterThanOrEqualTo(0));
                assertThat(state.patternPage(live.dwt().runId(), live.dwt().result().windowId(), 0, 1)).hasSize(1);
            }
            saved = state.liveSnapshot().points().getLast();
        }
        try (var archive = new StreamArchive(directory.resolve("parallel").toString(), json)) {
            var state = new StreamStore(archive,json).require(id);
            assertThat(state.failure()).isNull();
            assertThat(state.liveSnapshot().points().getLast()).isEqualTo(saved);
            assertThat(state.latest(Algorithm.FWUDS_CT).result().windowId()).isEqualTo(11);
            assertThat(state.latest(Algorithm.FWUDS_DWT).result().windowId()).isEqualTo(11);
            state.add(List.of(tx("T24",true),tx("T25",false)));
            assertThat(state.liveSnapshot().points().getLast().windowId()).isEqualTo(12);
            assertThat(state.liveSnapshot().points().getLast().equivalent()).isTrue();
        }
    }
    private Transaction tx(String id, boolean b) {
        var items = b ? List.of(new TransactionItem("A","A",1,BigDecimal.ONE),new TransactionItem("B","B",1,BigDecimal.ONE))
                : List.of(new TransactionItem("A","A",1,BigDecimal.ONE));
        return new Transaction(id, items, BigDecimal.ONE);
    }
}
