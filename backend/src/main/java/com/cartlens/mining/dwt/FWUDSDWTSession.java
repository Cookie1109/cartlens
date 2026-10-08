package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import com.cartlens.domain.*;
import com.cartlens.mining.MiningSession;
import com.cartlens.mining.MiningBudget;
import com.cartlens.window.SlidingWindowManager;

public final class FWUDSDWTSession implements MiningSession {
    private final MiningConfig config;
    private final SlidingWindowManager windows;
    private final List<Pane> initialPanes = new ArrayList<>();
    private final WUNListIntersection intersection = new WUNListIntersection();
    private DSWUNTree tree;
    private MiningBudget budget;
    private com.cartlens.mining.MiningTimings timings = com.cartlens.mining.MiningTimings.ZERO;

    public FWUDSDWTSession(MiningConfig config) {
        this.config = config;
        this.windows = new SlidingWindowManager(config);
    }

    @Override
    public Optional<MiningResult> accept(Pane pane) {
        if (pane.transactions().size() != config.paneSize())
            throw new IllegalArgumentException("only completed panes may be mined");
        long started = System.nanoTime();
        Optional<SlidingWindow> snapshot = windows.accept(pane);
        if (tree == null) {
            initialPanes.add(pane);
            if (snapshot.isEmpty()) { timings = new com.cartlens.mining.MiningTimings(System.nanoTime() - started, 0); return Optional.empty(); }
            tree = new DSWUNTree(initialOrder(snapshot.orElseThrow()));
            initialPanes.forEach(tree::insert);
            initialPanes.clear();
        } else {
            tree.update(pane, config.paneSize());
        }
        long miningStarted = System.nanoTime();
        var result = snapshot.map(window -> mine(window, started));
        timings = new com.cartlens.mining.MiningTimings(miningStarted - started, System.nanoTime() - miningStarted);
        return result;
    }

    private MiningResult mine(SlidingWindow window, long started) {
        budget = new MiningBudget();
        var lists = tree.wunLists();
        var frequent = lists.keySet().stream()
                .filter(item -> lists.get(item).wus(window.sumTwu()).compareTo(config.minWus()) >= 0)
                .sorted(Comparator.comparingInt(tree::rank)).toList();
        MiningBudget.checkZeroThreshold(config, frequent.size());
        var transactions = window.transactions();
        var tids = new HashMap<String, BitSet>();
        frequent.forEach(item -> tids.put(item, new BitSet(transactions.size())));
        for (int index = 0; index < transactions.size(); index++) {
            for (var item : transactions.get(index).items()) {
                BitSet bits = tids.get(item.itemId());
                if (bits != null) bits.set(index);
            }
        }
        var candidates = new ArrayList<Candidate>();
        var results = new ArrayList<PatternResult>();
        for (String item : frequent) {
            var candidate = new Candidate(Pattern.of(item), lists.get(item), tids.get(item));
            candidates.add(candidate);
            add(candidate, window, transactions, results);
        }
        extend(candidates, window, transactions, results);
        return new MiningResult(window.windowId(), Algorithm.FWUDS_DWT, config, results,
                (System.nanoTime() - started) / 1_000_000, transactions.size());
    }

    // Algorithm 6: intersect two mined members of the same equivalence class.
    private void extend(List<Candidate> candidates, SlidingWindow window,
            List<Transaction> transactions, List<PatternResult> results) {
        for (int i = candidates.size() - 1; i >= 1; i--) {
            Candidate descendant = candidates.get(i);
            var next = new ArrayList<Candidate>();
            for (int j = 0; j < i; j++) {
                Candidate ancestor = candidates.get(j);
                var joined = intersection.intersect(descendant.list(), ancestor.list(), config.minWus(), window.sumTwu());
                if (joined.isEmpty()) continue;
                var items = new ArrayList<>(descendant.pattern().items());
                items.addAll(ancestor.pattern().items());
                BitSet tids = (BitSet) descendant.tids().clone();
                tids.and(ancestor.tids());
                var candidate = new Candidate(new Pattern(items), joined.orElseThrow(), tids);
                add(candidate, window, transactions, results);
                next.add(candidate);
            }
            if (next.size() > 1) extend(next, window, transactions, results);
        }
    }

    private void add(Candidate candidate, SlidingWindow window, List<Transaction> transactions,
            List<PatternResult> results) {
        MiningBudget.checkPatternCount(results.size());
        budget.checkTransactionReferences(candidate.tids().cardinality());
        var ids = candidate.tids().stream().mapToObj(index -> transactions.get(index).id()).toList();
        results.add(new PatternResult(candidate.pattern(), candidate.list().wus(window.sumTwu()), ids.size(), ids));
    }

    private List<String> initialOrder(SlidingWindow window) {
        var weights = new HashMap<String, BigDecimal>();
        for (var transaction : window.transactions())
            for (var item : transaction.items()) weights.merge(item.itemId(), transaction.twu(), BigDecimal::add);
        return weights.keySet().stream().sorted(Comparator.<String, BigDecimal>comparing(weights::get).reversed()
                .thenComparing(Comparator.naturalOrder())).toList();
    }

    private record Candidate(Pattern pattern, WUNList list, BitSet tids) { }
    public DSWUNTree tree() { return tree; }
    @Override public com.cartlens.mining.MiningTimings timings() { return timings; }
}
