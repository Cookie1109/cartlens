package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.*;
import com.cartlens.service.TwuCalculator;

public final class WUNList {
    private final List<WUNCode> codes;
    private final BigDecimal[] remaining;
    public WUNList(List<WUNCode> codes) { this(normalize(codes), true); }
    private WUNList(List<WUNCode> codes, boolean ordered) {
        this.codes = List.copyOf(codes);
        remaining = new BigDecimal[codes.size() + 1];
        remaining[codes.size()] = BigDecimal.ZERO;
        for (int i = codes.size() - 1; i >= 0; i--) remaining[i] = codes.get(i).weight().add(remaining[i + 1]);
    }
    private static List<WUNCode> normalize(List<WUNCode> codes) {
        var byPre = new LinkedHashMap<Integer, WUNCode>();
        codes.stream().sorted(Comparator.comparingInt(WUNCode::pre)).forEach(code -> byPre.merge(code.pre(), code,
                (left, right) -> new WUNCode(left.pre(),left.post(),left.weight().add(right.weight()))));
        return new ArrayList<>(byPre.values());
    }
    /** Tree preorder and the intersection merge already provide unique increasing pre values. */
    static WUNList ordered(List<WUNCode> codes) { return new WUNList(codes, true); }
    public List<WUNCode> codes() { return codes; }
    public BigDecimal totalWeight() { return remaining[0]; }
    BigDecimal remainingWeight(int index) { return remaining[index]; }
    public BigDecimal wus(BigDecimal sumTwu) { return totalWeight().divide(sumTwu,TwuCalculator.MATH_CONTEXT); }
    public boolean isEmpty() { return codes.isEmpty(); }
}
