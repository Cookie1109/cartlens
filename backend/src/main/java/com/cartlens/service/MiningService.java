package com.cartlens.service;

import java.util.List;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.MiningResult;
import com.cartlens.domain.SlidingWindow;
import com.cartlens.domain.Transaction;
import com.cartlens.mining.MiningStrategy;
import com.cartlens.verification.OracleMiner;
import com.cartlens.verification.ResultComparator;
import com.cartlens.window.MiningCoordinator;
import com.cartlens.window.PanePublisher;

public final class MiningService {
	private final OracleMiner oracle = new OracleMiner();
	private final ResultComparator comparator = new ResultComparator();

	public Execution run(MiningStrategy strategy, List<Transaction> transactions, MiningConfig config) {
		var coordinator = new MiningCoordinator(strategy.start(config), config);
		var publisher = new PanePublisher(config.paneSize());
		publisher.subscribe(coordinator);
		transactions.forEach(publisher::publish);
		MiningResult result = coordinator.latestResult().orElseThrow(WindowNotReadyException::new);
		SlidingWindow window = coordinator.latestWindow().orElseThrow(WindowNotReadyException::new);
		return new Execution(result, window, publisher.bufferedTransactionCount());
	}

	public ComparisonExecution compare(MiningStrategy ct, MiningStrategy dwt, List<Transaction> transactions,
			MiningConfig config) {
		Execution ctExecution = run(ct, transactions, config);
		Execution dwtExecution = run(dwt, transactions, config);
		MiningResult oracleResult = oracle.mine(ctExecution.window(), config);
		var ctComparison = comparator.compare(oracleResult, ctExecution.result());
		var dwtComparison = comparator.compare(oracleResult, dwtExecution.result());
		var differences = new java.util.ArrayList<String>();
		differences.addAll(ctComparison.differences().stream().map(value -> "FWUDS_CT: " + value).toList());
		differences.addAll(dwtComparison.differences().stream().map(value -> "FWUDS_DWT: " + value).toList());
		return new ComparisonExecution(config, oracleResult, ctExecution.result(), dwtExecution.result(),
				differences.isEmpty(), List.copyOf(differences));
	}

	public record Execution(MiningResult result, SlidingWindow window, int bufferedTransactionCount) {
	}

	public record ComparisonExecution(MiningConfig config, MiningResult oracle, MiningResult fwudsCt,
			MiningResult fwudsDwt, boolean equivalent, List<String> differences) {
	}

	public static final class WindowNotReadyException extends RuntimeException {
		public WindowNotReadyException() {
			super("Cửa sổ chưa đủ số pane để khai phá.");
		}
	}
}
