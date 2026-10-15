package com.cartlens.mining.ct;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class CircularTidsetSnapshotTest {
    @Test void snapshotsSurviveGrowthEvictionAndCircularReuse() {
        var set = new CircularTidset();
        for (int i = 1; i <= 1000; i++) set.add(i);
        var original = set.values();
        set.removeOldestRange(1, 900);
        for (int i = 1; i <= 900; i++) set.add(i);
        assertThat(original).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1,1000).boxed().toList());
        assertThat(set.values()).containsExactlyElementsOf(java.util.stream.IntStream.concat(
                java.util.stream.IntStream.rangeClosed(901,1000), java.util.stream.IntStream.rangeClosed(1,900)).boxed().toList());
        assertThatThrownBy(() -> original.set(0, 9)).isInstanceOf(UnsupportedOperationException.class);
        set.removeOldestRange(901,1000);
        set.removeOldestRange(1,900);
        assertThat(set.values()).isEmpty();
        set.add(77);
        assertThat(set.values()).containsExactly(77);
    }
}
