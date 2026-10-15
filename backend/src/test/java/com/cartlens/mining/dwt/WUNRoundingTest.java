package com.cartlens.mining.dwt;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class WUNRoundingTest {
    @Test void conservativePruningPreservesDecimal128ThresholdEquality() {
        var numerator = new BigDecimal("0.24999999999999999999999999999999999");
        var descendant = new WUNList(List.of(new WUNCode(2, 1, numerator)));
        var ancestor = new WUNList(List.of(new WUNCode(1, 2, numerator)));
        var intersection = new WUNListIntersection();
        assertThat(intersection.intersect(descendant, ancestor, new BigDecimal("0.25"), BigDecimal.ONE)).isPresent();
        assertThat(intersection.intersect(descendant, ancestor,
                new BigDecimal("0.250000000000000000000000000000001"), BigDecimal.ONE)).isEmpty();
    }
}
