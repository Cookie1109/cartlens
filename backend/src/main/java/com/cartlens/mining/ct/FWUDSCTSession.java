package com.cartlens.mining.ct;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import com.cartlens.domain.Algorithm;
import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Pane;
import com.cartlens.domain.Pattern;
import com.cartlens.domain.PatternResult;
import com.cartlens.mining.MiningSession;
import com.cartlens.service.TwuCalculator;

public final class FWUDSCTSession implements MiningSession {
	private final MiningConfig config;
	private final CTsetStore store;
	private final CTsetIntersection intersection = new CTsetIntersection();
	private int acceptedPanes;
    private java.util.Map<Pattern, Score> previousScores = java.util.Map.of();
    private java.util.Map<Pattern, Score> currentScores = new java.util.HashMap<>();
    private record Score(BigDecimal numerator, BigDecimal expiringWeight, BigDecimal wus) { }

	private com.cartlens.mining.MiningBudget budget;
	private com.cartlens.mining.MiningTimings timings = com.cartlens.mining.MiningTimings.ZERO;

	public FWUDSCTSession(MiningConfig config) {
		this.config = config;
		this.store = new CTsetStore(config);
	}

	@Override
	public Optional<MiningResult> accept(Pane completedPane) {
		long started = System.nanoTime();
		if (completedPane.transactions().size() != config.paneSize()) {
			throw new IllegalArgumentException("only completed panes may be mined");
		}
		if (acceptedPanes < config.windowPaneCount()) {
			store.insert(completedPane);
		} else {
			store.update(completedPane);
		}
		acceptedPanes++;

		long miningStarted = System.nanoTime();
		Optional<MiningResult> result = acceptedPanes < config.windowPaneCount() ? Optional.empty()
                : Optional.of(mine(acceptedPanes - config.windowPaneCount() + 1L, started));
		timings = new com.cartlens.mining.MiningTimings(miningStarted - started, System.nanoTime() - miningStarted);
		return result;
	}

	private MiningResult mine(long windowId, long started) {
        if (store.sumTwu().signum() <= 0) throw new IllegalArgumentException("sumTwu(window) must be positive");
		budget = new com.cartlens.mining.MiningBudget();
        previousScores = currentScores;
        currentScores = new java.util.HashMap<>();
		var frequentItems = store.oneItemCTsets().entrySet().stream()
                .map(entry -> java.util.Map.entry(entry.getKey(), intersection.prepare(entry.getValue().values(), store.currentLcTid(), config.windowTransactionCount())))
				.filter(entry -> score(List.of(entry.getKey()), entry.getValue()).compareTo(config.minWus()) >= 0)
				.sorted(MapEntryComparator.INSTANCE).toList();
		com.cartlens.mining.MiningBudget.checkZeroThreshold(config, frequentItems.size());
		var results = new ArrayList<PatternResult>();
		for (int index = 0; index < frequentItems.size(); index++) {
			var entry = frequentItems.get(index);
			var prefix = List.of(entry.getKey());
			addResult(prefix, entry.getValue(), score(prefix, entry.getValue()), results);
			mineExtensions(prefix, entry.getValue(), index + 1, frequentItems, results);
		}
		return new MiningResult(windowId, Algorithm.FWUDS_CT, config, results,
				(System.nanoTime() - started) / 1_000_000, config.windowTransactionCount());
	}

	private void mineExtensions(List<String> prefix, List<Integer> prefixTidset, int start,
			List<java.util.Map.Entry<String, List<Integer>>> frequentItems, List<PatternResult> results) {
		for (int index = start; index < frequentItems.size(); index++) {
			var entry = frequentItems.get(index);
			var candidateTidset = intersection.intersect(prefixTidset, entry.getValue(),
					store.currentLcTid(), config.windowTransactionCount());
			var candidate = new ArrayList<>(prefix);
            candidate.add(entry.getKey());
            var score = score(candidate, candidateTidset);
            if (score.compareTo(config.minWus()) < 0) {
				continue;
			}
			addResult(candidate, candidateTidset, score, results);
			mineExtensions(candidate, candidateTidset, index + 1, frequentItems, results);
		}
	}

	private void addResult(List<String> items, List<Integer> tids, BigDecimal score, List<PatternResult> results) {
		com.cartlens.mining.MiningBudget.checkPatternCount(results.size());
		budget.checkTransactionReferences(tids.size());
		var ids = store.transactionIdsFor(tids);
        budget.checkResultStorage(((com.cartlens.domain.TransactionIdList) ids).storageBytes());
        results.add(new PatternResult(new Pattern(items), score, tids.size(), ids));
	}

    private BigDecimal score(List<String> items, List<Integer> tids) {
        var pattern = new Pattern(items);
        Score present = currentScores.get(pattern);
        if (present != null) return present.wus();
        Score previous = previousScores.get(pattern);
        BigDecimal numerator = previous == null ? store.twuFor(tids)
                : previous.numerator().subtract(previous.expiringWeight()).add(store.currentPaneTwuFor(tids));
        BigDecimal wus = numerator.divide(store.sumTwu(), TwuCalculator.MATH_CONTEXT);
        // Bounded cache: missing entries are always recomputed exactly from the current CTset.
        if (currentScores.size() < 100_000)
            currentScores.put(pattern, new Score(numerator, store.nextExpiringPaneTwuFor(tids), wus));
        return wus;
    }

	public CTsetStore store() {
		return store;
	}
	@Override public com.cartlens.mining.MiningTimings timings() { return timings; }

	private enum MapEntryComparator implements Comparator<java.util.Map.Entry<String, List<Integer>>> {
		INSTANCE;

		@Override
		public int compare(java.util.Map.Entry<String, List<Integer>> left,
				java.util.Map.Entry<String, List<Integer>> right) {
			return left.getKey().compareTo(right.getKey());
		}
	}
}
