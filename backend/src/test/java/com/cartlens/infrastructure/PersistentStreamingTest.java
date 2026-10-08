package com.cartlens.infrastructure;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.domain.*;
import com.cartlens.service.TwuCalculator;

class PersistentStreamingTest {
    @TempDir Path directory;
    @Test void automaticallyMinesNewPanesWithoutReplayingHistoryAndRestoresPartialPane() {
        var json = new ObjectMapper(); String id; String session;
        try (var archive = new StreamArchive(directory.resolve("db").toString(), json)) {
            var store = new StreamStore(archive, json); var state = store.create(); id = state.id();
            state.configure(Algorithm.FWUDS_DWT, new MiningConfig(2, 2, new BigDecimal("0.5")));
            session = state.configuration().sessionId();
            state.add(List.of(tx("1"), tx("2"), tx("3")));
            assertThat(state.latestAny()).isNull(); assertThat(state.buffered()).isEqualTo(1);
            state.add(List.of(tx("4"), tx("5")));
            assertThat(state.latestAny().result().windowId()).isEqualTo(1);
            assertThat(state.metrics().processedTransactions()).isEqualTo(5);
            assertThat(state.retained()).isEqualTo(5);
            assertThat(state.results(session, 0, 20)).hasSize(1);
        }
        try (var archive = new StreamArchive(directory.resolve("db").toString(), json)) {
            var restored = new StreamStore(archive, json).require(id);
            assertThat(restored.total()).isEqualTo(5); assertThat(restored.buffered()).isEqualTo(1);
            assertThat(restored.configuration().sessionId()).isEqualTo(session);
            restored.add(List.of(tx("6")));
            assertThat(restored.latestAny().result().windowId()).isEqualTo(2);
            assertThat(restored.results(session, 0, 20)).extracting(r -> r.result().windowId()).containsExactly(1L, 2L);
            assertThat(restored.latestAny().result().patterns().getFirst().transactionIds()).containsExactly("3", "4", "5", "6");
            assertThatThrownBy(() -> restored.add(List.of(tx("1")))).isInstanceOf(com.cartlens.application.ApplicationException.class);
            assertThat(restored.total()).isEqualTo(6);
            assertThat(restored.transactions(4, 2)).extracting(Transaction::id).containsExactly("5", "6");
        }
    }
    @Test void restoresAllCommittedButUnminedWindowsAfterInterruptedBatch() {
        var json = new ObjectMapper(); String id; String session;
        try (var archive = new StreamArchive(directory.resolve("recover").toString(), json)) {
            var state = new StreamStore(archive, json).create(); id = state.id(); session = state.configuration().sessionId();
            state.add(List.of(tx("1"), tx("2"), tx("3"), tx("4")));
            // Simulate crash after the transaction batch commit but before processing it.
            archive.append(id, 4, List.of(tx("5"), tx("6"), tx("7"), tx("8"), tx("9")), "checkpoint");
        }
        try (var archive = new StreamArchive(directory.resolve("recover").toString(), json)) {
            var state = new StreamStore(archive, json).require(id);
            assertThat(state.failure()).isNull(); assertThat(state.latestAny().result().windowId()).isEqualTo(3);
            assertThat(state.results(session, 0, 20)).extracting(r -> r.result().windowId()).containsExactly(1L, 2L, 3L);
            assertThat(state.buffered()).isEqualTo(1); assertThat(state.total()).isEqualTo(9);
        }
    }
    @Test void duplicateBatchRollsBackAndHotStateStaysBoundedAcrossLongStream() {
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("bounded").toString(), json)) {
            var state = new StreamStore(archive, json).create();
            state.configure(Algorithm.FWUDS_CT, new MiningConfig(10, 3, new BigDecimal("0.5")));
            for (int batch = 0; batch < 100; batch++) {
                var transactions = new java.util.ArrayList<Transaction>();
                for (int i = 0; i < 10; i++) transactions.add(tx("T" + (batch * 10 + i)));
                state.add(transactions); assertThat(state.retained()).isLessThanOrEqualTo(30);
            }
            assertThat(state.metrics().processedTransactions()).isEqualTo(1000);
            assertThat(state.latestAny().result().windowId()).isEqualTo(98);
            assertThat(state.results(state.configuration().sessionId(), 0, 100)).hasSize(98);
            assertThatThrownBy(() -> state.add(List.of(tx("new"), tx("T0")))).isInstanceOf(com.cartlens.application.ApplicationException.class);
            assertThat(state.total()).isEqualTo(1000); assertThat(state.transactions(1000, 1)).isEmpty();
        }
    }
    @Test void evictionNeverCreatesTwoWritersForAStateStillUsedByAnInFlightRequest() {
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("identity").toString(), json)) {
            var store = new StreamStore(archive, json); var first = store.create();
            for (int i = 0; i < 20; i++) store.create();
            assertThat(store.require(first.id())).isSameAs(first);
            first.add(List.of(tx("one")));
            assertThat(store.require(first.id()).total()).isEqualTo(1);
        }
    }
    @Test void archivedAndPagedWusPreserveAllDecimal128Digits() {
        var json=new ObjectMapper();
        try(var archive=new StreamArchive(directory.resolve("precision").toString(),json)) {
            var state=new StreamStore(archive,json).create();
            state.configure(Algorithm.FWUDS_CT,new MiningConfig(1,3,new BigDecimal("0.1")));
            var a=List.of(new TransactionItem("A","A",1,BigDecimal.ONE));
            var b=List.of(new TransactionItem("B","B",1,BigDecimal.ONE));
            state.add(List.of(new Transaction("a",a,BigDecimal.ONE),new Transaction("b1",b,BigDecimal.ONE),new Transaction("b2",b,BigDecimal.ONE)));
            var expected=state.latestAny().result().patterns().getFirst().wus();
            var session=state.configuration().sessionId();
            assertThat(archive.patternPage(state.id(),session,1,0,1).getFirst().wus()).isEqualByComparingTo(expected);
            assertThat(archive.results(state.id(),session,0,1).getFirst().result().patterns().getFirst().wus()).isEqualByComparingTo(expected);
            assertThat(expected.toPlainString()).isEqualTo("0.3333333333333333333333333333333333");
        }
    }
    private static Transaction tx(String id) {
        var items = List.of(new TransactionItem("A", "A", 1, BigDecimal.ONE));
        return new Transaction(id, items, new TwuCalculator().calculate(items));
    }
}
