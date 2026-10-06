package com.cartlens.domain;

import java.util.List;

public record Pane(long paneId, List<Transaction> transactions) {
	public Pane {
		if (paneId <= 0) {
			throw new IllegalArgumentException("paneId must be positive");
		}
		transactions = List.copyOf(transactions == null ? List.of() : transactions);
		if (transactions.isEmpty()) {
			throw new IllegalArgumentException("pane must contain transactions");
		}
	}
}
