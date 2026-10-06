package com.cartlens.support;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;
import com.cartlens.domain.TransactionItem;
import com.cartlens.service.TwuCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class TestFixtures {
	private static final TwuCalculator TWU = new TwuCalculator();

	private TestFixtures() {
	}

	public static List<Transaction> dse() {
		try (var input = TestFixtures.class.getResourceAsStream("/paper/dse.json")) {
			var root = new ObjectMapper().readTree(input);
			var transactions = new ArrayList<Transaction>();
			for (var transactionNode : root.get("transactions")) {
				var items = new ArrayList<TransactionItem>();
				for (var itemNode : transactionNode.get("items")) {
					items.add(new TransactionItem(itemNode.get("itemId").asText(), itemNode.get("itemId").asText(),
							itemNode.get("quantity").asInt(), new BigDecimal(itemNode.get("weight").asText())));
				}
				transactions.add(new Transaction(transactionNode.get("id").asText(), items, TWU.calculate(items)));
			}
			return List.copyOf(transactions);
		} catch (IOException error) {
			throw new IllegalStateException("Cannot load DSe fixture", error);
		}
	}

	public static List<Pane> panes(List<Transaction> transactions, int paneSize) {
		var panes = new ArrayList<Pane>();
		for (int start = 0; start + paneSize <= transactions.size(); start += paneSize) {
			panes.add(new Pane(panes.size() + 1L, transactions.subList(start, start + paneSize)));
		}
		return List.copyOf(panes);
	}
}
