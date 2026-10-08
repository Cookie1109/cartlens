package com.cartlens.domain;

import java.math.BigDecimal;

public record MiningConfig(int paneSize, int windowPaneCount, BigDecimal minWus) {
	public MiningConfig {
		if (paneSize <= 0) {
			throw new IllegalArgumentException("paneSize must be positive");
		}
		if (windowPaneCount <= 0) {
			throw new IllegalArgumentException("windowPaneCount must be positive");
		}
		if ((long) paneSize * windowPaneCount > Integer.MAX_VALUE) {
			throw new IllegalArgumentException("window transaction count exceeds integer range");
		}
		if (minWus == null || minWus.signum() < 0 || minWus.compareTo(BigDecimal.ONE) > 0) {
			throw new IllegalArgumentException("minWus must be in [0, 1]");
		}
	}

	public int windowTransactionCount() {
		return Math.multiplyExact(paneSize, windowPaneCount);
	}
}
