package com.cartlens.mining.ct;

import java.util.Map;
import com.cartlens.domain.MiningConfig;
import com.cartlens.mining.WindowIndex;

public final class CTsetStore extends WindowIndex {
    public CTsetStore(MiningConfig config) { super(config); }
    public Map<String, CircularTidset> oneItemCTsets() { return tidsets(); }
}
