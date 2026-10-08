package com.cartlens.infrastructure;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.application.*;
import com.cartlens.domain.*;
import com.cartlens.mining.*;
import com.cartlens.mining.ct.FWUDSCTStrategy;
import com.cartlens.mining.dwt.FWUDSDWTStrategy;
import com.cartlens.window.*;

/** Single ordered writer; only the live window, partial pane and latest results remain hot. */
public final class StreamState {
    private final String id;
    private final StreamArchive archive;
    private final ObjectMapper json;
    private final Map<Algorithm, RunRecord> latestRuns = new ConcurrentHashMap<>();
    private volatile RunRecord latest;
    private volatile SessionConfiguration configuration;
    private volatile long total;
    private volatile int buffered;
    private volatile int retained;
    private volatile boolean replaying;
    private volatile String failure;
    private volatile long processed;
    private volatile long processingNanos;
    private volatile long archiveNanos;
    private volatile long peakHeapBytes;
    private PanePublisher publisher;
    private long windowOffset;

    public StreamState(StreamArchive.Metadata metadata, StreamArchive archive, ObjectMapper json) {
        this.id = metadata.id(); this.total = metadata.total(); this.archive = archive; this.json = json;
        if (metadata.configuration() != null) {
            try { configuration = json.readValue(metadata.configuration(), SessionConfiguration.class); rebuild(true); }
            catch (Exception error) { failure = message(error); }
        }
    }

    public synchronized void configure(Algorithm algorithm, MiningConfig config) {
        if (replaying) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Tạm dừng và dùng Áp dụng trước khi đổi cấu hình.");
        configureInternal(algorithm, config, false);
    }

    /** Caller must hold the confirmed-paused replay job lock. */
    public synchronized void configurePausedReplay(Algorithm algorithm, MiningConfig config) {
        configureInternal(algorithm, config, true);
    }

    private void configureInternal(Algorithm algorithm, MiningConfig config, boolean currentWindow) {
        if (algorithm == Algorithm.ORACLE) throw new IllegalArgumentException("Oracle chỉ dành cho kiểm chứng.");
        if (config.windowTransactionCount() > 100_000) throw new IllegalArgumentException("Window tối đa 100.000 giao dịch.");
        if (failure == null && configuration != null && configuration.algorithm() == algorithm && configuration.config().equals(config)) return;
        var previous = configuration;
        configuration = new SessionConfiguration(UUID.randomUUID().toString(), algorithm, config);
        latestRuns.clear(); latest = null; failure = null;
        try { archive.configure(id, json.writeValueAsString(configuration)); rebuild(false, currentWindow); }
        catch (Exception error) {
            failure = message(error);
            if (previous != null) {
                configuration = previous;
                try { archive.configure(id, json.writeValueAsString(previous)); rebuild(true); failure = null; }
                catch (Exception rollback) { failure = message(rollback); }
            }
            throw error instanceof RuntimeException r ? r : new IllegalStateException(error);
        }
    }

    private void rebuild(boolean restore) { rebuild(restore, false); }

    private void rebuild(boolean restore, boolean currentWindow) {
        var settings = configuration;
        MiningStrategy strategy = settings.algorithm() == Algorithm.FWUDS_CT ? new FWUDSCTStrategy() : new FWUDSDWTStrategy();
        MiningSession session = strategy.start(settings.config());
        publisher = new PanePublisher(settings.config().paneSize());
        long complete = total - total % settings.config().paneSize();
        long latestWindow = restore ? archive.latestWindow(id, settings.sessionId()) : 0;
        long mined = latestWindow == 0 ? 0 : (latestWindow + settings.config().windowPaneCount() - 1) * settings.config().paneSize();
        long after = currentWindow ? Math.max(0, complete - settings.config().windowTransactionCount())
                : restore ? Math.max(0, mined - settings.config().windowTransactionCount()) : 0;
        windowOffset = after / settings.config().paneSize();
        publisher.subscribe(pane -> session.accept(pane).ifPresent(result -> {
            var adjusted = new MiningResult(result.windowId() + windowOffset, result.algorithm(), result.config(),
                    result.patterns(), result.executionTimeMs(), result.windowTransactionCount());
            save(new RunRecord(settings.sessionId(), adjusted));
        }));
        processed = after; retained = 0; buffered = 0;
        while (after < total) {
            var page = archive.page(id, after, (int) Math.min(1000, total - after));
            for (var transaction : page) process(transaction);
            after += page.size();
        }
    }

