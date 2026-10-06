package com.cartlens.domain;

import java.math.BigDecimal;
import java.util.List;

public record SlidingWindow(long windowId, List<Pane> panes, int paneSize, int windowPaneCount, BigDecimal sumTwu) {
	public SlidingWindow {
		panes = List.copyOf(panes);
		if (windowId <= 0 || paneSize <= 0 || windowPaneCount <= 0 || panes.size() != windowPaneCount) {
			throw new IllegalArgumentException("sliding window must be full and have a positive id");
		}
		if (panes.stream().anyMatch(pane -> pane.transactions().size() != paneSize)) {
			throw new IllegalArgumentException("every pane must contain exactly paneSize transactions");
		}
		if (sumTwu == null || sumTwu.signum() <= 0) {
			throw new IllegalArgumentException("sumTwu(window) must be positive");
		}
	}

	public List<Transaction> transactions() {
		return panes.stream().flatMap(pane -> pane.transactions().stream()).toList();
	}
}
