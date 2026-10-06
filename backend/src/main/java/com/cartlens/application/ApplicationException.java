package com.cartlens.application;

public final class ApplicationException extends RuntimeException {
	private final ErrorCode code;

	public ApplicationException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode code() {
		return code;
	}
}
