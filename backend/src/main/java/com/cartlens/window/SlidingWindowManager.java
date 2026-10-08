package com.cartlens.window;

import java.util.ArrayDeque;
import java.util.Optional;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pane;
import com.cartlens.domain.SlidingWindow;
import java.math.BigDecimal;

public final class SlidingWindowManager {
	private final MiningConfig config;
	private final ArrayDeque<Pane> panes = new ArrayDeque<>();
	private BigDecimal sumTwu = BigDecimal.ZERO;
	private long windowId;

	public SlidingWindowManager(MiningConfig config) {
		this.config = config;
	}

	public Optional<SlidingWindow> accept(Pane pane) {
		if (pane.transactions().size() != config.paneSize()) {
			throw new IllegalArgumentException("only completed panes may enter the sliding window");
		}
		panes.addLast(pane);
		for (var transaction : pane.transactions()) sumTwu = sumTwu.add(transaction.twu());
		if (panes.size() < config.windowPaneCount()) {
			return Optional.empty();
		}
		if (panes.size() > config.windowPaneCount()) {
			for (var transaction : panes.removeFirst().transactions()) sumTwu = sumTwu.subtract(transaction.twu());
		}
		windowId++;
		var snapshot = panes.stream().toList();
		return Optional.of(new SlidingWindow(windowId, snapshot, config.paneSize(), config.windowPaneCount(),
				sumTwu));
	}

	public int paneCount() {
		return panes.size();
	}
}
