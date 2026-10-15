package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Optional;

public final class WUNListIntersection {
    public Optional<WUNList> intersect(WUNList descendant, WUNList ancestor, BigDecimal minWus, BigDecimal sumTwu) {
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
                if (bound.compareTo(minimumWeight) < 0) return Optional.empty();
            }
        }
        WUNList joined = WUNList.ordered(result);
        return joined.wus(sumTwu).compareTo(minWus) >= 0 ? Optional.of(joined) : Optional.empty();
    }
}
