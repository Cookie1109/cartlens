package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class RetainedMemoryTest {
    @Test void primitiveArraysUseTheirActualElementWidthWithoutBoxing() {
        assertThat(RetainedMemory.estimate(new long[1000])).isEqualTo(8016);
        assertThat(RetainedMemory.estimate(new int[1000])).isEqualTo(4016);
        assertThat(RetainedMemory.estimate(new byte[1000])).isEqualTo(1016);
    }
    @Test void inheritedWindowIndexFieldsRemainIncluded() {
        var store = new com.cartlens.mining.ct.CTsetStore(new com.cartlens.domain.MiningConfig(1,1000,new java.math.BigDecimal("0.5")));
        assertThat(RetainedMemory.estimate(store)).isGreaterThan(20_000);
    }
}
