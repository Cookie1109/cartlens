package com.cartlens.mining;

public record MiningTimings(long updateNanos, long miningNanos) {
    public static final MiningTimings ZERO = new MiningTimings(0, 0);
}
