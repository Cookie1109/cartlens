package com.cartlens.mining.ct;

import java.util.ArrayList;
import java.util.List;

public final class CTsetIntersection {
	public List<Integer> intersect(List<Integer> left, List<Integer> right, int currentLcTid,
			int windowTransactionCount) {
		var result = new ArrayList<Integer>();
		int leftIndex = 0;
		int rightIndex = 0;
		while (leftIndex < left.size() && rightIndex < right.size()) {
			int leftValue = left.get(leftIndex);
			int rightValue = right.get(rightIndex);
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
