package com.cartlens.window;

import java.util.ArrayDeque;
import java.util.Optional;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pane;
import com.cartlens.domain.SlidingWindow;
import com.cartlens.service.WusCalculator;

public final class SlidingWindowManager {
	private final MiningConfig config;
	private final ArrayDeque<Pane> panes = new ArrayDeque<>();
	private final WusCalculator wusCalculator = new WusCalculator();
	private long windowId;

	public SlidingWindowManager(MiningConfig config) {
		this.config = config;
	}

	public Optional<SlidingWindow> accept(Pane pane) {
		if (pane.transactions().size() != config.paneSize()) {
			throw new IllegalArgumentException("only completed panes may enter the sliding window");
		}
		panes.addLast(pane);
		if (panes.size() < config.windowPaneCount()) {
			return Optional.empty();
		}
		if (panes.size() > config.windowPaneCount()) {
			panes.removeFirst();
		}
		windowId++;
		var snapshot = panes.stream().toList();
		var transactions = snapshot.stream().flatMap(value -> value.transactions().stream()).toList();
		return Optional.of(new SlidingWindow(windowId, snapshot, config.paneSize(), config.windowPaneCount(),
				wusCalculator.sumTwu(transactions)));
	}

	public int paneCount() {
		return panes.size();
	}
}
