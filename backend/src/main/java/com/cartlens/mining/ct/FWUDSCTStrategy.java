package com.cartlens.mining.ct;

import com.cartlens.domain.MiningConfig;
import com.cartlens.mining.MiningSession;
import com.cartlens.mining.MiningStrategy;

public final class FWUDSCTStrategy implements MiningStrategy {
	@Override
	public MiningSession start(MiningConfig config) {
		return new FWUDSCTSession(config);
	}
}
