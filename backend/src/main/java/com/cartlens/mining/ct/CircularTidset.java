package com.cartlens.mining.ct;

import java.util.LinkedList;
import java.util.List;

public final class CircularTidset {
	private final LinkedList<Integer> localTransactionIds = new LinkedList<>();

	public void add(int lcTid) {
		localTransactionIds.addLast(lcTid);
	}

	public void removeOldestRange(int fromInclusive, int toInclusive) {
		while (!localTransactionIds.isEmpty()) {
			int value = localTransactionIds.getFirst();
			if (value < fromInclusive || value > toInclusive) {
				break;
			}
			localTransactionIds.removeFirst();
		}
	}

	public List<Integer> values() {
		return List.copyOf(localTransactionIds);
	}

	public int size() {
		return localTransactionIds.size();
	}
}