    public synchronized void add(List<Transaction> transactions) { add(transactions, null); }

    public synchronized void add(List<Transaction> transactions, String checkpoint) {
        if (failure != null) throw new ApplicationException(ErrorCode.MINING_FAILED, "Phiên mining cần cấu hình lại: " + failure);
        long started = System.nanoTime();
        archive.append(id, total, transactions, checkpoint);
        total += transactions.size(); archiveNanos += System.nanoTime() - started;
        try { for (var tx : transactions) process(tx); }
        catch (RuntimeException error) { failure = message(error); throw error; }
    }

    private void process(Transaction transaction) {
        long started = System.nanoTime();
        publisher.publish(transaction);
        processed++;
        buffered = publisher.bufferedTransactionCount();
        retained = (int) Math.min(processed - buffered, configuration.config().windowTransactionCount()) + buffered;
        processingNanos += System.nanoTime() - started;
        var runtime = Runtime.getRuntime(); peakHeapBytes = Math.max(peakHeapBytes, runtime.totalMemory() - runtime.freeMemory());
    }

    public synchronized void clear() {
        if (replaying) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Dừng replay trước khi reset.");
        Algorithm preservedAlgorithm = configuration != null ? configuration.algorithm() : Algorithm.FWUDS_DWT;
        MiningConfig preservedConfig = configuration != null ? configuration.config() : new MiningConfig(2, 2, new java.math.BigDecimal("0.5"));
        archive.reset(id); total = 0; latestRuns.clear(); latest = null; configuration = null;
        failure = null; processed = 0; processingNanos = 0; archiveNanos = 0; peakHeapBytes = 0;
        configure(preservedAlgorithm, preservedConfig);
    }

    public void save(RunRecord run) { archive.result(id, run); latestRuns.put(run.result().algorithm(), run); latest = run; }
    public String id() { return id; }
    public long total() { return total; }
    public int buffered() { return buffered; }
    public int retained() { return retained; }
    public String failure() { return failure; }
    public SessionConfiguration configuration() { return configuration; }
    public RunRecord latestAny() { return latest; }
    public RunRecord latest(Algorithm algorithm) { return latestRuns.get(algorithm); }
    public synchronized boolean startReplay() { if (replaying) return false; replaying = true; return true; }
    public void finishReplay() { replaying = false; }
    public boolean replaying() { return replaying; }
    public List<Transaction> transactions(long after, int limit) { return archive.page(id, after, limit); }
    public List<RunRecord> results(String session, long after, int limit) { return archive.results(id, session, after, limit); }
    public List<StreamArchive.RunSummary> summaries(String session, long after, int limit) { return archive.summaries(id,session,after,limit); }
    public List<PatternResult> patternPage(String session,long window,int after,int limit) {
        var run=latest;
        if (after<0 || limit<1 || limit>1000) throw new IllegalArgumentException("patternAfter>=0; limit trong [1,1000]");
        if (run!=null && run.runId().equals(session) && run.result().windowId()==window) {
            var patterns=run.result().patterns(); return patterns.subList(Math.min(after,patterns.size()),Math.min(after+limit,patterns.size()));
        }
        return archive.patternPage(id,session,window,after,limit);
    }
    public String replayMetadata() { return archive.metadata(id).replay(); }
    public void replayMetadata(String data) { archive.replay(id, data); }
    public Metrics metrics() { return new Metrics(processed, retained, buffered, processingNanos / 1_000_000.0,
            archiveNanos / 1_000_000.0, peakHeapBytes); }
    public static String message(Throwable error) { return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage(); }
    public record Metrics(long processedTransactions, int retainedTransactions, int bufferedTransactions,
            double processingTimeMs, double archiveTimeMs, long peakHeapBytes) { }
    public record SessionConfiguration(String sessionId, Algorithm algorithm, MiningConfig config) { }
    public record RunRecord(String runId, MiningResult result) { }
}
