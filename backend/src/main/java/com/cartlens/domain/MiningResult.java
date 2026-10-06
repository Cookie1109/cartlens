package com.cartlens.domain;

import java.util.Comparator;
import java.util.List;

public record MiningResult(long windowId, Algorithm algorithm, MiningConfig config,
		List<PatternResult> patterns, long executionTimeMs, int windowTransactionCount) {
	public MiningResult {
		patterns = patterns == null ? List.of() : patterns.stream()
				.sorted(Comparator.comparing(PatternResult::pattern)).toList();
	}
}
