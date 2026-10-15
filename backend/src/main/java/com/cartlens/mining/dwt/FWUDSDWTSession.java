package com.cartlens.mining.dwt;

import java.math.BigDecimal;
import java.util.*;
import com.cartlens.domain.*;
import com.cartlens.mining.*;

public final class FWUDSDWTSession implements MiningSession {
    private final MiningConfig config;
    // Metadata IDs/support are maintained with each pane; WUS/pattern generation still use WUNLists.
    private final WindowIndex index;
    private final List<Pane> initialPanes = new ArrayList<>();
    private final WUNListIntersection intersection = new WUNListIntersection();
    private int acceptedPanes;
    private DSWUNTree tree;
    private MiningBudget budget;
    private MiningTimings timings = MiningTimings.ZERO;

    public FWUDSDWTSession(MiningConfig config) {
        this.config = config;
        this.index = new WindowIndex(config);
    }

    @Override public Optional<MiningResult> accept(Pane pane) {
        if (pane.transactions().size() != config.paneSize())
            throw new IllegalArgumentException("only completed panes may be mined");
        long started = System.nanoTime();
        if (acceptedPanes < config.windowPaneCount()) index.insert(pane);
        else index.update(pane);
        acceptedPanes++;
        if (tree == null) {
            initialPanes.add(pane);
            if (acceptedPanes < config.windowPaneCount()) {
                timings = new MiningTimings(System.nanoTime() - started, 0);
                return Optional.empty();
            }
            tree = new DSWUNTree(initialOrder());
            initialPanes.forEach(tree::insert);
            initialPanes.clear();
        } else tree.update(pane, config.paneSize());
        long miningStarted = System.nanoTime();
        var result = mine(acceptedPanes - config.windowPaneCount() + 1L, started);
        timings = new MiningTimings(miningStarted - started, System.nanoTime() - miningStarted);
        return Optional.of(result);
    }

    private MiningResult mine(long windowId, long started) {
        if (index.sumTwu().signum() <= 0) throw new IllegalArgumentException("sumTwu(window) must be positive");
        budget = new MiningBudget();
        var sets = index.tidsets();
        var frequent = sets.keySet().stream()
                .filter(item -> index.twuFor(sets.get(item).values()).divide(index.sumTwu(), com.cartlens.service.TwuCalculator.MATH_CONTEXT).compareTo(config.minWus()) >= 0)
                .sorted(Comparator.comparingInt(tree::rank)).toList();
        MiningBudget.checkZeroThreshold(config, frequent.size());
        var lists = tree.wunLists(Set.copyOf(frequent));
        var candidates = new ArrayList<Candidate>();
        var results = new ArrayList<PatternResult>();
        for (String item : frequent) {
            var tids = new BitSet();
            for (int tid : sets.get(item).values()) tids.set(tid);
            var candidate = new Candidate(Pattern.of(item), lists.get(item), tids);
            candidates.add(candidate);
            add(candidate, results);
        }
        extend(candidates, results);
        return new MiningResult(windowId, Algorithm.FWUDS_DWT, config, results,
                (System.nanoTime() - started) / 1_000_000, config.windowTransactionCount());
    }

    private void extend(List<Candidate> candidates, List<PatternResult> results) {
        for (int i = candidates.size() - 1; i >= 1; i--) {
            Candidate descendant = candidates.get(i);
            var next = new ArrayList<Candidate>();
            for (int j = 0; j < i; j++) {
                Candidate ancestor = candidates.get(j);
                var joined = intersection.intersect(descendant.list(), ancestor.list(), config.minWus(), index.sumTwu());
                if (joined.isEmpty()) continue;
                var items = new ArrayList<>(descendant.pattern().items());
                items.addAll(ancestor.pattern().items());
                BitSet tids = (BitSet) descendant.tids().clone();
                tids.and(ancestor.tids());
                var candidate = new Candidate(new Pattern(items), joined.orElseThrow(), tids);
                add(candidate, results);
                next.add(candidate);
            }
            if (next.size() > 1) extend(next, results);
        }
    }

    private void add(Candidate candidate, List<PatternResult> results) {
        MiningBudget.checkPatternCount(results.size());
        budget.checkTransactionReferences(candidate.tids().cardinality());
        var ids = index.transactionIdsFor(candidate.tids());
        budget.checkResultStorage(ids.storageBytes());
        results.add(new PatternResult(candidate.pattern(), candidate.list().wus(index.sumTwu()), ids.size(), ids));
    }

    private List<String> initialOrder() {
        var weights = new HashMap<String, BigDecimal>();
        index.tidsets().forEach((item, tids) -> weights.put(item, index.twuFor(tids.values())));
        return weights.keySet().stream().sorted(Comparator.<String, BigDecimal>comparing(weights::get).reversed()
                .thenComparing(Comparator.naturalOrder())).toList();
    }

    private record Candidate(Pattern pattern, WUNList list, BitSet tids) { }
    public DSWUNTree tree() { return tree; }
    @Override public MiningTimings timings() { return timings; }
}
