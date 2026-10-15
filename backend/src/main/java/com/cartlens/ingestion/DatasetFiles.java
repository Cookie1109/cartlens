package com.cartlens.ingestion;

import java.nio.file.Files;
import java.nio.file.Path;

/** Accept both a dataset directory and the same-named folder produced by extracting its archive. */
public final class DatasetFiles {
    private DatasetFiles() { }
    public static Path resolve(Path directory) {
        if (complete(directory)) return directory.toAbsolutePath().normalize();
        if (directory.getFileName() != null) {
            Path nested = directory.resolve(directory.getFileName());
            if (complete(nested)) return nested.toAbsolutePath().normalize();
        }
        throw new IllegalArgumentException("Dataset needs transactions.txt and investment_table.txt in " + directory);
    }
    private static boolean complete(Path directory) {
        return Files.isRegularFile(directory.resolve("transactions.txt"))
                && Files.isRegularFile(directory.resolve("investment_table.txt"));
    }
}
