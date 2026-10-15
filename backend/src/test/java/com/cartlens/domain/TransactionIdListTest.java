package com.cartlens.domain;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import com.cartlens.mining.WindowIndex;

class TransactionIdListTest {
    @Test void denseAndSparseSelectionsAreImmutableAndSerializable() throws Exception {
        String[] ids = java.util.stream.IntStream.range(0,1024).mapToObj(i -> "T" + i).toArray(String[]::new);
        var window = new TransactionIdList.Window(ids);
        int[] positions = {1,3,900}; var sparse = window.select(positions);
        var bits = new BitSet(); bits.set(0,1024); var dense = window.select(bits);
        positions[0] = 99; ids[1] = "changed"; bits.clear();
        assertThat(sparse).containsExactly("T1","T3","T900");
        assertThat(dense).hasSize(1024).startsWith("T0","T1").endsWith("T1023");
        assertThat(dense.stream().count()).isEqualTo(1024);
        assertThatThrownBy(() -> dense.set(0,"bad")).isInstanceOf(UnsupportedOperationException.class);
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        assertThat(mapper.readValue(mapper.writeValueAsString(dense),String[].class)).hasSize(1024).endsWith("T1023");
    }
    @Test void savedResultsDoNotChangeWhenCircularSlotsAreReused() {
        var index = new WindowIndex(new MiningConfig(1,130,new java.math.BigDecimal("0.5")));
        var all = new BitSet(); all.set(1,131);
        for (int i = 1; i <= 130; i++) index.insert(pane(i));
        var saved = index.transactionIdsFor(all);
        for (int i = 131; i <= 200; i++) {
            index.update(pane(i));
            assertThat(index.transactionIdsFor(all)).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(i-129,i).mapToObj(Integer::toString).toList());
        }
        assertThat(saved).startsWith("1").endsWith("130");
    }
    private Pane pane(int id) {
        return new Pane(id,List.of(new Transaction(Integer.toString(id),List.of(new TransactionItem("A","A",1,java.math.BigDecimal.ONE)),java.math.BigDecimal.ONE)));
    }
}
