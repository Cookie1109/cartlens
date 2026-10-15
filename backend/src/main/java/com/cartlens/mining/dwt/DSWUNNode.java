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
	private Map<String, DSWUNNode> children;
    private DSWUNNode singleChild;
	private final DSWUNNode parent;

	DSWUNNode(String itemId, DSWUNNode parent) {
		this.itemId = itemId;
		this.parent = parent;
	}

	void addWeight(BigDecimal value) {
		weight = transactionCount == 0 ? value : weight.add(value);
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
	public Map<String, DSWUNNode> children() { return children != null ? Map.copyOf(children)
            : singleChild == null ? Map.of() : Map.of(singleChild.itemId(), singleChild); }
	public DSWUNNode parent() { return parent; }

    DSWUNNode child(String item) {
        return children != null ? children.get(item) : singleChild != null && singleChild.itemId().equals(item) ? singleChild : null;
    }
    DSWUNNode addChild(String item) {
        var node = new DSWUNNode(item, this);
        if (children != null) children.put(item, node);
        else if (singleChild == null) singleChild = node;
        else {
            children = new LinkedHashMap<>();
            children.put(singleChild.itemId(), singleChild); children.put(item, node); singleChild = null;
        }
        return node;
    }
    void removeChild(String item, DSWUNNode expected) {
        if (children != null) {
            children.remove(item, expected);
            if (children.size() == 1) { singleChild = children.values().iterator().next(); children = null; }
        } else if (singleChild == expected) singleChild = null;
    }
    DSWUNNode singleChild() { return singleChild; }
    java.util.Collection<DSWUNNode> branchChildren() { return children == null ? java.util.List.of() : children.values(); }

	void pre(int value) { pre = value; }
	void post(int value) { post = value; }
}
