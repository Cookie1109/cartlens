package com.cartlens.window;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Pane;
import com.cartlens.domain.SlidingWindow;
import com.cartlens.mining.MiningSession;

public final class MiningCoordinator implements PaneObserver {
	private final MiningSession session;
	private final SlidingWindowManager windows;
	private final List<MiningResult> results = new ArrayList<>();
	private SlidingWindow latestWindow;

	public MiningCoordinator(MiningSession session, MiningConfig config) {
		this.session = session;
		this.windows = new SlidingWindowManager(config);
	}

	@Override
	public void onPaneArrived(Pane pane) {
		windows.accept(pane).ifPresent(window -> latestWindow = window);
		session.accept(pane).ifPresent(result -> { results.clear(); results.add(result); });
	}

	public Optional<MiningResult> latestResult() {
		return results.isEmpty() ? Optional.empty() : Optional.of(results.getLast());
	}

	public Optional<SlidingWindow> latestWindow() {
		return Optional.ofNullable(latestWindow);
	}

	public List<MiningResult> results() {
		return List.copyOf(results);
	}
}
