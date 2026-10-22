package com.cartlens.mining;

import java.math.BigDecimal;
import java.util.*;
import com.cartlens.domain.*;

/** Per-session, bounded capture. Never retains tidsets, trees, WUNLists or transaction IDs. */
public final class MiningAudit {
    public static final int SAMPLE_LIMIT = 48;
    private final List<Sample> samples = new ArrayList<>(SAMPLE_LIMIT);
    private final boolean capture;
    private long evaluated;
    private long accepted;
    private int singletonSamples;
    private BigDecimal previousSum = BigDecimal.ZERO;
    private BigDecimal incoming = BigDecimal.ZERO;

    public MiningAudit() { this(true); }
    public MiningAudit(boolean capture) { this.capture = capture; }

    public void begin(BigDecimal previousSum, Pane pane) {
        samples.clear(); evaluated = 0; accepted = 0; singletonSamples = 0;
        this.previousSum = previousSum;
        incoming = pane.transactions().stream().map(Transaction::twu).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    public boolean hasRoom() { return capture && samples.size() < SAMPLE_LIMIT; }
    public boolean hasRoom(String operation) {
        // Leave space for actual joins even when the window contains thousands of singletons.
        return hasRoom() && (!operation.endsWith("SINGLETON") || singletonSamples < 16);
    }
    public void count(boolean kept) { evaluated++; if (kept) accepted++; }
    public void sample(String operation, List<String> items, BigDecimal numerator, BigDecimal wus,
            boolean kept, Integer support, int leftSize, int rightSize, int outputSize,
            List<String> evidence, BigDecimal pruningBound) {
        if (!hasRoom(operation)) return;
        if (operation.endsWith("SINGLETON")) singletonSamples++;
        var labels = items.stream().limit(24).map(s -> s.length() > 96 ? s.substring(0, 96) + "…" : s).toList();
        samples.add(new Sample(operation, labels, items.size() > 24 || items.stream().anyMatch(s -> s.length() > 96),
                numerator, wus, kept, support, leftSize, rightSize, outputSize, List.copyOf(evidence), pruningBound));
    }
    public Snapshot snapshot(Algorithm algorithm, long windowId, MiningConfig config, BigDecimal sum, int lcTid, int patterns) {
        return new Snapshot(algorithm, windowId, config, sum, previousSum, incoming, previousSum.add(incoming).subtract(sum),
                lcTid, windowId == 1, evaluated, accepted, evaluated - accepted, patterns, SAMPLE_LIMIT,
                evaluated - samples.size(), List.copyOf(samples));
    }
    public record Sample(String operation, List<String> items, boolean itemsTruncated, BigDecimal numerator,
            BigDecimal wus, boolean accepted, Integer support, int leftSize, int rightSize, int outputSize,
            List<String> evidence, BigDecimal pruningBound) { }
    public record Snapshot(Algorithm algorithm, long windowId, MiningConfig config, BigDecimal sumTwu,
            BigDecimal previousSumTwu, BigDecimal incomingTwu, BigDecimal expiredTwu, int currentLcTid, boolean initialWindow,
            long evaluatedCandidates, long acceptedCandidates, long prunedCandidates, int patternCount,
            int sampleLimit, long omittedCandidates, List<Sample> samples) {
        public Snapshot atWindow(long adjustedWindowId) {
            return new Snapshot(algorithm, adjustedWindowId, config, sumTwu, previousSumTwu, incomingTwu, expiredTwu,
                    currentLcTid, initialWindow, evaluatedCandidates, acceptedCandidates, prunedCandidates, patternCount,
                    sampleLimit, omittedCandidates, samples);
        }
    }
}
