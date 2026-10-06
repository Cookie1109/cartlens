package com.cartlens.window;

import java.util.ArrayList;
import java.util.List;

import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;

public final class PanePublisher {
	private final int paneSize;
	private final List<Transaction> buffer = new ArrayList<>();
	private final List<PaneObserver> observers = new ArrayList<>();
	private long paneId;

	public PanePublisher(int paneSize) {
		if (paneSize <= 0) {
			throw new IllegalArgumentException("paneSize must be positive");
		}
		this.paneSize = paneSize;
	}

	public void subscribe(PaneObserver observer) {
		observers.add(observer);
	}

	public void publish(Transaction transaction) {
		buffer.add(transaction);
		if (buffer.size() == paneSize) {
			Pane pane = new Pane(++paneId, List.copyOf(buffer));
			buffer.clear();
			observers.forEach(observer -> observer.onPaneArrived(pane));
		}
	}

	public int bufferedTransactionCount() {
		return buffer.size();
	}
}
