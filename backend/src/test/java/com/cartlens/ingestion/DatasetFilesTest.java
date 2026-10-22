package com.cartlens.ingestion;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DatasetFilesTest {
    @TempDir Path directory;
    @Test void resolvesThreeLevelsFromAccidentsArchive() throws Exception {
        var outer = directory.resolve("Accidents-metadata");
        var inner = outer.resolve("Accidents-metadata").resolve("Accidents-metadata");
        Files.createDirectories(inner);
        Files.writeString(inner.resolve("transactions.txt"), "1:1:1");
        Files.writeString(inner.resolve("investment_table.txt"), "1 1");
        assertThat(DatasetFiles.resolve(outer)).isEqualTo(inner.toAbsolutePath());
        assertThat(new ChainstoreSource(directory.toString()).transactions(Dataset.ACCIDENTS)).isEqualTo(inner.resolve("transactions.txt"));
    }
    @Test void resolvesDirectAndSameNamedNestedDatasetsWithoutChangingTheirContents() throws Exception {
        var outer = directory.resolve("Retail-metadata"); var inner = outer.resolve("Retail-metadata");
        Files.createDirectories(inner);
        Files.writeString(inner.resolve("transactions.txt"),"1:1:1");
        Files.writeString(inner.resolve("investment_table.txt"),"1 1");
        assertThat(DatasetFiles.resolve(outer)).isEqualTo(inner.toAbsolutePath());
        assertThat(DatasetFiles.resolve(inner)).isEqualTo(inner.toAbsolutePath());
        assertThat(new ChainstoreSource(directory.toString()).transactions(Dataset.RETAIL)).isEqualTo(inner.resolve("transactions.txt"));
        Files.delete(inner.resolve("investment_table.txt"));
        assertThatThrownBy(() -> DatasetFiles.resolve(outer)).isInstanceOf(IllegalArgumentException.class);
    }
}
