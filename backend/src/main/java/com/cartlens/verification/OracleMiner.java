package com.cartlens.verification;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

import com.cartlens.domain.Algorithm;
import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Pattern;
import com.cartlens.domain.PatternResult;
import com.cartlens.domain.SlidingWindow;
import com.cartlens.service.WusCalculator;

public final class OracleMiner {
	private final WusCalculator wusCalculator = new WusCalculator();

	public MiningResult mine(SlidingWindow window, MiningConfig config) {
		long started = System.nanoTime();
		var items = new TreeSet<String>();
		window.transactions().forEach(transaction -> transaction.items().forEach(item -> items.add(item.itemId())));
		var results = new ArrayList<PatternResult>();
		generate(new ArrayList<>(items), 0, new ArrayList<>(), window, config, results);
		return new MiningResult(window.windowId(), Algorithm.ORACLE, config, results,
				(System.nanoTime() - started) / 1_000_000, window.transactions().size());
	}

	private void generate(List<String> items, int start, List<String> current, SlidingWindow window,
			MiningConfig config, List<PatternResult> results) {
		for (int index = start; index < items.size(); index++) {
			var next = new ArrayList<>(current);
			next.add(items.get(index));
			PatternResult result = wusCalculator.calculate(new Pattern(next), window.transactions());
			if (result.wus().compareTo(config.minWus()) >= 0) {
				results.add(result);
			}
			generate(items, index + 1, next, window, config, results);
		}
	}
}
