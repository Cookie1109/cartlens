package com.cartlens.infrastructure;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.cartlens.domain.Algorithm;
import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Transaction;

public final class StreamState {
	private final String id;
	private final List<Transaction> transactions = new ArrayList<>();
	private final Map<Algorithm, RunRecord> latestRuns = new EnumMap<>(Algorithm.class);
	private RunRecord latestRun;

	public StreamState(String id) { this.id = id; }
	public String id() { return id; }
	public synchronized List<Transaction> transactions() { return List.copyOf(transactions); }
	public synchronized void add(Transaction transaction) { transactions.add(transaction); }
	public synchronized boolean containsTransaction(String id) {
		return transactions.stream().anyMatch(transaction -> transaction.id().equalsIgnoreCase(id));
	}
	public synchronized void clear() { transactions.clear(); latestRuns.clear(); latestRun = null; }
	public synchronized void save(RunRecord run) { latestRuns.put(run.result().algorithm(), run); latestRun = run; }
	public synchronized RunRecord latest(Algorithm algorithm) { return latestRuns.get(algorithm); }
	public synchronized RunRecord latestAny() { return latestRun; }

	public record RunRecord(String runId, MiningResult result) { }
}
