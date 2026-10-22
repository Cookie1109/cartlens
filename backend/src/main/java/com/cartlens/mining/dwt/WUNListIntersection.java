package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Optional;

public final class WUNListIntersection {
    public Optional<WUNList> intersect(WUNList descendant, WUNList ancestor, BigDecimal minWus, BigDecimal sumTwu) {
        return intersect(descendant, ancestor, minWus, sumTwu, null);
    }
    /** Allocated only for the bounded audit sample, never for the remaining candidates. */
    public static final class Inspection {
        public WUNList joined;
        public BigDecimal pruningBound;
    }
    public Optional<WUNList> intersect(WUNList descendant, WUNList ancestor, BigDecimal minWus, BigDecimal sumTwu, Inspection inspection) {
        // Conservative bound preserves the DECIMAL128 decision at rounded threshold equality.
        BigDecimal minimumWeight = minWus.multiply(sumTwu).subtract(sumTwu.scaleByPowerOfTen(-33));
        BigDecimal matchedWeight = BigDecimal.ZERO;
        var result = new ArrayList<WUNCode>();
        int descendantIndex = 0, ancestorIndex = 0;
        while (descendantIndex < descendant.codes().size() && ancestorIndex < ancestor.codes().size()) {
            WUNCode d = descendant.codes().get(descendantIndex), a = ancestor.codes().get(ancestorIndex);
            if (d.pre() > a.pre()) {
                if (a.post() > d.post()) {
                    if (!result.isEmpty() && result.getLast().pre() == a.pre()) {
                        var previous = result.removeLast();
                        result.add(new WUNCode(a.pre(),a.post(),previous.weight().add(d.weight())));
                    } else result.add(new WUNCode(a.pre(),a.post(),d.weight()));
                    matchedWeight = matchedWeight.add(d.weight());
                    descendantIndex++;
                } else ancestorIndex++;
            } else descendantIndex++;
            // Delayed checks only do extra work; they cannot remove a valid match.
            if (((descendantIndex + ancestorIndex) & 63) == 0) {
                BigDecimal bound = matchedWeight.add(descendant.remainingWeight(descendantIndex).min(ancestor.remainingWeight(ancestorIndex)));
                if (bound.compareTo(minimumWeight) < 0) {
                    if (inspection != null) inspection.pruningBound = bound;
                    return Optional.empty();
                }
            }
        }
        WUNList joined = WUNList.ordered(result);
        if (inspection != null) inspection.joined = joined;
        return joined.wus(sumTwu).compareTo(minWus) >= 0 ? Optional.of(joined) : Optional.empty();
    }
}
