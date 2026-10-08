package com.cartlens.ingestion;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import com.cartlens.domain.*;
import com.cartlens.service.TwuCalculator;

/** Utility is a product w*q, not an original quantity or an investment-based weight. */
public final class ChainstoreReader implements AutoCloseable {
    public enum WeightMode { PROVIDED_UTILITY, SYNTHETIC_BATCH }
    private final BufferedReader input;
    private final Map<String, BigDecimal> investments;
    private final WeightMode mode;
    private final int batchSize;
    private final long seed;
    private long line;

    public ChainstoreReader(Path transactions, Map<String, BigDecimal> investments, WeightMode mode, int batchSize, long seed) throws IOException {
        this.input = Files.newBufferedReader(transactions, StandardCharsets.UTF_8);
        this.investments = investments; this.mode = mode; this.batchSize = batchSize; this.seed = seed;
        if (batchSize < 1) throw new IllegalArgumentException("batchSize phải dương");
    }

    public Transaction next() throws IOException {
        String text = input.readLine();
        if (text == null) return null;
        line++;
        try { return parse(text, line, investments, mode, batchSize, seed); }
        catch (IllegalArgumentException error) { throw new IllegalArgumentException("Chainstore dòng " + line + ": " + error.getMessage(), error); }
    }
    public void skip(long lines) throws IOException {
        while (line < lines) { if (input.readLine() == null) throw new IOException("Checkpoint vượt quá cuối file"); line++; }
    }
    public long line() { return line; }
    @Override public void close() throws IOException { input.close(); }

    public static Transaction parse(String text, long line, Map<String, BigDecimal> investments, WeightMode mode, int batchSize, long seed) {
        var parts = text.trim().split(":", -1);
        if (parts.length != 3 || parts[0].isBlank() || parts[2].isBlank()) throw new IllegalArgumentException("Cần items:totalUtility:itemUtilities");
        var ids = parts[0].trim().split("\\s+"); var values = parts[2].trim().split("\\s+");
        if (ids.length != values.length) throw new IllegalArgumentException("Số item khác số utility");
        BigDecimal total = new BigDecimal(parts[1].trim()), sum = BigDecimal.ZERO;
        var items = new ArrayList<TransactionItem>(ids.length); var unique = new HashSet<String>();
        for (int i = 0; i < ids.length; i++) {
            if (!ids[i].matches("[1-9][0-9]*") || !unique.add(ids[i])) throw new IllegalArgumentException("Item ID không hợp lệ hoặc trùng: " + ids[i]);
            if (!investments.containsKey(ids[i])) throw new IllegalArgumentException("Thiếu investment metadata cho item " + ids[i]);
            BigDecimal utility = new BigDecimal(values[i]);
            if (utility.signum() < 0) throw new IllegalArgumentException("Utility không được âm");
            sum = sum.add(utility);
            BigDecimal weight = mode == WeightMode.PROVIDED_UTILITY ? utility : BigDecimal.valueOf(batchWeight(seed, (line - 1) / batchSize, ids[i]));
            items.add(new TransactionItem(ids[i], ids[i], 1, weight));
        }
        if (sum.compareTo(total) != 0) throw new IllegalArgumentException("Total utility không bằng tổng item utilities");
        return new Transaction(Long.toString(line), items, new TwuCalculator().calculate(items));
    }

    public static int batchWeight(long seed, long batch, String item) {
        long mixed = seed ^ (batch * 0x9E3779B97F4A7C15L) ^ Long.parseLong(item);
        mixed = (mixed ^ (mixed >>> 30)) * 0xBF58476D1CE4E5B9L;
        mixed = (mixed ^ (mixed >>> 27)) * 0x94D049BB133111EBL;
        return 1 + (int) Math.floorMod(mixed ^ (mixed >>> 31), 10);
    }

    public static Map<String, BigDecimal> investments(Path file) throws IOException {
        var values = new HashMap<String, BigDecimal>();
        try (var reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String line; int number = 0;
            while ((line = reader.readLine()) != null) {
                number++; line = line.trim();
                if (line.isEmpty() || line.startsWith("ItemID") || line.startsWith("=")) continue;
                var fields = line.split("\\s+");
                if (fields.length != 2 || !fields[0].matches("[1-9][0-9]*")) throw new IllegalArgumentException("Investment dòng " + number + " không hợp lệ");
                BigDecimal investment = new BigDecimal(fields[1]);
                if (investment.signum() < 0 || values.putIfAbsent(fields[0], investment) != null) throw new IllegalArgumentException("Investment âm hoặc ID trùng ở dòng " + number);
            }
        }
        if (values.isEmpty()) throw new IllegalArgumentException("Investment metadata rỗng");
        return Map.copyOf(values);
    }
}
