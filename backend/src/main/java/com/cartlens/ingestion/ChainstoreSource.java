package com.cartlens.ingestion;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class ChainstoreSource {
    private final Path directory;
    private Map<String, BigDecimal> investments;
    public ChainstoreSource(@Value("${cartlens.chainstore-directory:}") String directory) {
        this.directory = directory.isBlank() ? (Files.isDirectory(Path.of("Chainstore-metadata"))
                ? Path.of("Chainstore-metadata") : Path.of("../Chainstore-metadata")) : Path.of(directory);
    }
    public Path transactions() { return directory.resolve("transactions.txt").toAbsolutePath().normalize(); }
    public synchronized Map<String, BigDecimal> investments() throws IOException {
        if (investments == null) investments = ChainstoreReader.investments(directory.resolve("investment_table.txt"));
        return investments;
    }
    public String fingerprint() throws IOException {
        var tx = transactions(); var inv = directory.resolve("investment_table.txt");
        return Files.size(tx) + ":" + Files.getLastModifiedTime(tx).toMillis() + ":" + Files.size(inv) + ":" + Files.getLastModifiedTime(inv).toMillis();
    }
    public Description describe() {
        try { return new Description(true, Files.size(transactions()), investments().size(), fingerprint(), null); }
        catch (Exception error) { return new Description(false, 0, 0, null, error.getMessage()); }
    }
    public record Description(boolean available, long transactionFileBytes, int itemCount, String fingerprint, String error) { }
}
