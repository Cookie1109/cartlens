import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import com.cartlens.domain.*;
import com.cartlens.mining.*;

/** Run: java -Xmx512m --class-path backend/target/classes docs/reviews/probes/AuditLogProbe.java */
public class AuditLogProbe {
    private record Run(double elapsedMs, long allocatedBytes, long auditBytes, long hash, int windows) { }
    public static void main(String[] args) throws Exception {
        var dense = panes(true); var sparse = panes(false);
        // Warm both code paths before alternating measured runs.
        for (int i = 0; i < 3; i++) { run(dense, false); run(dense, true); }
        System.out.println("scenario,capture,medianMs,medianAllocatedBytes,maxAuditBytes,windows,fingerprint");
        for (var scenario : List.of("dense", "sparse")) {
            var input = scenario.equals("dense") ? dense : sparse;
            var off = new ArrayList<Run>(); var on = new ArrayList<Run>();
            for (int i = 0; i < 7; i++) {
                if ((i & 1) == 0) { off.add(run(input, false)); on.add(run(input, true)); }
                else { on.add(run(input, true)); off.add(run(input, false)); }
                if (off.getLast().hash() != on.getLast().hash()) throw new AssertionError("Audit changed results");
            }
            print(scenario, false, off); print(scenario, true, on);
        }
        var callers = Executors.newFixedThreadPool(4);
        try {
            var jobs = new ArrayList<Callable<Run>>();
            for (int i = 0; i < 4; i++) jobs.add(() -> run(dense, true));
            var results = callers.invokeAll(jobs);
            long hash = results.getFirst().get().hash();
            for (var result : results) if (result.get().hash() != hash || result.get().windows() != 51)
                throw new AssertionError("Concurrent streams diverged");
            System.out.println("concurrentStreams=4; completedWindows=204; identicalResults=true; heapLimitMiB=512");
        } finally { callers.shutdownNow(); }
    }
    private static void print(String scenario, boolean capture, List<Run> values) {
        var times = values.stream().mapToDouble(Run::elapsedMs).sorted().toArray();
        var allocation = values.stream().mapToLong(Run::allocatedBytes).sorted().toArray();
        System.out.printf(Locale.ROOT, "%s,%s,%.3f,%d,%d,%d,%d%n", scenario, capture, times[times.length / 2],
                allocation[allocation.length / 2], values.stream().mapToLong(Run::auditBytes).max().orElseThrow(),
                values.getFirst().windows(), values.getFirst().hash());
    }
    private static Run run(List<Pane> panes, boolean capture) {
        var session = new ParallelMiningSession(new MiningConfig(8, 16, new BigDecimal("0.2")), capture);
        long nanos = 0, allocated = 0, bytes = 0, hash = 1; int windows = 0;
        for (var pane : panes) {
            long start = System.nanoTime(); var pair = session.accept(pane); nanos += System.nanoTime() - start;
            if (pair.ct().result() == null) continue;
            allocated += pair.ct().allocatedBytes() + pair.dwt().allocatedBytes();
            if (!pair.ct().result().patterns().equals(pair.dwt().result().patterns())) throw new AssertionError("CT/DWT mismatch");
            hash = hash * 31 + pair.ct().result().patterns().hashCode(); windows++;
            bytes = Math.max(bytes, RetainedMemory.estimate(session.ctAudit(pair.ct().result()), session.dwtAudit(pair.dwt().result())));
        }
        return new Run(nanos / 1e6, allocated, bytes, hash, windows);
    }
    private static List<Pane> panes(boolean dense) {
        var panes = new ArrayList<Pane>(); var random = new Random(42);
        for (int p = 0; p < 66; p++) {
            var txs = new ArrayList<Transaction>();
            for (int t = 0; t < 8; t++) {
                var items = new ArrayList<TransactionItem>();
                for (int i = 0; i < 10; i++) if (dense || i == 0 || random.nextDouble() < 0.55)
                    items.add(new TransactionItem("I" + i, "I" + i, 1, BigDecimal.ONE));
                txs.add(new Transaction("t" + (p * 8 + t), items, BigDecimal.ONE));
            }
            panes.add(new Pane(p + 1, txs));
        }
        return panes;
    }
}
