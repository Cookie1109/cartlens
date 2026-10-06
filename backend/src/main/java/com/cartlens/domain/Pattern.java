package com.cartlens.domain;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;

public final class Pattern implements Comparable<Pattern> {
	private final List<String> items;

	public Pattern(Collection<String> items) {
		var canonical = new TreeSet<String>();
		if (items != null) {
			items.stream().map(String::trim).filter(item -> !item.isEmpty()).forEach(canonical::add);
		}
		if (canonical.isEmpty()) {
			throw new IllegalArgumentException("pattern must contain at least one item");
		}
		this.items = List.copyOf(canonical);
	}

	public static Pattern of(String... items) {
		return new Pattern(List.of(items));
	}

	public List<String> items() {
		return items;
	}

	@Override
	public int compareTo(Pattern other) {
		for (int i = 0; i < Math.min(items.size(), other.items.size()); i++) {
			int compared = items.get(i).compareTo(other.items.get(i));
			if (compared != 0) {
				return compared;
			}
		}
		return Integer.compare(items.size(), other.items.size());
	}

	@Override
	public boolean equals(Object value) {
		return value instanceof Pattern other && items.equals(other.items);
	}

	@Override
	public int hashCode() {
		return Objects.hash(items);
	}

	@Override
	public String toString() {
		return String.join(",", items);
	}
}
