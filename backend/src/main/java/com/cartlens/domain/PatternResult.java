package com.cartlens.domain;

import java.math.BigDecimal;
import java.util.List;

public record PatternResult(Pattern pattern, BigDecimal wus, int support, List<String> transactionIds) {
	public PatternResult {
		if (pattern == null || wus == null) {
			throw new IllegalArgumentException("pattern and wus are required");
		}
		if (wus.signum() < 0 || wus.compareTo(BigDecimal.ONE) > 0) {
			throw new IllegalArgumentException("wus must be in [0, 1]");
		}
		transactionIds = List.copyOf(transactionIds == null ? List.of() : transactionIds);
		if (support != transactionIds.size()) {
			throw new IllegalArgumentException("support must match transactionIds size");
		}
	}
}
