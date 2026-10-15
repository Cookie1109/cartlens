package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import com.cartlens.domain.*;
import com.cartlens.mining.ct.FWUDSCTSession;
import com.cartlens.service.TwuCalculator;
import com.cartlens.verification.*;
import com.cartlens.window.SlidingWindowManager;

class CTDenseIncrementalTest {
    @Test void denseBitsetsAndCachedPaneDeltasMatchIndependentExhaustiveMining() {
        var config = new MiningConfig(5,30,new BigDecimal("0.3"));
        var ct = new FWUDSCTSession(config); var windows = new SlidingWindowManager(config);
        var oracle = new OracleMiner(); var comparator = new ResultComparator(); var random = new Random(219);
        int id = 0, checked = 0;
        for (int paneId = 1; paneId <= 80; paneId++) {
            var rows = new ArrayList<Transaction>();
            for (int p = 0; p < 5; p++) {
                var items = new ArrayList<TransactionItem>();
                for (int item = 0; item < 8; item++) if (item == 0 || random.nextInt(5) != 0)
                    items.add(new TransactionItem("I"+item,"I"+item,1+random.nextInt(4),BigDecimal.valueOf(1+random.nextInt(10))));
                rows.add(new Transaction(Integer.toString(++id),items,new TwuCalculator().calculate(items)));
            }
            var pane = new Pane(paneId,rows); var actual = ct.accept(pane); var snapshot = windows.accept(pane);
            if (snapshot.isEmpty()) continue;
            var expected = oracle.mine(snapshot.orElseThrow(),config);
            assertThat(comparator.compare(expected,actual.orElseThrow()).differences()).isEmpty();
            checked++;
        }
        assertThat(checked).isEqualTo(51);
    }
}
