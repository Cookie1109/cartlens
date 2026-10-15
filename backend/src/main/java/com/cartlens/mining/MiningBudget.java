package com.cartlens.mining;

import com.cartlens.domain.MiningConfig;

/** Fail explicitly instead of truncating the mathematically complete result or exhausting the JVM. */
public final class MiningBudget {
    public static final int MAX_PATTERNS = Integer.getInteger("cartlens.max-patterns", 100_000);
    private long transactionReferences;
    private long resultStorageBytes;
    public MiningBudget() { }
    public void checkTransactionReferences(int count) {
        transactionReferences += count;
        long limit = Long.getLong("cartlens.max-result-transactions", 1_000_000L);
        if (transactionReferences > limit)
            throw new IllegalArgumentException("Kết quả vượt giới hạn "
                    + java.text.NumberFormat.getIntegerInstance(java.util.Locale.forLanguageTag("vi-VN")).format(limit)
                    + " lượt tham chiếu ID giao dịch/cửa sổ. Tăng minWUS hoặc giảm kích thước cửa sổ; không trả kết quả bị cắt.");
    }
    public void checkResultStorage(long bytes) {
        resultStorageBytes = Math.addExact(resultStorageBytes, bytes);
        if (resultStorageBytes > Long.getLong("cartlens.max-result-storage-bytes", 256L * 1024 * 1024))
            throw new IllegalArgumentException("Compressed result ID storage exceeds budget; increase minWus or reduce window.");
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
