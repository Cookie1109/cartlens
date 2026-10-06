package com.cartlens.mining.dwt;

import java.math.BigDecimal;

public record TailEntry(String transactionId, BigDecimal transactionTwu, DSWUNNode tailNode) {
	public TailEntry {
		if (transactionId == null || transactionTwu == null || tailNode == null) {
			throw new IllegalArgumentException("tail entry fields are required");
		}
	}
}
