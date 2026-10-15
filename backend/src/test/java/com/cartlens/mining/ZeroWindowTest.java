package com.cartlens.mining;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.cartlens.domain.*;

class ZeroWindowTest {
    @Test void bothSessionsKeepRejectingAnAllZeroWindowWithAValidationError() {
        var config = new MiningConfig(1,1,BigDecimal.ZERO);
        var pane = new Pane(1,List.of(new Transaction("T1",List.of(new TransactionItem("A","A",1,BigDecimal.ZERO)),BigDecimal.ZERO)));
        for (MiningSession session : List.of(new com.cartlens.mining.ct.FWUDSCTSession(config),new com.cartlens.mining.dwt.FWUDSDWTSession(config)))
            assertThatThrownBy(() -> session.accept(pane)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("sumTwu");
    }
}
