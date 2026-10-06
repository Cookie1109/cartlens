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
import com.cartlens.domain.SlidingWindow;
import com.cartlens.mining.MiningSession;
import com.cartlens.service.TwuCalculator;
import com.cartlens.window.SlidingWindowManager;

public final class FWUDSCTSession implements MiningSession {
	private final MiningConfig config;
	private final SlidingWindowManager windows;
	private final CTsetStore store;
	private final CTsetIntersection intersection = new CTsetIntersection();
	private int acceptedPanes;

	public FWUDSCTSession(MiningConfig config) {
		this.config = config;
		this.windows = new SlidingWindowManager(config);
		this.store = new CTsetStore(config);
	}

	@Override
	public Optional<MiningResult> accept(Pane completedPane) {
		if (completedPane.transactions().size() != config.paneSize()) {
			throw new IllegalArgumentException("only completed panes may be mined");
		}
		if (acceptedPanes < config.windowPaneCount()) {
			store.insert(completedPane);
		} else {
			store.update(completedPane);
		}
		acceptedPanes++;
		return windows.accept(completedPane).map(this::mine);
	}

	private MiningResult mine(SlidingWindow window) {
		long started = System.nanoTime();
		var frequentItems = store.oneItemCTsets().entrySet().stream()
				.filter(entry -> wus(entry.getValue().values()).compareTo(config.minWus()) >= 0)
				.sorted(MapEntryComparator.INSTANCE).toList();
		var results = new ArrayList<PatternResult>();
		for (int index = 0; index < frequentItems.size(); index++) {
			var entry = frequentItems.get(index);
			var prefix = List.of(entry.getKey());
			addResult(prefix, entry.getValue().values(), results);
			mineExtensions(prefix, entry.getValue().values(), index + 1, frequentItems, results);
		}
		return new MiningResult(window.windowId(), Algorithm.FWUDS_CT, config, results,
				(System.nanoTime() - started) / 1_000_000, window.transactions().size());
	}

	private void mineExtensions(List<String> prefix, List<Integer> prefixTidset, int start,
			List<java.util.Map.Entry<String, CircularTidset>> frequentItems, List<PatternResult> results) {
		for (int index = start; index < frequentItems.size(); index++) {
			var entry = frequentItems.get(index);
			var candidateTidset = intersection.intersect(prefixTidset, entry.getValue().values(),
					store.currentLcTid(), config.windowTransactionCount());
			if (wus(candidateTidset).compareTo(config.minWus()) < 0) {
				continue;
			}
			var candidate = new ArrayList<>(prefix);
			candidate.add(entry.getKey());
			addResult(candidate, candidateTidset, results);
			mineExtensions(candidate, candidateTidset, index + 1, frequentItems, results);
		}
	}

	private void addResult(List<String> items, List<Integer> tids, List<PatternResult> results) {
		results.add(new PatternResult(new Pattern(items), wus(tids), tids.size(), store.transactionIdsFor(tids)));
	}

	private BigDecimal wus(List<Integer> tids) {
		return store.twuFor(tids).divide(store.sumTwu(), TwuCalculator.MATH_CONTEXT);
	}

	public CTsetStore store() {
		return store;
	}

	private enum MapEntryComparator implements Comparator<java.util.Map.Entry<String, CircularTidset>> {
		INSTANCE;

		@Override
		public int compare(java.util.Map.Entry<String, CircularTidset> left,
				java.util.Map.Entry<String, CircularTidset> right) {
			return left.getKey().compareTo(right.getKey());
		}
	}
}
