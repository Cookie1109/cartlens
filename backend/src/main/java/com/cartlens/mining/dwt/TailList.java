package com.cartlens.mining.dwt;

import java.util.ArrayDeque;
import java.util.List;

public final class TailList {
	private final ArrayDeque<TailEntry> entries = new ArrayDeque<>();

	void add(TailEntry entry) { entries.addLast(entry); }
	TailEntry removeOldest() { return entries.removeFirst(); }
	public int size() { return entries.size(); }
	public List<TailEntry> entries() { return List.copyOf(entries); }
}
