package com.cartlens.ingestion;

import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.api.dto.ReplayRequest;
import com.cartlens.api.dto.ReplayConfigurationRequest;
import com.cartlens.application.*;
import com.cartlens.domain.MiningConfig;
import com.cartlens.infrastructure.*;
import jakarta.annotation.PreDestroy;

@Service
public final class ReplayService {
    private final ChainstoreSource source;
    private final StreamService streams;
    private final ObjectMapper json;
    private final ConcurrentHashMap<String, Job> jobs = new ConcurrentHashMap<>();
    // At most two admitted live jobs; bounded queue accommodates worker handoff on restart.
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(2), runnable -> { var thread = new Thread(runnable, "chainstore-replay"); thread.setDaemon(true); return thread; });
    private volatile boolean shuttingDown;

    public ReplayService(ChainstoreSource source, StreamService streams, ObjectMapper json) {
        this.source = source; this.streams = streams; this.json = json;
    }
    public ChainstoreSource.Description source() { return source.describe(); }

    public synchronized Status start(String id, ReplayRequest request) {
        var state = streams.get(id);
        synchronized (state) {
            if (state.replaying()) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Stream đã có replay.");
            if (state.total() != 0) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Replay mới cần stream rỗng; tạo stream mới hoặc reset.");
            try {
                source.investments(); String fingerprint = source.fingerprint();
                state.configure(request.algorithm(), mining(request));
                var job = new Job(state, request, fingerprint, 0, 0);
                launch(job); return job.status();
            } catch (java.io.IOException error) { throw new IllegalArgumentException("Không đọc được Chainstore: " + error.getMessage()); }
        }
    }

    public Status status(String id) {
        Job job = jobs.get(id);
        String metadata = streams.get(id).replayMetadata();
        if (metadata == null && (job == null || job.terminal())) { if (job != null) jobs.remove(id, job); return null; }
        if (job != null) return job.status();
        try {
            var stored = json.readValue(metadata, Status.class);
            if (stored.runId() == null || stored.configurationVersion() < 1)
                stored = new Status(stored.state(), stored.processedTransactions(), stored.sourceLine(), stored.elapsedMs(), stored.request(), stored.fingerprint(), stored.error(),
                        streams.get(id).configuration().sessionId(), Math.max(1,stored.configurationVersion()), stored.restartPending());
            if (List.of("RUNNING", "PAUSING", "PAUSED", "STOPPING").contains(stored.state()))
                return new Status("RECOVERED", stored.processedTransactions(), stored.sourceLine(), stored.elapsedMs(), stored.request(), stored.fingerprint(),
                        "Phiên trước đã ngừng. Bấm Tiếp tục để khôi phục từ checkpoint.", stored.runId(), stored.configurationVersion(), stored.restartPending());
            return stored;
        } catch (Exception error) { throw new IllegalStateException("Không đọc được checkpoint replay", error); }
    }

    public synchronized Status control(String id, String action) {
        Job job = jobs.get(id);
        if ("resume".equals(action) && (job == null || job.terminal())) {
            Status saved = status(id);
            if (saved == null || !List.of("STOPPED", "RECOVERED").contains(saved.state())) throw new IllegalArgumentException("Không có checkpoint có thể tiếp tục.");
            try {
                if (!source.fingerprint().equals(saved.fingerprint())) throw new IllegalArgumentException("File Chainstore đã đổi; tạo stream mới để tránh sai checkpoint.");
                var state = streams.get(id);
                if (state.total() != saved.sourceLine()) throw new IllegalArgumentException("Stream có giao dịch ngoài checkpoint; tạo stream mới.");
                var settings = state.configuration(); var request = saved.request();
                if (state.failure() != null || settings.algorithm() != request.algorithm() || !settings.config().equals(new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus())))
                    throw new IllegalArgumentException("Cấu hình đã đổi; replay checkpoint cần cấu hình gốc.");
                job = new Job(state, request, saved.fingerprint(), saved.sourceLine(), saved.elapsedMs());
                job.runId = saved.runId() == null ? job.runId : saved.runId(); job.version = Math.max(1, saved.configurationVersion());
                job.restartPending = false; launch(job); return job.status();
            } catch (java.io.IOException error) { throw new IllegalArgumentException(error.getMessage()); }
        }
        if (job == null || job.terminal()) throw new IllegalArgumentException("Replay không đang hoạt động.");
        synchronized (job) {
            switch (action) {
                case "pause" -> { if (!"RUNNING".equals(job.phase)) throw new IllegalArgumentException("Chỉ tạm dừng khi đang chạy."); job.paused = true; job.phase = "PAUSING"; }
                case "resume" -> {
                    if (!"PAUSED".equals(job.phase)) throw new IllegalArgumentException("Chờ stream tạm dừng hoàn toàn.");
                    var settings = job.stream.configuration();
                    if (job.stream.failure() != null || settings.algorithm() != job.request.algorithm() || !settings.config().equals(mining(job.request)))
                        throw new IllegalArgumentException("Áp dụng lại cấu hình hoặc Restart trước khi tiếp tục.");
                    job.paused = false; job.restartPending = false; job.phase = "RUNNING"; job.notifyAll();
                }
                case "stop" -> { job.stopped = true; job.phase = "STOPPING"; job.notifyAll(); }
                default -> throw new IllegalArgumentException("action phải là pause, resume hoặc stop");
            }
            persist(job);
            return job.status();
        }
    }

    private MiningConfig mining(ReplayRequest r) { return new MiningConfig(r.paneSize(), r.windowPaneCount(), r.minWus()); }

    public synchronized Applied apply(String id, ReplayConfigurationRequest update) {
        var request = update.configuration(); var saved = status(id); Job job = jobs.get(id);
        if (saved == null) throw new IllegalArgumentException("Chưa có phiên chạy.");
        if (List.of("RUNNING", "PAUSING", "STOPPING").contains(saved.state()))
            throw new ApplicationException(ErrorCode.STREAM_BUSY, "Tạm dừng và chờ trạng thái Đã tạm dừng trước khi Áp dụng.");
        String fingerprint;
        try { source.investments(); fingerprint = source.fingerprint(); }
        catch (java.io.IOException error) { throw new IllegalArgumentException(error.getMessage()); }
        if (update.mode() == ReplayConfigurationRequest.Mode.RESTART) {
            if (request.algorithm() == com.cartlens.domain.Algorithm.ORACLE || mining(request).windowTransactionCount() > 100_000)
                throw new IllegalArgumentException("Chọn CT/DWT và window tối đa 100.000 giao dịch.");
            if (job != null && !job.terminal()) {
                synchronized (job) { job.stopped = true; job.phase = "STOPPING"; job.notifyAll(); }
                try { if (!job.finished.await(5, TimeUnit.SECONDS)) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Chờ phiên cũ dừng rồi Áp dụng lại."); }
                catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
            }
            var next = streams.create(); next.configure(request.algorithm(), mining(request));
            var replacement = new Job(next, request, fingerprint, 0, 0);
            replacement.paused = true; replacement.phase = "PAUSED"; replacement.restartPending = true;
            launch(replacement); return new Applied(next.id(), replacement.status(), true);
        }
        if (!List.of("PAUSED", "STOPPED", "RECOVERED").contains(saved.state())) throw new IllegalArgumentException("Phiên này cần Restart.");
        var old = saved.request();
        if (old.weightMode() != request.weightMode() || (request.weightMode() == ChainstoreReader.WeightMode.SYNTHETIC_BATCH
                && (old.weightBatchSize() != request.weightBatchSize() || old.seed() != request.seed())))
            throw new IllegalArgumentException("Đổi quy tắc trọng số cần Restart để cả phiên dùng cùng một quy tắc.");
        if (!fingerprint.equals(saved.fingerprint()) || streams.get(id).total() != saved.sourceLine())
            throw new IllegalArgumentException("Nguồn hoặc checkpoint đã đổi; cần Restart.");
        if (request.maxTransactions() != 0 && request.maxTransactions() < saved.sourceLine())
            throw new IllegalArgumentException("Giới hạn giao dịch không được nhỏ hơn checkpoint.");
        if (job == null || job.terminal()) {
            job = new Job(streams.get(id), old, fingerprint, saved.sourceLine(), saved.elapsedMs());
            job.runId = saved.runId() == null ? job.runId : saved.runId(); job.version = Math.max(1, saved.configurationVersion());
            job.paused = true; job.phase = "PAUSED"; job.restartPending = saved.restartPending(); launch(job);
        }
        synchronized (job) {
            if (!job.paused || !"PAUSED".equals(job.phase)) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Chờ stream tạm dừng hoàn toàn.");
            job.stream.configurePausedReplay(request.algorithm(), mining(request));
            job.request = request; job.version++; job.error = null; persist(job);
            return new Applied(id, job.status(), false);
        }
    }

    private void launch(Job job) {
        if (shuttingDown || jobs.values().stream().filter(j -> !j.terminal()).count() >= 2 || !job.stream.startReplay())
            throw new ApplicationException(ErrorCode.STREAM_BUSY, "Tối đa hai replay đồng thời; dừng một replay trước.");
        jobs.entrySet().removeIf(entry -> entry.getValue().terminal());
        jobs.put(job.stream.id(), job);
        persist(job);
        try { workers.execute(() -> run(job)); }
        catch (RejectedExecutionException error) {
            jobs.remove(job.stream.id(), job); job.stream.finishReplay();
            job.phase = "STOPPED"; job.finishedNanos = System.nanoTime(); persist(job); job.finished.countDown();
            throw new ApplicationException(ErrorCode.STREAM_BUSY, "Tối đa hai replay đồng thời; dừng một replay trước.");
        }
    }

    private void run(Job job) {
        try (var reader = new ChainstoreReader(source.transactions(), source.investments(), job.request.weightMode(),
                job.request.weightBatchSize(), job.request.seed())) {
            reader.skip(job.line);
            while (!job.stopped && !shuttingDown) {
                synchronized (job) {
                    while (job.paused && !job.stopped && !shuttingDown) {
                        job.phase = "PAUSED"; persist(job); job.wait(1000);
                    }
                }
                if (job.stopped || shuttingDown) break;
                long tick = System.nanoTime();
                // Small bounded batches. Rate pacing is based on elapsed work, not a timer generating backlog.
                int batchSize = Math.min(job.request.paneSize(), job.request.transactionsPerSecond() == 0 ? 1000
                        : Math.max(1, job.request.transactionsPerSecond() / 10));
                if (job.request.maxTransactions() != 0) batchSize = (int) Math.min(batchSize, job.request.maxTransactions() - job.line);
                if (batchSize <= 0) { job.phase = "COMPLETED"; break; }
                var batch = new ArrayList<com.cartlens.domain.Transaction>(batchSize);
                for (int i = 0; i < batchSize; i++) { var tx = reader.next(); if (tx == null) break; batch.add(tx); }
                if (batch.isEmpty()) { job.phase = "COMPLETED"; break; }
                long before = job.stream.total();
                try {
                    var checkpoint = new Status("RUNNING", job.line + batch.size(), job.line + batch.size(), job.status().elapsedMs(), job.request, job.fingerprint, null, job.runId, job.version, job.restartPending);
                    job.stream.add(batch, json.writeValueAsString(checkpoint));
                }
                finally { job.line += job.stream.total() - before; }
                synchronized (job) { if (!job.paused && !job.stopped) job.phase = "RUNNING"; persist(job); }
                int rate = job.request.transactionsPerSecond();
                if (rate > 0) {
                    long remaining = batch.size() * 1_000_000_000L / rate - (System.nanoTime() - tick);
                    synchronized (job) {
                        if (remaining > 0 && !job.paused && !job.stopped) job.wait(Math.max(1, remaining / 1_000_000));
                    }
                }
            }
            if (!"COMPLETED".equals(job.phase)) job.phase = shuttingDown ? "RECOVERED" : "STOPPED";
        } catch (Exception error) { job.phase = "FAILED"; job.error = StreamState.message(error); }
        finally { job.finishedNanos = System.nanoTime(); persist(job); job.stream.finishReplay(); job.finished.countDown(); }
    }

    private void persist(Job job) {
        try { job.stream.replayMetadata(json.writeValueAsString(job.status())); }
        catch (Exception error) { job.error = "Không lưu được checkpoint: " + StreamState.message(error); job.phase = "FAILED"; job.stopped = true; }
    }

    @PreDestroy public void close() {
        shuttingDown = true; jobs.values().forEach(job -> { synchronized (job) { job.notifyAll(); } }); workers.shutdown();
        try { workers.awaitTermination(30, TimeUnit.SECONDS); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    private static final class Job {
        final StreamState stream; volatile ReplayRequest request; final String fingerprint;
        String runId = UUID.randomUUID().toString(); int version = 1; boolean restartPending;
        final CountDownLatch finished = new CountDownLatch(1);
        final long started = System.nanoTime(); final double priorElapsed;
        volatile long line; volatile String phase = "RUNNING"; volatile String error;
        volatile long finishedNanos;
        volatile boolean paused; volatile boolean stopped;
        Job(StreamState stream, ReplayRequest request, String fingerprint, long line, double priorElapsed) {
            this.stream = stream; this.request = request; this.fingerprint = fingerprint; this.line = line; this.priorElapsed = priorElapsed;
        }
        synchronized Status status() { return new Status(phase, line, line, priorElapsed + ((finishedNanos == 0 ? System.nanoTime() : finishedNanos) - started) / 1_000_000.0, request, fingerprint, error, runId, version, restartPending); }
        boolean terminal() { return finished.getCount() == 0; }
    }
    public record Status(String state, long processedTransactions, long sourceLine, double elapsedMs,
            ReplayRequest request, String fingerprint, String error, String runId, int configurationVersion, boolean restartPending) { }
    public record Applied(String streamId, Status replay, boolean restarted) { }
}
