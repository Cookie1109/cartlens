package com.cartlens.benchmark;

import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.domain.*;
import com.cartlens.ingestion.ChainstoreReader;
import com.cartlens.mining.ct.FWUDSCTSession;
import com.cartlens.mining.dwt.FWUDSDWTSession;
import com.cartlens.verification.ResultComparator;

/** Runs both algorithms on each pane, checks every result, and emits reproducible JSON evidence. */
public final class StreamingBenchmark {
    public static void main(String[] args) throws Exception {
        var options = new HashMap<String, String>();
        for (int i = 0; i < args.length; i += 2) options.put(args[i], args[i + 1]);
        Path directory = Path.of(options.getOrDefault("--source", "../Chainstore-metadata"));
        Path output = Path.of(options.getOrDefault("--output", "../docs/reviews/chainstore-benchmark.json"));
        int paneSize = Integer.parseInt(options.getOrDefault("--pane", "1000"));
        int paneCount = Integer.parseInt(options.getOrDefault("--window-panes", "4"));
        long maximum = Long.parseLong(options.getOrDefault("--max", "0"));
        var config = new MiningConfig(paneSize, paneCount, new BigDecimal(options.getOrDefault("--min-wus", "0.005")));
        var mode = ChainstoreReader.WeightMode.valueOf(options.getOrDefault("--weight-mode", "PROVIDED_UTILITY"));
        int batch = Integer.parseInt(options.getOrDefault("--weight-batch", "10000"));
        long seed = Long.parseLong(options.getOrDefault("--seed", "42"));
        var ct = new FWUDSCTSession(config); var dwt = new FWUDSDWTSession(config); var comparator = new ResultComparator();
        long start = System.nanoTime(), readNanos = 0, compareNanos = 0, ctUpdate = 0, ctMine = 0, dwtUpdate = 0, dwtMine = 0;
        long transactions = 0, panes = 0, windows = 0, patterns = 0, maxPatterns = 0, peakHeap = 0;
        long maxTransactionReferences = 0;
        var buffer = new ArrayList<Transaction>(paneSize);
        var metadata = ChainstoreReader.investments(directory.resolve("investment_table.txt"));
        try (var reader = new ChainstoreReader(directory.resolve("transactions.txt"), metadata, mode, batch, seed)) {
            while (maximum == 0 || transactions < maximum) {
                long readStarted = System.nanoTime(); var transaction = reader.next(); readNanos += System.nanoTime() - readStarted;
                if (transaction == null) break;
                transactions++; buffer.add(transaction);
                if (buffer.size() != paneSize) continue;
                var pane = new Pane(++panes, buffer); buffer.clear();
                var left = ct.accept(pane); var right = dwt.accept(pane);
                ctUpdate += ct.timings().updateNanos(); ctMine += ct.timings().miningNanos();
                dwtUpdate += dwt.timings().updateNanos(); dwtMine += dwt.timings().miningNanos();
                if (left.isPresent()) {
                    windows++; patterns += left.orElseThrow().patterns().size(); maxPatterns = Math.max(maxPatterns, left.orElseThrow().patterns().size());
                    maxTransactionReferences = Math.max(maxTransactionReferences,left.orElseThrow().patterns().stream().mapToLong(PatternResult::support).sum());
                    long compareStarted = System.nanoTime(); var comparison = comparator.compare(left.orElseThrow(), right.orElseThrow()); compareNanos += System.nanoTime() - compareStarted;
                    if (!comparison.equivalent()) throw new IllegalStateException("Window " + windows + ": " + comparison.differences());
                }
                var runtime = Runtime.getRuntime(); peakHeap = Math.max(peakHeap, runtime.totalMemory() - runtime.freeMemory());
                if (panes % 100 == 0) System.out.println("transactions=" + transactions + " windows=" + windows + " heapMiB=" + peakHeap / 1024 / 1024);
            }
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("javaVersion", System.getProperty("java.version")); result.put("source", directory.toAbsolutePath().normalize().toString());
        result.put("sourceBytes", Files.size(directory.resolve("transactions.txt"))); result.put("config", config); result.put("weightMode", mode);
        result.put("weightBatchSize", batch); result.put("seed", seed); result.put("transactions", transactions); result.put("panes", panes);
        result.put("windowsCompared", windows); result.put("bufferedTransactions", buffer.size()); result.put("equivalentEveryWindow", true);
        result.put("totalPatternsAcrossWindows", patterns); result.put("maxPatternsPerWindow", maxPatterns);
        result.put("maxTransactionReferencesPerWindow",maxTransactionReferences);
        result.put("readParseValidationMs", readNanos / 1e6); result.put("ctUpdateMs", ctUpdate / 1e6); result.put("ctMiningMs", ctMine / 1e6);
        result.put("dwtUpdateMs", dwtUpdate / 1e6); result.put("dwtMiningMs", dwtMine / 1e6); result.put("comparisonMs", compareNanos / 1e6);
        double totalMs = (System.nanoTime() - start) / 1e6;
        result.put("totalElapsedMs", totalMs); result.put("combinedTransactionsPerSecond", transactions * 1000.0 / totalMs);
        result.put("sampledPeakHeapBytes", peakHeap); result.put("maxHeapBytes", Runtime.getRuntime().maxMemory());
        System.gc();
        result.put("retainedHeapAfterRequestedGcBytes",Runtime.getRuntime().totalMemory()-Runtime.getRuntime().freeMemory());
        java.lang.ref.Reference.reachabilityFence(ct); java.lang.ref.Reference.reachabilityFence(dwt);
        java.lang.ref.Reference.reachabilityFence(metadata); java.lang.ref.Reference.reachabilityFence(buffer);
        Files.createDirectories(output.toAbsolutePath().getParent());
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(), result);
        System.out.println("Benchmark verified: " + output.toAbsolutePath());
    }
}
