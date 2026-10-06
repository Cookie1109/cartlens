package com.cartlens.mining;

import com.cartlens.domain.MiningConfig;

public interface MiningStrategy {
	MiningSession start(MiningConfig config);
}
