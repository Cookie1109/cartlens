package com.cartlens.ingestion;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ChainstoreReaderTest {
    @TempDir Path directory;
    @Test void utilityMappingPreservesProductAndAveragesInsteadOfUsingInvestmentAsWeight() throws Exception {
        var investments = Map.of("1", new BigDecimal("999"), "2", new BigDecimal("12345"));
        var tx = ChainstoreReader.parse("1 2:30.50:10.25 20.25", 1, investments, ChainstoreReader.WeightMode.PROVIDED_UTILITY, 10, 42);
        assertThat(tx.twu()).isEqualByComparingTo("15.25");
        assertThat(tx.items().getFirst().quantity()).isEqualTo(1);
        assertThat(tx.items().getFirst().weight()).isEqualByComparingTo("10.25");
        assertThatThrownBy(() -> ChainstoreReader.parse("1 2:31:10 20", 1, investments, ChainstoreReader.WeightMode.PROVIDED_UTILITY, 10, 42)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ChainstoreReader.parse("1 1:30:10 20", 1, investments, ChainstoreReader.WeightMode.PROVIDED_UTILITY, 10, 42)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ChainstoreReader.parse("3:10:10", 1, investments, ChainstoreReader.WeightMode.PROVIDED_UTILITY, 10, 42)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void batchWeightsAreDeterministicAndBoundariesNeedNotAlignWithPanes() {
        var investments = Map.of("1", BigDecimal.ONE);
        var first = ChainstoreReader.parse("1:100:100", 1, investments, ChainstoreReader.WeightMode.SYNTHETIC_BATCH, 3, 42);
        var third = ChainstoreReader.parse("1:100:100", 3, investments, ChainstoreReader.WeightMode.SYNTHETIC_BATCH, 3, 42);
        var fourth = ChainstoreReader.parse("1:100:100", 4, investments, ChainstoreReader.WeightMode.SYNTHETIC_BATCH, 3, 42);
        assertThat(first.twu()).isEqualByComparingTo(third.twu());
        assertThat(fourth.twu()).isEqualByComparingTo(BigDecimal.valueOf(ChainstoreReader.batchWeight(42, 1, "1")));
        for (int batch = 0; batch < 100; batch++) assertThat(ChainstoreReader.batchWeight(42, batch, "1")).isBetween(1, 10);
    }
    @Test void checkpointSkipsAlreadyReadLinesAndReportsMalformedLine() throws Exception {
        var file = directory.resolve("tx.txt"); Files.writeString(file, "1:5:5\n1:10:10\nbad\n");
        try (var reader = new ChainstoreReader(file, Map.of("1", BigDecimal.ONE), ChainstoreReader.WeightMode.PROVIDED_UTILITY, 3, 42)) {
            reader.skip(1); assertThat(reader.next().id()).isEqualTo("2");
            assertThatThrownBy(reader::next).hasMessageContaining("dòng 3");
        }
    }
    @Test void repeatedSyntheticBatchesReuseBoundedImmutableItemsAndStillValidateInput() throws Exception {
        var file = directory.resolve("repeated.txt");
        Files.writeString(file, "1:5:5\n".repeat(200) + "1:6:5\n");
        var seen = new java.util.HashMap<Integer, com.cartlens.domain.TransactionItem>();
        try (var reader = new ChainstoreReader(file, Map.of("1", BigDecimal.ONE), ChainstoreReader.WeightMode.SYNTHETIC_BATCH, 1, 42)) {
            for (int line = 1; line <= 200; line++) {
                var transaction = reader.next();
                int expected = ChainstoreReader.batchWeight(42, line - 1, "1");
                assertThat(transaction.twu()).isEqualByComparingTo(BigDecimal.valueOf(expected));
                var item = transaction.items().getFirst();
                var previous = seen.putIfAbsent(expected, item);
                if (previous != null) assertThat(item).isSameAs(previous);
            }
            assertThat(seen).hasSizeLessThanOrEqualTo(10);
            assertThatThrownBy(reader::next).hasMessageContaining("dòng 201");
        }
    }
}
