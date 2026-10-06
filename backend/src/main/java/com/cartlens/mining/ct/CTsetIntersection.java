package com.cartlens.mining.ct;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class CTsetIntersection {
	public List<Integer> intersect(List<Integer> left, List<Integer> right, int currentLcTid,
			int windowTransactionCount) {
		var chronology = Comparator.<Integer>comparingInt(
				value -> adjusted(value, currentLcTid, windowTransactionCount));
		var orderedLeft = left.stream().sorted(chronology).toList();
		var orderedRight = right.stream().sorted(chronology).toList();
		var result = new ArrayList<Integer>();
		int leftIndex = 0;
		int rightIndex = 0;
		while (leftIndex < orderedLeft.size() && rightIndex < orderedRight.size()) {
			int leftValue = orderedLeft.get(leftIndex);
			int rightValue = orderedRight.get(rightIndex);
			int leftAdjusted = adjusted(leftValue, currentLcTid, windowTransactionCount);
			int rightAdjusted = adjusted(rightValue, currentLcTid, windowTransactionCount);
			if (leftAdjusted == rightAdjusted) {
				result.add(leftValue);
				leftIndex++;
				rightIndex++;
			} else if (leftAdjusted < rightAdjusted) {
				leftIndex++;
			} else {
				rightIndex++;
			}
		}
		return List.copyOf(result);
	}

	private int adjusted(int lcTid, int currentLcTid, int windowTransactionCount) {
		return lcTid <= currentLcTid ? lcTid + windowTransactionCount : lcTid;
	}
}
