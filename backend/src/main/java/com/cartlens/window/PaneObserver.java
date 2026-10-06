package com.cartlens.window;

import com.cartlens.domain.Pane;

@FunctionalInterface
public interface PaneObserver {
	void onPaneArrived(Pane pane);
}
