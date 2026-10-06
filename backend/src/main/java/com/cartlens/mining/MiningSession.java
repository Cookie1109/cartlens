package com.cartlens.mining;

import java.util.Optional;

import com.cartlens.domain.MiningResult;
import com.cartlens.domain.Pane;

public interface MiningSession {
	Optional<MiningResult> accept(Pane completedPane);
}
