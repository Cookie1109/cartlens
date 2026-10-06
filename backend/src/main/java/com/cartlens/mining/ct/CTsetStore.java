package com.cartlens.mining.ct;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;
import com.cartlens.service.TwuCalculator;

public final class CTsetStore {
	private final MiningConfig config;
	private final Map<String, CircularTidset> oneItemCTsets = new LinkedHashMap<>();
	private final Map<Integer, BigDecimal> twuByLcTid = new LinkedHashMap<>();
	private final Map<Integer, String> transactionIdByLcTid = new LinkedHashMap<>();
	private int currentLcTid;
	private BigDecimal sumTwu = BigDecimal.ZERO;

	public CTsetStore(MiningConfig config) {
		this.config = config;
	}

	public void insert(Pane pane) {
		pane.transactions().forEach(this::insert);
	}

	public void update(Pane pane) {
		removeOldestPane();
		insert(pane);
	}

	private void insert(Transaction transaction) {
		currentLcTid = currentLcTid == config.windowTransactionCount() ? 1 : currentLcTid + 1;
		if (twuByLcTid.containsKey(currentLcTid)) {
			throw new IllegalStateException("lcTid was reused before stale TWU removal: " + currentLcTid);
		}
		twuByLcTid.put(currentLcTid, transaction.twu());
		transactionIdByLcTid.put(currentLcTid, transaction.id());
		sumTwu = sumTwu.add(transaction.twu());
		transaction.items().stream().map(item -> item.itemId()).distinct().sorted()
				.forEach(item -> oneItemCTsets.computeIfAbsent(item, ignored -> new CircularTidset()).add(currentLcTid));
	}

	private void removeOldestPane() {
		int from = 1;
		int to = config.paneSize();
		if (currentLcTid < config.windowTransactionCount()) {
			from = currentLcTid + 1;
			to = currentLcTid + config.paneSize();
		}
		final int removeFrom = from;
		final int removeTo = to;
		oneItemCTsets.values().forEach(tidset -> tidset.removeOldestRange(removeFrom, removeTo));
		for (int lcTid = from; lcTid <= to; lcTid++) {
			BigDecimal removed = twuByLcTid.remove(lcTid);
			transactionIdByLcTid.remove(lcTid);
			if (removed == null) {
				throw new IllegalStateException("missing TWU for oldest lcTid " + lcTid);
			}
			sumTwu = sumTwu.subtract(removed);
		}
	}

	public Map<String, CircularTidset> oneItemCTsets() {
		return Map.copyOf(oneItemCTsets);
	}

	public Map<Integer, BigDecimal> twuByLcTid() {
		return Map.copyOf(twuByLcTid);
	}

	public BigDecimal sumTwu() {
		return sumTwu;
	}

	public int currentLcTid() {
		return currentLcTid;
	}

	public BigDecimal twuFor(List<Integer> tids) {
		return tids.stream().map(twuByLcTid::get)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public List<String> transactionIdsFor(List<Integer> tids) {
		return tids.stream().map(transactionIdByLcTid::get).toList();
	}
}
