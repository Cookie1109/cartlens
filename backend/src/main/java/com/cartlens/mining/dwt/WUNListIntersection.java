package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Optional;

import com.cartlens.service.TwuCalculator;

public final class WUNListIntersection {
	public Optional<WUNList> intersect(WUNList descendant, WUNList ancestor, BigDecimal minWus,
			BigDecimal sumTwu) {
		BigDecimal required = minWus.multiply(sumTwu, TwuCalculator.MATH_CONTEXT);
		BigDecimal wr1 = descendant.totalWeight();
		BigDecimal wr2 = ancestor.totalWeight();
		BigDecimal aw = BigDecimal.ZERO;
		var result = new ArrayList<WUNCode>();
		int descendantIndex = 0;
		int ancestorIndex = 0;
		while (descendantIndex < descendant.codes().size() && ancestorIndex < ancestor.codes().size()) {
			WUNCode descendantCode = descendant.codes().get(descendantIndex);
			WUNCode ancestorCode = ancestor.codes().get(ancestorIndex);
			if (descendantCode.pre() > ancestorCode.pre()) {
				if (ancestorCode.post() > descendantCode.post()) {
					result.add(new WUNCode(ancestorCode.pre(), ancestorCode.post(), descendantCode.weight()));
					aw = aw.add(descendantCode.weight());
					wr1 = wr1.subtract(descendantCode.weight());
					descendantIndex++;
				} else {
					wr2 = wr2.subtract(ancestorCode.weight());
					ancestorIndex++;
				}
			} else {
				wr1 = wr1.subtract(descendantCode.weight());
				descendantIndex++;
			}
			BigDecimal upperBound = aw.add(wr1.min(wr2));
			if (upperBound.compareTo(required) < 0) {
				return Optional.empty();
			}
		}
		WUNList joined = new WUNList(result);
		return joined.totalWeight().compareTo(required) >= 0
				? Optional.of(joined) : Optional.empty();
	}
}
