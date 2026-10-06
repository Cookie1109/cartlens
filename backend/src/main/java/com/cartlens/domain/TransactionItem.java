package com.cartlens.domain;

import java.math.BigDecimal;
import java.util.Objects;

public record TransactionItem(String itemId, String name, int quantity, BigDecimal weight) {
	public TransactionItem {
		itemId = requireText(itemId, "itemId");
		name = name == null || name.isBlank() ? itemId : name.trim();
		if (quantity <= 0) {
			throw new IllegalArgumentException("quantity must be a positive integer");
		}
		Objects.requireNonNull(weight, "weight must not be null");
		if (weight.signum() < 0) {
			throw new IllegalArgumentException("weight must be non-negative");
		}
	}

	private static String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
		return value.trim();
	}
}
