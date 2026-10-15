package com.cartlens.mining;

import com.cartlens.mining.ct.CircularTidset;
import com.cartlens.domain.TransactionIdList;
import java.util.BitSet;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;

public class WindowIndex {
	private final MiningConfig config;
	private final Map<String, CircularTidset> oneItemCTsets = new LinkedHashMap<>();
	private final BigDecimal[] twuByLcTid;
	private final String[] transactionIdByLcTid;
	private int transactionCount;
	private TransactionIdList.Window resultWindow;
    private final FixedTwuIndex exactWeights;
	private int currentLcTid;
	private BigDecimal sumTwu = BigDecimal.ZERO;

	public WindowIndex(MiningConfig config) {
		this.config = config;
        this.exactWeights = new FixedTwuIndex(config.windowTransactionCount());
		this.twuByLcTid = new BigDecimal[config.windowTransactionCount() + 1];
		this.transactionIdByLcTid = new String[config.windowTransactionCount() + 1];
	}

	public void insert(Pane pane) {
		pane.transactions().forEach(this::insert);
	}

	public void update(Pane pane) {
		removeOldestPane();
		insert(pane);
	}

	private void insert(Transaction transaction) {
		resultWindow = null;
		currentLcTid = currentLcTid == config.windowTransactionCount() ? 1 : currentLcTid + 1;
		if (twuByLcTid[currentLcTid] != null) {
			throw new IllegalStateException("lcTid was reused before stale TWU removal: " + currentLcTid);
		}
		twuByLcTid[currentLcTid] = transaction.twu();
        exactWeights.put(currentLcTid, transaction.twu());
		transactionCount++;
		transactionIdByLcTid[currentLcTid] = transaction.id();
		sumTwu = sumTwu.add(transaction.twu());
		transaction.items().stream().map(item -> item.itemId()).distinct().sorted()
				.forEach(item -> oneItemCTsets.computeIfAbsent(item, ignored -> new CircularTidset()).add(currentLcTid));
	}

	private void removeOldestPane() {
		resultWindow = null;
		int from = 1;
		int to = config.paneSize();
		if (currentLcTid < config.windowTransactionCount()) {
			from = currentLcTid + 1;
			to = currentLcTid + config.paneSize();
		}
		final int removeFrom = from;
		final int removeTo = to;
		oneItemCTsets.values().forEach(tidset -> tidset.removeOldestRange(removeFrom, removeTo));
		oneItemCTsets.values().removeIf(tidset -> tidset.size() == 0);
		for (int lcTid = from; lcTid <= to; lcTid++) {
			BigDecimal removed = twuByLcTid[lcTid];
			twuByLcTid[lcTid] = null;
            exactWeights.remove(lcTid);
			transactionCount--;
			transactionIdByLcTid[lcTid] = null;
			if (removed == null) {
				throw new IllegalStateException("missing TWU for oldest lcTid " + lcTid);
			}
			sumTwu = sumTwu.subtract(removed);
		}
	}

	public Map<String, CircularTidset> tidsets() {
		return Map.copyOf(oneItemCTsets);
	}

	public Map<Integer, BigDecimal> twuByLcTid() {
		var snapshot = new LinkedHashMap<Integer, BigDecimal>();
		for (int i = 1; i < twuByLcTid.length; i++) if (twuByLcTid[i] != null) snapshot.put(i, twuByLcTid[i]);
		return Map.copyOf(snapshot);
	}

	public int transactionCount() { return transactionCount; }

	public BigDecimal sumTwu() {
		return sumTwu;
	}

	public int currentLcTid() {
		return currentLcTid;
	}

	public BigDecimal twuFor(List<Integer> tids) {
		BigDecimal fast = exactWeights.sum(tids);
        if (fast != null) return fast;
        BigDecimal sum = BigDecimal.ZERO;
		for (int tid : tids) sum = sum.add(twuByLcTid[tid]);
		return sum;
	}

	public List<String> transactionIdsFor(List<Integer> tids) {
		if (tids instanceof com.cartlens.mining.ct.BitTidList dense) return transactionIdsFor(dense.bitSetCopy());
        int[] positions = new int[tids.size()];
        for (int i = 0; i < tids.size(); i++) positions[i] = chronologicalPosition(tids.get(i));
        return resultWindow().select(positions);
	}
    public BigDecimal currentPaneTwuFor(List<Integer> tids) {
        return rangeTwuFor(tids, currentLcTid - config.paneSize() + 1, currentLcTid);
    }
    public BigDecimal nextExpiringPaneTwuFor(List<Integer> tids) {
        int from = currentLcTid == config.windowTransactionCount() ? 1 : currentLcTid + 1;
        return rangeTwuFor(tids, from, from + config.paneSize() - 1);
    }
    private BigDecimal rangeTwuFor(List<Integer> tids, int from, int to) {
        BigDecimal sum = BigDecimal.ZERO;
        for (int tid = from; tid <= to; tid++) if (contains(tids, tid)) sum = sum.add(twuByLcTid[tid]);
        return sum;
    }
    private boolean contains(List<Integer> tids, int tid) {
        if (tids instanceof com.cartlens.mining.ct.BitTidList dense) return dense.containsTid(tid);
        int target = chronologicalPosition(tid), lo = 0, hi = tids.size() - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1, actual = chronologicalPosition(tids.get(mid));
            if (actual == target) return true;
            if (actual < target) lo = mid + 1; else hi = mid - 1;
        }
        return false;
    }
    private int chronologicalPosition(int tid) {
        int oldest = transactionCount < config.windowTransactionCount() ? 1 : currentLcTid % config.windowTransactionCount() + 1;
        return Math.floorMod(tid - oldest, config.windowTransactionCount());
    }
    private TransactionIdList.Window resultWindow() {
        if (resultWindow == null) {
            String[] ids = new String[transactionCount];
            for (int tid = 1; tid < transactionIdByLcTid.length; tid++)
                if (transactionIdByLcTid[tid] != null) ids[chronologicalPosition(tid)] = transactionIdByLcTid[tid];
            resultWindow = new TransactionIdList.Window(ids);
        }
        return resultWindow;
    }
    public TransactionIdList transactionIdsFor(BitSet tids) {
        int capacity = config.windowTransactionCount();
        int oldest = transactionCount < capacity ? 1 : currentLcTid % capacity + 1;
        BitSet ordered = tids.get(oldest, capacity + 1);
        if (oldest > 1) {
            long[] tail = java.util.Arrays.copyOf(ordered.toLongArray(), (capacity + 63) >>> 6);
            long[] head = tids.get(1, oldest).toLongArray();
            int shift = capacity - oldest + 1, wordShift = shift >>> 6, bitShift = shift & 63;
            for (int i = 0; i < head.length; i++) {
                tail[i + wordShift] |= head[i] << bitShift;
                if (bitShift != 0 && i + wordShift + 1 < tail.length) tail[i + wordShift + 1] |= head[i] >>> (64 - bitShift);
            }
            ordered = BitSet.valueOf(tail);
        }
        return resultWindow().select(ordered);
    }
}
