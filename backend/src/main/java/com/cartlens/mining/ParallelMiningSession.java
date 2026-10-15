package com.cartlens.mining;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import com.cartlens.domain.*;
import com.cartlens.mining.ct.*;
import com.cartlens.mining.dwt.*;

/** Two independent structures consume exactly the same immutable pane. Join before advancing. */
public final class ParallelMiningSession {
    private static final ExecutorService WORKERS = new ThreadPoolExecutor(4, 4, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(16), runnable -> {
                var thread = new Thread(runnable, "fwuds-miner"); thread.setDaemon(true); return thread;
            }, new ThreadPoolExecutor.CallerRunsPolicy());
    private final FWUDSCTSession ct;
    private final FWUDSDWTSession dwt;
    private boolean firstWindow = true;
    private double initialCtUpdateMs;
    private double initialDwtUpdateMs;
    private Long initialCtAllocated = 0L;
    private Long initialDwtAllocated = 0L;
    public ParallelMiningSession(MiningConfig config) { ct = new FWUDSCTSession(config); dwt = new FWUDSDWTSession(config); }
    public Pair accept(Pane pane) {
        var left = CompletableFuture.supplyAsync(() -> measure(ct, pane), WORKERS);
        var right = CompletableFuture.supplyAsync(() -> measure(dwt, pane), WORKERS);
        try { CompletableFuture.allOf(left, right).join(); }
        catch (CompletionException error) {
            if (error.getCause() instanceof RuntimeException cause) throw cause;
            throw error;
        }
        var pair = new Pair(left.join(), right.join());
        if (pair.ct().result() == null) {
            initialCtUpdateMs += pair.ct().updateTimeMs() + pair.ct().miningTimeMs();
            initialDwtUpdateMs += pair.dwt().updateTimeMs() + pair.dwt().miningTimeMs();
            initialCtAllocated = addAllocation(initialCtAllocated, pair.ct().allocatedBytes());
            initialDwtAllocated = addAllocation(initialDwtAllocated, pair.dwt().allocatedBytes());
        } else if (firstWindow) {
            firstWindow = false;
            return new Pair(includeInitial(pair.ct(), initialCtUpdateMs, initialCtAllocated),
                    includeInitial(pair.dwt(), initialDwtUpdateMs, initialDwtAllocated));
        }
        return pair;
    }
    private static Long addAllocation(Long a, Long b) { return a == null || b == null ? null : a + b; }
    private static Measurement includeInitial(Measurement value, double updateMs, Long allocation) {
        return new Measurement(value.result(), value.updateTimeMs() + updateMs, value.miningTimeMs(),
                value.retainedBytesEstimate(), addAllocation(value.allocatedBytes(), allocation));
    }
    private Measurement measure(MiningSession session, Pane pane) {
        var bean = java.lang.management.ManagementFactory.getThreadMXBean();
        var allocation = bean instanceof com.sun.management.ThreadMXBean b && b.isThreadAllocatedMemorySupported() ? b : null;
        if (allocation != null && !allocation.isThreadAllocatedMemoryEnabled()) allocation.setThreadAllocatedMemoryEnabled(true);
        long thread = Thread.currentThread().threadId();
        long before = allocation == null ? -1 : allocation.getThreadAllocatedBytes(thread);
        var result = session.accept(pane).orElse(null);
        long after = allocation == null ? -1 : allocation.getThreadAllocatedBytes(thread);
        return new Measurement(result, session.timings().updateNanos() / 1_000_000.0,
                session.timings().miningNanos() / 1_000_000.0, RetainedMemory.estimate(session, result),
                before < 0 || after < 0 ? null : Math.max(0, after - before));
    }
    public Structure ctStructure() {
        return ctStructure(32);
    }
    public Structure fullCtStructure() {
        return ctStructure(Integer.MAX_VALUE);
    }
    private Structure ctStructure(int limit) {
        var store = ct.store(); var rows = new ArrayList<CtRow>();
        var sets = store.oneItemCTsets();
        sets.entrySet().stream().sorted(Map.Entry.comparingByKey()).limit(limit).forEach(entry -> {
            var tids = entry.getValue().values();
            rows.add(new CtRow(entry.getKey(), tids.stream().limit(16).toList(), tids.size(),
                    store.sumTwu().signum() == 0 ? BigDecimal.ZERO : store.twuFor(tids).divide(store.sumTwu(), com.cartlens.service.TwuCalculator.MATH_CONTEXT)));
        });
        IntersectionExample example = null;
        if (rows.size() >= 2) {
            var a = rows.get(0).item(); var b = rows.get(1).item();
            var tids = new CTsetIntersection().intersect(sets.get(a).values(), sets.get(b).values(), store.currentLcTid(),
                    ct.store().transactionCount());
            BigDecimal wus = store.sumTwu().signum() == 0 ? BigDecimal.ZERO : store.twuFor(tids).divide(store.sumTwu(), com.cartlens.service.TwuCalculator.MATH_CONTEXT);
            example = new IntersectionExample(List.of(a, b), tids.stream().limit(8).toList(), tids.size(), wus);
        }
        return new Structure(rows, List.of(), List.of(), sets.size(), 0, store.currentLcTid(), store.sumTwu(), example);
    }
    public Structure dwtStructure() {
        return dwtStructure(64);
    }
    public Structure fullDwtStructure() {
        return dwtStructure(Integer.MAX_VALUE);
    }
    private Structure dwtStructure(int limit) {
        var tree = dwt.tree();
        if (tree == null) return new Structure(List.of(), List.of(), List.of(), 0, 0, 0, BigDecimal.ZERO, null);
        var nodes = new ArrayList<TreeNode>(); var queue = new ArrayDeque<DSWUNNode>(); queue.add(tree.root());
        int total = 0;
        while (!queue.isEmpty()) {
            var node = queue.removeFirst(); total++;
            if (nodes.size() < limit) nodes.add(new TreeNode(node.pre(), node.parent() == null ? null : node.parent().pre(),
                    node.itemId() == null ? "root" : node.itemId(), node.pre(), node.post(), node.weight(), node.transactionCount(), node.children().size()));
            node.children().values().stream().sorted(Comparator.comparingInt(DSWUNNode::pre)).forEach(queue::addLast);
        }
        var tails = tree.tailList().entries().stream().limit(8).map(entry -> new TailRow(entry.transactionId(), entry.transactionTwu(), entry.tailNode().pre())).toList();
        return new Structure(List.of(), nodes, tails, total, tree.tailList().size(), 0, BigDecimal.ZERO, null);
    }
    public record Pair(Measurement ct, Measurement dwt) { }
    public record Measurement(MiningResult result, double updateTimeMs, double miningTimeMs, long retainedBytesEstimate, Long allocatedBytes) { }
    public record CtRow(String item, List<Integer> tids, int support, BigDecimal wus) { }
    public record TreeNode(int id, Integer parentId, String item, int pre, int post, BigDecimal weight, int count, int childCount) { }
    public record TailRow(String transactionId, BigDecimal twu, int nodeId) { }
    public record Structure(List<CtRow> ctsets, List<TreeNode> nodes, List<TailRow> tails, int totalEntries,
            int tailCount, int currentLcTid, BigDecimal sumTwu, IntersectionExample intersection) { }
    public record IntersectionExample(List<String> items, List<Integer> tids, int support, BigDecimal wus) { }
}
