package com.cartlens.domain;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;

public record Transaction(String id, List<TransactionItem> items, BigDecimal twu) {
	public Transaction {
		if (id == null || id.isBlank()) {
			throw new IllegalArgumentException("transaction id must not be blank");
		}
		id = id.trim();
		items = List.copyOf(items == null ? List.of() : items);
		if (items.isEmpty()) {
			throw new IllegalArgumentException("transaction must contain at least one item");
		}
		if (new HashSet<>(items.stream().map(TransactionItem::itemId).toList()).size() != items.size()) {
			throw new IllegalArgumentException("transaction itemId values must be unique");
		}
		if (twu == null || twu.signum() < 0) {
			throw new IllegalArgumentException("twu must be non-negative");
		}
	}

	public boolean contains(Pattern pattern) {
		var itemIds = items.stream().map(TransactionItem::itemId).collect(java.util.stream.Collectors.toSet());
		return itemIds.containsAll(pattern.items());
	}
}
