package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

public final class FWUDSDWTSession implements MiningSession {
	private final MiningConfig config;
	private final SlidingWindowManager windows;
	private final List<Pane> initialPanes = new ArrayList<>();
	private final WUNListIntersection intersection = new WUNListIntersection();
	private DSWUNTree tree;

	public FWUDSDWTSession(MiningConfig config) {
		this.config = config;
		this.windows = new SlidingWindowManager(config);
	}

	@Override
	public Optional<MiningResult> accept(Pane completedPane) {
		if (completedPane.transactions().size() != config.paneSize()) {
			throw new IllegalArgumentException("only completed panes may be mined");
		}
		Optional<SlidingWindow> snapshot = windows.accept(completedPane);
		if (tree == null) {
			initialPanes.add(completedPane);
			if (snapshot.isEmpty()) {
				return Optional.empty();
			}
			List<String> treeOrder = itemOrder(snapshot.orElseThrow());
			tree = new DSWUNTree(treeOrder);
			initialPanes.forEach(tree::insert);
		} else {
			tree.update(completedPane, config.paneSize());
		}
		return snapshot.map(this::mine);
	}

	private MiningResult mine(SlidingWindow window) {
		long started = System.nanoTime();
		List<String> miningOrder = itemOrder(window);
		Map<String, WUNList> singletonLists = new HashMap<>();
		for (String item : miningOrder) {
			singletonLists.put(item, tree.wunList(item));
		}
		var frequentItems = miningOrder.stream()
				.filter(item -> singletonLists.get(item).wus(window.sumTwu()).compareTo(config.minWus()) >= 0).toList();
		var results = new ArrayList<PatternResult>();
		for (int index = 0; index < frequentItems.size(); index++) {
			String item = frequentItems.get(index);
			addResult(List.of(item), singletonLists.get(item), window, results);
			mineExtensions(List.of(item), index + 1, frequentItems, singletonLists, window, results);
		}
		return new MiningResult(window.windowId(), Algorithm.FWUDS_DWT, config, results,
				(System.nanoTime() - started) / 1_000_000, window.transactions().size());
	}

	private void mineExtensions(List<String> prefix, int start, List<String> frequentItems,
			Map<String, WUNList> singletonLists, SlidingWindow window, List<PatternResult> results) {
		for (int index = start; index < frequentItems.size(); index++) {
			var items = new ArrayList<>(prefix);
			items.add(frequentItems.get(index));
			Optional<WUNList> joined = intersectPattern(items, singletonLists, window);
			if (joined.isPresent()) {
				addResult(items, joined.orElseThrow(), window, results);
				mineExtensions(List.copyOf(items), index + 1, frequentItems, singletonLists, window, results);
			}
		}
	}

	private Optional<WUNList> intersectPattern(List<String> items, Map<String, WUNList> singletonLists,
			SlidingWindow window) {
		List<String> treeOrdered = items.stream()
				.sorted(Comparator.comparingInt(tree::rank).reversed().thenComparing(Comparator.naturalOrder()))
				.toList();
		WUNList joined = singletonLists.get(treeOrdered.getFirst());
		for (int index = 1; index < treeOrdered.size(); index++) {
			Optional<WUNList> next = intersection.intersect(joined, singletonLists.get(treeOrdered.get(index)),
					config.minWus(), window.sumTwu());
			if (next.isEmpty()) {
				return Optional.empty();
			}
			joined = next.orElseThrow();
		}
		return Optional.of(joined);
	}

	private void addResult(List<String> items, WUNList list, SlidingWindow window, List<PatternResult> results) {
		Pattern pattern = new Pattern(items);
		List<String> transactionIds = window.transactions().stream().filter(transaction -> transaction.contains(pattern))
				.map(transaction -> transaction.id()).toList();
		results.add(new PatternResult(pattern, list.wus(window.sumTwu()), transactionIds.size(), transactionIds));
	}

	private List<String> itemOrder(SlidingWindow window) {
		var weightByItem = new HashMap<String, BigDecimal>();
		for (var transaction : window.transactions()) {
			for (var item : transaction.items()) {
				weightByItem.merge(item.itemId(), transaction.twu(),
						BigDecimal::add);
			}
		}
		return weightByItem.keySet().stream()
				.sorted(Comparator.<String, BigDecimal>comparing(weightByItem::get).reversed()
						.thenComparing(Comparator.naturalOrder()))
				.toList();
	}

	public DSWUNTree tree() { return tree; }

}
