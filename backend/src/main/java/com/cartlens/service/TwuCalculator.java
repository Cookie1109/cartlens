package com.cartlens.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.List;

import com.cartlens.domain.TransactionItem;

public final class TwuCalculator {
	public static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;

	public BigDecimal calculate(List<TransactionItem> items) {
		if (items == null || items.isEmpty()) {
			throw new IllegalArgumentException("transaction must contain at least one item");
		}
		BigDecimal weightedQuantity = items.stream()
				.map(item -> item.weight().multiply(BigDecimal.valueOf(item.quantity()), MATH_CONTEXT))
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		return weightedQuantity.divide(BigDecimal.valueOf(items.size()), MATH_CONTEXT);
	}
}
