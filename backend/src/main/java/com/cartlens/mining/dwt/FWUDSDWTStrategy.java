package com.cartlens.mining.dwt;

import com.cartlens.domain.MiningConfig;
import com.cartlens.mining.MiningSession;
import com.cartlens.mining.MiningStrategy;

public final class FWUDSDWTStrategy implements MiningStrategy {
	@Override
	public MiningSession start(MiningConfig config) {
		return new FWUDSDWTSession(config);
	}
}
