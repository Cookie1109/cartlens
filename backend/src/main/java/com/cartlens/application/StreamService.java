package com.cartlens.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.cartlens.domain.Algorithm;
import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Transaction;
import com.cartlens.infrastructure.InMemoryStreamStore;
import com.cartlens.infrastructure.StreamState;
import com.cartlens.mining.MiningStrategy;
import com.cartlens.mining.ct.FWUDSCTStrategy;
import com.cartlens.mining.dwt.FWUDSDWTStrategy;
import com.cartlens.service.MiningService;

@Service
public class StreamService {
	private final InMemoryStreamStore store;
	private final MiningService miningService = new MiningService();

	public StreamService(InMemoryStreamStore store) {
		this.store = store;
	}

	public StreamState create() { return store.create(); }
	public StreamState get(String streamId) { return store.require(streamId); }

	public Transaction add(String streamId, Transaction transaction) {
		StreamState state = store.require(streamId);
		synchronized (state) {
			if (state.containsTransaction(transaction.id())) {
				throw new ApplicationException(ErrorCode.DUPLICATE_TRANSACTION_ID,
						"Mã giao dịch " + transaction.id() + " đã tồn tại.");
			}
			state.add(transaction);
		}
		return transaction;
	}

	public void reset(String streamId) { store.require(streamId).clear(); }

	public RunView run(String streamId, Algorithm algorithm, MiningConfig config) {
		if (algorithm == Algorithm.ORACLE) {
			throw new ApplicationException(ErrorCode.VALIDATION_ERROR, "Run API chỉ hỗ trợ FWUDS_CT hoặc FWUDS_DWT.");
		}
		StreamState state = store.require(streamId);
		try {
			var execution = miningService.run(strategy(algorithm), state.transactions(), config);
			var record = new StreamState.RunRecord(UUID.randomUUID().toString(), execution.result());
			state.save(record);
			return new RunView(streamId, record.runId(), record.result());
		} catch (MiningService.WindowNotReadyException error) {
			throw new ApplicationException(ErrorCode.WINDOW_NOT_READY, error.getMessage());
		}
	}

	public RunView latest(String streamId, Algorithm algorithm) {
		StreamState state = store.require(streamId);
		StreamState.RunRecord record = algorithm == null ? state.latestAny() : state.latest(algorithm);
		if (record == null) {
			throw new ApplicationException(ErrorCode.RESULT_NOT_FOUND, "Chưa có kết quả khai phá phù hợp.");
		}
		return new RunView(streamId, record.runId(), record.result());
	}

	public ComparisonView compare(String streamId, MiningConfig config) {
		StreamState state = store.require(streamId);
		try {
			var comparison = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(),
					state.transactions(), config);
			var ct = new StreamState.RunRecord(UUID.randomUUID().toString(), comparison.fwudsCt());
			var dwt = new StreamState.RunRecord(UUID.randomUUID().toString(), comparison.fwudsDwt());
			state.save(ct);
			state.save(dwt);
			return new ComparisonView(config,
					new RunView(streamId, "oracle-" + UUID.randomUUID(), comparison.oracle()),
					new RunView(streamId, ct.runId(), ct.result()),
					new RunView(streamId, dwt.runId(), dwt.result()), comparison.equivalent(), comparison.differences());
		} catch (MiningService.WindowNotReadyException error) {
			throw new ApplicationException(ErrorCode.WINDOW_NOT_READY, error.getMessage());
		}
	}

	private MiningStrategy strategy(Algorithm algorithm) {
		return switch (algorithm) {
			case FWUDS_CT -> new FWUDSCTStrategy();
			case FWUDS_DWT -> new FWUDSDWTStrategy();
			case ORACLE -> throw new IllegalArgumentException("Oracle is verification-only");
		};
	}

	public record RunView(String streamId, String runId, com.cartlens.domain.MiningResult result) { }
	public record ComparisonView(MiningConfig config, RunView oracle, RunView fwudsCt, RunView fwudsDwt,
			boolean equivalent, List<String> differences) { }
}
