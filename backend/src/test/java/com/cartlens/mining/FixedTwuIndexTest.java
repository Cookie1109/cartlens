package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class FixedTwuIndexTest {
    @Test void primitiveSumsRemainExactThroughCarriesAndEvictions() {
        var index = new FixedTwuIndex(257);
        var random = new Random(42);
        var values = new ArrayList<BigDecimal>();
        for (int i = 1; i <= 257; i++) {
            var value = new BigDecimal(new java.math.BigInteger(110, random), 33);
            values.add(value); index.put(i, value);
        }
        for (int sample = 0; sample < 100; sample++) {
            var tids = new ArrayList<Integer>(); BigDecimal expected = BigDecimal.ZERO;
            for (int i = 1; i <= 257; i++) if (random.nextBoolean()) { tids.add(i); expected = expected.add(values.get(i-1)); }
            assertThat(index.sum(tids)).isEqualByComparingTo(expected);
            var dense = new com.cartlens.mining.ct.CTsetIntersection().prepare(tids, 200, 257);
            assertThat(index.sum(dense)).isEqualByComparingTo(expected);
        }
        index.remove(17); index.put(17, new BigDecimal("9.1234567890123456789012345678901234"));
        values.set(16, new BigDecimal("9.1234567890123456789012345678901234"));
        assertThat(index.sum(java.util.stream.IntStream.rangeClosed(1,257).boxed().toList()))
                .isEqualByComparingTo(values.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        assertThat(index.sum(new com.cartlens.mining.ct.CTsetIntersection().prepare(
                java.util.stream.IntStream.rangeClosed(1,257).boxed().toList(), 17, 257)))
                .isEqualByComparingTo(values.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    @Test void unsupportedScaleOrMagnitudeFallsBackRatherThanRounding() {
        var small = new FixedTwuIndex(1); small.put(1, new BigDecimal("1E-41"));
        assertThat(small.sum(List.of(1))).isNull();
        var large = new FixedTwuIndex(1); large.put(1, new BigDecimal("1E1000"));
        assertThat(large.sum(List.of(1))).isNull();
    }
}
