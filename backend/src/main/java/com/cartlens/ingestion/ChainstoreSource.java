package com.cartlens.ingestion;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class ChainstoreSource {
    private final String configuredDirectory;
    private final java.util.Map<Dataset, Map<String, BigDecimal>> metadata = new java.util.EnumMap<>(Dataset.class);
    public ChainstoreSource(@Value("${cartlens.dataset-root:}") String directory) {
        this.configuredDirectory = directory;
    }
    private Path directory(Dataset dataset) {
        if (!configuredDirectory.isBlank()) {
            var configured = Path.of(configuredDirectory);
            return DatasetFiles.resolve(Files.isRegularFile(configured.resolve("transactions.txt")) ? configured : configured.resolve(dataset.directory()));
        }
        return DatasetFiles.resolve(Files.isDirectory(Path.of(dataset.directory())) ? Path.of(dataset.directory()) : Path.of("..").resolve(dataset.directory()));
    }
    public Path transactions() { return transactions(Dataset.RETAIL); }
    public Path transactions(Dataset dataset) { return directory(dataset).resolve("transactions.txt").toAbsolutePath().normalize(); }
    public synchronized Map<String, BigDecimal> investments() throws IOException {
        return investments(Dataset.RETAIL);
    }
    public synchronized Map<String, BigDecimal> investments(Dataset dataset) throws IOException {
        if (!metadata.containsKey(dataset)) metadata.put(dataset, ChainstoreReader.investments(directory(dataset).resolve("investment_table.txt")));
        return metadata.get(dataset);
    }
    public String fingerprint() throws IOException {
        return fingerprint(Dataset.RETAIL);
    }
    public String fingerprint(Dataset dataset) throws IOException {
        var tx = transactions(dataset); var inv = directory(dataset).resolve("investment_table.txt");
        return dataset + ":" + tx + ":" + Files.size(tx) + ":" + Files.getLastModifiedTime(tx).toMillis() + ":" + Files.size(inv) + ":" + Files.getLastModifiedTime(inv).toMillis();
    }
    public Description describe() {
        return describe(Dataset.RETAIL);
    }
    public Description describe(Dataset dataset) {
        try { return new Description(true, Files.size(transactions(dataset)), investments(dataset).size(), fingerprint(dataset), null); }
        catch (Exception error) { return new Description(false, 0, 0, null, error.getMessage()); }
    }
    public record Description(boolean available, long transactionFileBytes, int itemCount, String fingerprint, String error) { }
}
