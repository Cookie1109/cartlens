package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;

import com.cartlens.service.TwuCalculator;

public final class WUNList {
	private final List<WUNCode> codes;

	public WUNList(List<WUNCode> codes) {
		var byPre = new LinkedHashMap<Integer, WUNCode>();
		codes.stream().sorted(Comparator.comparingInt(WUNCode::pre)).forEach(code -> byPre.merge(code.pre(), code,
				(left, right) -> new WUNCode(left.pre(), left.post(),
						left.weight().add(right.weight()))));
		this.codes = List.copyOf(new ArrayList<>(byPre.values()));
	}

	public List<WUNCode> codes() { return codes; }

	public BigDecimal totalWeight() {
		return codes.stream().map(WUNCode::weight)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public BigDecimal wus(BigDecimal sumTwu) {
		return totalWeight().divide(sumTwu, TwuCalculator.MATH_CONTEXT);
	}

	public boolean isEmpty() { return codes.isEmpty(); }
}
