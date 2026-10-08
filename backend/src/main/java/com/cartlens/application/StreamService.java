package com.cartlens.application;

import java.util.*;
import org.springframework.stereotype.Service;
import com.cartlens.domain.*;
import com.cartlens.infrastructure.*;
import com.cartlens.mining.ct.FWUDSCTStrategy;
import com.cartlens.mining.dwt.FWUDSDWTStrategy;
import com.cartlens.service.MiningService;
import com.cartlens.verification.*;

@Service
public class StreamService {
    private final StreamStore store;
    private final MiningService mining = new MiningService();
    public StreamService(StreamStore store) { this.store = store; }
    public StreamState create() { return store.create(); }
    public StreamState get(String id) { return store.require(id); }
    public List<StreamArchive.Metadata> streams() { return store.streams(); }
    public Transaction add(String id, Transaction tx) {
        var state = get(id);
        synchronized (state) {
            if (state.replaying()) throw new ApplicationException(ErrorCode.STREAM_BUSY, "Dừng replay trước khi thêm thủ công.");
            state.add(List.of(tx));
        }
        return tx;
    }
    public void reset(String id) { get(id).clear(); }
    public StreamState configure(String id, Algorithm algorithm, MiningConfig config) {
        var state = get(id); state.configure(algorithm, config); return state;
    }
    public RunView run(String id, Algorithm algorithm, MiningConfig config) {
        var state = configure(id, algorithm, config);
        var latest = state.latest(algorithm);
        if (latest == null) throw new ApplicationException(ErrorCode.WINDOW_NOT_READY, "Cửa sổ chưa đủ số pane để khai phá; cấu hình đã được lưu.");
        return new RunView(id, latest.runId(), latest.result());
    }
    public RunView latest(String id, Algorithm algorithm) {
        var state = get(id); var record = algorithm == null ? state.latestAny() : state.latest(algorithm);
        if (record == null) throw new ApplicationException(ErrorCode.RESULT_NOT_FOUND, "Chưa có kết quả khai phá phù hợp.");
        return new RunView(id, record.runId(), record.result());
    }
    public ComparisonView compare(String id, MiningConfig config) {
        if (config.windowTransactionCount()>100_000) throw new IllegalArgumentException("Window tối đa 100.000 giao dịch.");
        var state = get(id);
        long complete = state.total() - state.total() % config.paneSize();
        if (complete < config.windowTransactionCount()) throw new ApplicationException(ErrorCode.WINDOW_NOT_READY, "Cửa sổ chưa đủ số pane.");
        var transactions = new ArrayList<Transaction>(); long start = complete - config.windowTransactionCount();
        for (long cursor = start; cursor < complete;) {
            var page = state.transactions(cursor, (int) Math.min(1000, complete - cursor)); transactions.addAll(page); cursor += page.size();
        }
        var ct = mining.run(new FWUDSCTStrategy(), transactions, config);
        var dwt = mining.run(new FWUDSDWTStrategy(), transactions, config);
        var distinct = new HashSet<String>(); transactions.forEach(tx -> tx.items().forEach(item -> distinct.add(item.itemId())));
        MiningResult oracle = distinct.size() <= 16 && transactions.size() <= 500 ? new OracleMiner().mine(ct.window(), config) : null;
        var comparator = new ResultComparator();
        var differences = new ArrayList<>(comparator.compare(ct.result(), dwt.result()).differences());
        if (oracle != null) differences.addAll(comparator.compare(oracle, ct.result()).differences());
        long windowId = (complete - config.windowTransactionCount()) / config.paneSize() + 1;
        return new ComparisonView(config, oracle == null ? null : view(id, oracle, windowId), view(id, ct.result(), windowId),
                view(id, dwt.result(), windowId), differences.isEmpty(), List.copyOf(differences), oracle != null);
    }
    private RunView view(String id, MiningResult result, long windowId) {
        return new RunView(id, UUID.randomUUID().toString(), new MiningResult(windowId, result.algorithm(), result.config(),
                result.patterns(), result.executionTimeMs(), result.windowTransactionCount()));
    }
    public record RunView(String streamId, String runId, MiningResult result) { }
    public record ComparisonView(MiningConfig config, RunView oracle, RunView fwudsCt, RunView fwudsDwt,
            boolean equivalent, List<String> differences, boolean oracleVerified) { }
}
