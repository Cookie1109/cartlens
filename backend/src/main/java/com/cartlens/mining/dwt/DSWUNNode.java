package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;


public final class DSWUNNode {
	private final String itemId;
	private BigDecimal weight = BigDecimal.ZERO;
	private int pre;
	private int post;
	private int transactionCount;
	private final Map<String, DSWUNNode> children = new LinkedHashMap<>();
	private final DSWUNNode parent;

	DSWUNNode(String itemId, DSWUNNode parent) {
		this.itemId = itemId;
		this.parent = parent;
	}

	void addWeight(BigDecimal value) {
		weight = weight.add(value);
		transactionCount++;
	}

	void subtractWeight(BigDecimal value) {
		weight = weight.subtract(value);
		transactionCount--;
		if (weight.signum() < 0) {
			throw new IllegalStateException("DSWUN node weight became negative for " + itemId);
		}
	}

	public String itemId() { return itemId; }
	public BigDecimal weight() { return weight; }
	public int pre() { return pre; }
	public int post() { return post; }
	public int transactionCount() { return transactionCount; }
	public Map<String, DSWUNNode> children() { return Map.copyOf(children); }
	public DSWUNNode parent() { return parent; }

	Map<String, DSWUNNode> mutableChildren() { return children; }
	void pre(int value) { pre = value; }
	void post(int value) { post = value; }
}
