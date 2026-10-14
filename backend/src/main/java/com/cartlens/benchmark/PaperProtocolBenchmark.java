package com.cartlens.benchmark;

import java.lang.management.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import com.cartlens.domain.*;
import com.cartlens.ingestion.ChainstoreReader;
import com.cartlens.mining.*;
import com.cartlens.mining.ct.FWUDSCTSession;
import com.cartlens.mining.dwt.FWUDSDWTSession;
import com.fasterxml.jackson.databind.ObjectMapper;

/** One algorithm, one calling thread, one fresh JVM per run. No Spring server or H2. */
public final class PaperProtocolBenchmark {
    public static void main(String[] args) throws Exception {
        if (args.length % 2 != 0) throw new IllegalArgumentException("Expected --option value pairs");
        var options = new HashMap<String, String>();
        for (int i = 0; i < args.length; i += 2) options.put(args[i], args[i + 1]);
        var algorithm = Algorithm.valueOf(options.getOrDefault("--algorithm", "FWUDS_CT"));
        if (algorithm == Algorithm.ORACLE) throw new IllegalArgumentException("Use CT or DWT");
        Path source = Path.of(options.getOrDefault("--source", "../Retail-metadata")).toAbsolutePath().normalize();
        Path output = Path.of(options.getOrDefault("--output", "../docs/reviews/paper-protocol-run.json"));
        int paneSize = Integer.parseInt(options.getOrDefault("--pane", "1"));
        int paneCount = Integer.parseInt(options.getOrDefault("--window-panes", "88000"));
        int slides = Integer.parseInt(options.getOrDefault("--slides", "50"));
        int batchSize = Integer.parseInt(options.getOrDefault("--weight-batch", "10000"));
        long seed = Long.parseLong(options.getOrDefault("--seed", "42"));
        int timeoutSeconds = Integer.parseInt(options.getOrDefault("--timeout-seconds", "120"));
        if (slides < 0 || timeoutSeconds < 1) throw new IllegalArgumentException("Invalid slides/timeout");
        var config = new MiningConfig(paneSize, paneCount, new BigDecimal(options.getOrDefault("--min-wus", "0.003")));
        long target = Math.multiplyExact((long) paneCount + slides, paneSize);
        var metadata = ChainstoreReader.investments(source.resolve("investment_table.txt"));
        var sourceSha256 = sha256(source.resolve("transactions.txt"));
        var metadataSha256 = sha256(source.resolve("investment_table.txt"));
        var resultDigest = MessageDigest.getInstance("SHA-256");
        MiningSession session = algorithm == Algorithm.FWUDS_CT ? new FWUDSCTSession(config) : new FWUDSDWTSession(config);
        long threadId = Thread.currentThread().threadId();
        var heapPools = ManagementFactory.getMemoryPoolMXBeans().stream().filter(pool -> pool.getType() == MemoryType.HEAP).toList();
        heapPools.forEach(MemoryPoolMXBean::resetPeakUsage);
        long started = System.nanoTime(), readNanos = 0, updateNanos = 0, miningNanos = 0, hashNanos = 0;
        long transactions = 0, windows = 0, panes = 0, totalPatterns = 0, peakSample = 0;
        var points = new ArrayList<Map<String,Object>>(); var buffer = new ArrayList<Transaction>(paneSize);
        String status = "COMPLETED", error = null;
        try (var reader = new ChainstoreReader(source.resolve("transactions.txt"), metadata,
                ChainstoreReader.WeightMode.SYNTHETIC_BATCH, batchSize, seed)) {
            while (transactions < target) {
                if ((System.nanoTime() - started) / 1e9 > timeoutSeconds) { status = "TIME_LIMIT"; break; }
                long readStarted = System.nanoTime(); var transaction = reader.next(); readNanos += System.nanoTime() - readStarted;
                if (transaction == null) { status = "EARLY_EOF"; break; }
                transactions++; buffer.add(transaction);
                if (buffer.size() != paneSize) continue;
                var pane = new Pane(++panes, buffer); buffer.clear();
                var result = session.accept(pane);
                if (Thread.currentThread().threadId() != threadId) throw new IllegalStateException("Mining changed thread");
                updateNanos += session.timings().updateNanos(); miningNanos += session.timings().miningNanos();
                peakSample = Math.max(peakSample, ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed());
                if (result.isEmpty()) continue;
                windows++; var mined = result.orElseThrow(); totalPatterns += mined.patterns().size();
                long hashStarted = System.nanoTime(); update(resultDigest, "W" + mined.windowId());
                for (var pattern : mined.patterns()) {
                    update(resultDigest, String.join(",",pattern.pattern().items()));
                    update(resultDigest, pattern.wus().setScale(24, RoundingMode.HALF_UP).toPlainString());
                    update(resultDigest, Integer.toString(pattern.support()));
                    update(resultDigest, String.join(",",pattern.transactionIds()));
                }
                hashNanos += System.nanoTime() - hashStarted;
                points.add(Map.of("windowId",mined.windowId(),"patternCount",mined.patterns().size(),
                        "updateMs",session.timings().updateNanos()/1e6,"miningMs",session.timings().miningNanos()/1e6));
            }
        } catch (RuntimeException failure) { status = "MINING_ERROR"; error = failure.getClass().getSimpleName() + ": " + failure.getMessage(); }
        long elapsed = System.nanoTime() - started;
        boolean completed = status.equals("COMPLETED") && transactions == target && windows == slides + 1;
        var report = new LinkedHashMap<String,Object>();
        report.put("status",status); report.put("completedRequestedProtocol",completed); report.put("error",error);
        report.put("algorithm",algorithm); report.put("config",config); report.put("requestedSlides",slides);
        report.put("completedSlides",Math.max(0,windows - 1)); report.put("completedWindows",windows);
        report.put("targetTransactions",target); report.put("processedTransactions",transactions);
        report.put("weightMode","SYNTHETIC_BATCH"); report.put("weightRange",List.of(1,10));
        report.put("quantityPolicy","1 for each item in the transaction file");
        report.put("weightBatchSize",batchSize); report.put("seed",seed);
        report.put("source",source.toString()); report.put("sourceSha256",sourceSha256); report.put("metadataSha256",metadataSha256);
        report.put("resultFingerprint",HexFormat.of().formatHex(resultDigest.digest()));
        report.put("fingerprintWusDecimalPlaces",24); report.put("fingerprintScope","completed windows only; pattern, WUS, support, ordered transaction IDs");
        report.put("totalPatternsAcrossWindows",totalPatterns); report.put("windows",points);
        report.put("miningCallingThreadCount",1); report.put("algorithmInstanceCount",1);
        report.put("maxPatternsPerWindow",MiningBudget.MAX_PATTERNS);
        report.put("maxResultTransactionReferences",Long.getLong("cartlens.max-result-transactions",1_000_000L));
        report.put("totalPipelineMs",elapsed/1e6); report.put("readParseMs",readNanos/1e6);
        report.put("updateMs",updateNanos/1e6); report.put("miningMs",miningNanos/1e6); report.put("fingerprintingMs",hashNanos/1e6);
        report.put("algorithmTimedMs",(updateNanos+miningNanos)/1e6);
        report.put("sampledHeapUsedBytesAfterPanes",peakSample);
        report.put("sumHeapPoolPeakUsedBytes",heapPools.stream().mapToLong(pool -> pool.getPeakUsage().getUsed()).sum());
        report.put("heapMeasurementLimit","Sum of per-pool peaks is an upper bound: pool peaks need not occur simultaneously; samples may miss temporary peaks. Includes JVM/input/output metadata, not isolated algorithm memory.");
        report.put("javaVersion",System.getProperty("java.version")); report.put("vm",System.getProperty("java.vm.name"));
        report.put("os",System.getProperty("os.name")); report.put("osVersion",System.getProperty("os.version"));
        report.put("logicalProcessors",Runtime.getRuntime().availableProcessors()); report.put("maxHeapBytes",Runtime.getRuntime().maxMemory());
        report.put("jvmArguments",ManagementFactory.getRuntimeMXBean().getInputArguments());
        Files.createDirectories(output.toAbsolutePath().getParent());
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(),report);
        System.out.println(status + ": " + algorithm + " windows=" + windows + " output=" + output);
        if (!completed) System.exit(2);
    }

    private static void update(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8)); digest.update((byte)'\n');
    }
    private static String sha256(Path file) throws Exception {
        var digest = MessageDigest.getInstance("SHA-256");
        try (var input = Files.newInputStream(file)) { byte[] buffer = new byte[65536]; int n;
            while ((n = input.read(buffer)) >= 0) if (n > 0) digest.update(buffer,0,n);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
