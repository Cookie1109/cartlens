package com.cartlens.verification;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Pattern;
import com.cartlens.domain.PatternResult;

public final class ResultComparator {
	private static final BigDecimal WUS_TOLERANCE = new BigDecimal("1E-30");

	public Comparison compare(MiningResult expected, MiningResult actual) {
		var differences = new ArrayList<String>();
		if (expected.windowId() != actual.windowId()) {
			differences.add("windowId expected=" + expected.windowId() + " actual=" + actual.windowId());
		}
		var expectedByPattern = index(expected.patterns());
		var actualByPattern = index(actual.patterns());
		if (actualByPattern.size() != actual.patterns().size()) differences.add("duplicate patterns");
		for (var entry : expectedByPattern.entrySet()) {
			var actualResult = actualByPattern.get(entry.getKey());
			if (actualResult == null) {
				differences.add("missing pattern " + entry.getKey());
			} else if (!within(entry.getValue().wus(), actualResult.wus(), WUS_TOLERANCE)) {
				differences.add("WUS mismatch " + entry.getKey() + " expected=" + entry.getValue().wus()
						+ " actual=" + actualResult.wus());
			}
			if (actualResult != null && (entry.getValue().support() != actualResult.support()
					|| !entry.getValue().transactionIds().equals(actualResult.transactionIds()))) {
				differences.add("support/transactionIds mismatch " + entry.getKey());
			}
		}
		actualByPattern.keySet().stream().filter(pattern -> !expectedByPattern.containsKey(pattern))
				.forEach(pattern -> differences.add("unexpected pattern " + pattern));
		return new Comparison(differences.isEmpty(), List.copyOf(differences));
	}

	public boolean within(BigDecimal expected, BigDecimal actual, BigDecimal tolerance) {
		return expected.subtract(actual).abs().compareTo(tolerance) <= 0;
	}

	private LinkedHashMap<Pattern, PatternResult> index(List<PatternResult> patterns) {
		var result = new LinkedHashMap<Pattern, PatternResult>();
		patterns.forEach(pattern -> result.put(pattern.pattern(), pattern));
		return result;
	}

	public record Comparison(boolean equivalent, List<String> differences) {
	}
}
