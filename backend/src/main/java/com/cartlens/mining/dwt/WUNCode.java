package com.cartlens.mining.dwt;

import java.math.BigDecimal;

public record WUNCode(int pre, int post, BigDecimal weight) {
	public WUNCode {
		if (pre < 0 || post < 0 || weight == null || weight.signum() < 0) {
			throw new IllegalArgumentException("invalid WUN-code");
		}
	}

	public boolean isDescendantOf(WUNCode ancestor) {
		return ancestor.pre < pre && ancestor.post > post;
	}
}
