package com.cartlens.mining.ct;

import java.util.List;

public final class CTsetIntersection {
	public List<Integer> intersect(List<Integer> left, List<Integer> right, int currentLcTid,
			int windowTransactionCount) {
        if (left instanceof BitTidList a && right instanceof BitTidList b) {
            var bits = (java.util.BitSet) a.bits().clone();
            bits.and(b.bits());
            return new BitTidList(bits, currentLcTid);
        }
        if (left instanceof BitTidList || right instanceof BitTidList) {
            var dense = (BitTidList) (left instanceof BitTidList ? left : right);
            var sparse = left instanceof BitTidList ? right : left;
            int[] matches = new int[sparse.size()];
            int count = 0;
            for (int tid : sparse) if (dense.bits().get(tid)) matches[count++] = tid;
            return IntTidList.copyOf(matches, count);
        }
		int[] result = new int[Math.min(left.size(), right.size())];
		int count = 0;
		int leftIndex = 0;
		int rightIndex = 0;
		while (leftIndex < left.size() && rightIndex < right.size()) {
			int leftValue = left.get(leftIndex);
			int rightValue = right.get(rightIndex);
			int leftAdjusted = adjusted(leftValue, currentLcTid, windowTransactionCount);
			int rightAdjusted = adjusted(rightValue, currentLcTid, windowTransactionCount);
			if (leftAdjusted == rightAdjusted) {
				result[count++] = leftValue;
				leftIndex++;
				rightIndex++;
			} else if (leftAdjusted < rightAdjusted) {
				leftIndex++;
			} else {
				rightIndex++;
			}
		}
		return IntTidList.copyOf(result, count);
	}

    public List<Integer> prepare(List<Integer> ids, int current, int capacity) { return BitTidList.prepare(ids, current, capacity); }

	private int adjusted(int lcTid, int currentLcTid, int windowTransactionCount) {
		return lcTid <= currentLcTid ? lcTid + windowTransactionCount : lcTid;
	}
}
