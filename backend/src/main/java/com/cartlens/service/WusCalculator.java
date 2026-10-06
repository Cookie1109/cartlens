package com.cartlens.service;

import java.math.BigDecimal;
import java.util.List;

import com.cartlens.domain.Pattern;
import com.cartlens.domain.PatternResult;
import com.cartlens.domain.Transaction;

public final class WusCalculator {
	public BigDecimal sumTwu(List<Transaction> transactions) {
		return transactions.stream().map(Transaction::twu)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public PatternResult calculate(Pattern pattern, List<Transaction> transactions) {
		BigDecimal denominator = sumTwu(transactions);
		if (denominator.signum() <= 0) {
			throw new IllegalArgumentException("sumTwu(window) must be positive");
		}
		List<Transaction> containing = transactions.stream().filter(transaction -> transaction.contains(pattern)).toList();
		BigDecimal numerator = containing.stream().map(Transaction::twu)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		return new PatternResult(pattern, numerator.divide(denominator, TwuCalculator.MATH_CONTEXT),
				containing.size(), containing.stream().map(Transaction::id).toList());
	}
}
