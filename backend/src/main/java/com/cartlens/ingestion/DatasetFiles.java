package com.cartlens.ingestion;

import java.nio.file.Files;
import java.nio.file.Path;

/** Resolve up to eight same-named extraction levels without scanning unrelated folders. */
public final class DatasetFiles {
    private DatasetFiles() { }
    public static Path resolve(Path directory) {
        var candidate = directory.toAbsolutePath().normalize();
        for (int depth = 0; depth < 8; depth++) {
            if (complete(candidate)) return candidate;
            if (candidate.getFileName() == null) break;
            candidate = candidate.resolve(candidate.getFileName());
        }
        throw new IllegalArgumentException("Dataset needs transactions.txt and investment_table.txt in " + directory);
    }
    private static boolean complete(Path directory) {
        return Files.isRegularFile(directory.resolve("transactions.txt"))
                && Files.isRegularFile(directory.resolve("investment_table.txt"));
    }
}
