package com.cartlens.mining;

import com.cartlens.domain.MiningConfig;

/** Fail explicitly instead of truncating the mathematically complete result or exhausting the JVM. */
public final class MiningBudget {
    public static final int MAX_PATTERNS = Integer.getInteger("cartlens.max-patterns", 100_000);
    private long transactionReferences;
    public MiningBudget() { }
    public void checkTransactionReferences(int count) {
        transactionReferences += count;
        if (transactionReferences > Long.getLong("cartlens.max-result-transactions", 1_000_000L))
            throw new IllegalArgumentException("Kết quả chứa quá nhiều transaction IDs. Tăng minWus hoặc giảm window; không trả kết quả bị cắt.");
    }
    public static void checkPatternCount(int count) {
        if (count >= MAX_PATTERNS) throw new IllegalArgumentException(
                "Kết quả vượt giới hạn " + MAX_PATTERNS + " pattern/window. Tăng minWus hoặc giảm window; không trả kết quả bị cắt.");
    }
    public static void checkZeroThreshold(MiningConfig config, int itemCount) {
        if (config.minWus().signum() == 0 && itemCount > 16)
            throw new IllegalArgumentException("minWus=0 sinh mọi tập con; chỉ hỗ trợ tối đa 16 item ở ngưỡng này.");
    }
}
