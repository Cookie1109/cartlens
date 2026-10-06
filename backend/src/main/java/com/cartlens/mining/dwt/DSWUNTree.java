package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;

public final class DSWUNTree {
	private final DSWUNNode root = new DSWUNNode(null, null);
	private final TailList tailList = new TailList();
	private final Map<String, Integer> treeRank;
	private int preCounter;
	private int postCounter;

	public DSWUNTree(List<String> treeOrder) {
		treeRank = new HashMap<>();
		for (int index = 0; index < treeOrder.size(); index++) {
			treeRank.put(treeOrder.get(index), index);
		}
	}

	public void insert(Pane pane) {
		pane.transactions().forEach(this::insert);
	}

	public void update(Pane newPane, int removeTransactionCount) {
		insert(newPane);
		for (int index = 0; index < removeTransactionCount; index++) {
			removeOldest();
		}
	}

	private void insert(Transaction transaction) {
		var orderedItems = transaction.items().stream().map(item -> item.itemId()).distinct()
				.sorted(Comparator.comparingInt((String item) -> rank(item)).thenComparing(Comparator.naturalOrder()))
				.toList();
		DSWUNNode current = root;
		for (String item : orderedItems) {
			DSWUNNode parent = current;
			current = current.mutableChildren().computeIfAbsent(item, ignored -> new DSWUNNode(item, parent));
			current.addWeight(transaction.twu());
		}
		tailList.add(new TailEntry(transaction.id(), transaction.twu(), current));
	}

	private void removeOldest() {
		TailEntry entry = tailList.removeOldest();
		DSWUNNode current = entry.tailNode();
		while (current != root) {
			DSWUNNode parent = current.parent();
			current.subtractWeight(entry.transactionTwu());
			if (current.weight().signum() == 0) {
				parent.mutableChildren().remove(current.itemId(), current);
			}
			current = parent;
		}
	}

	public void assignPrePost() {
		preCounter = 0;
		postCounter = 0;
		root.pre(preCounter++);
		for (DSWUNNode child : root.mutableChildren().values()) {
			assignPrePost(child);
		}
		root.post(postCounter++);
	}

	private void assignPrePost(DSWUNNode node) {
		node.pre(preCounter++);
		node.mutableChildren().values().forEach(this::assignPrePost);
		node.post(postCounter++);
	}

	public WUNList wunList(String itemId) {
		assignPrePost();
		var codes = new ArrayList<WUNCode>();
		collect(root, itemId, codes);
		return new WUNList(codes);
	}

	private void collect(DSWUNNode node, String itemId, List<WUNCode> codes) {
		if (itemId.equals(node.itemId())) {
			codes.add(new WUNCode(node.pre(), node.post(), node.weight()));
		}
		node.mutableChildren().values().forEach(child -> collect(child, itemId, codes));
	}

	public int rank(String itemId) {
		return treeRank.getOrDefault(itemId, Integer.MAX_VALUE / 2);
	}

	public DSWUNNode root() { return root; }
	public TailList tailList() { return tailList; }
	public Map<String, Integer> treeRank() { return Map.copyOf(treeRank); }
}
