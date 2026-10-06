package com.cartlens.verification;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pattern;
import com.cartlens.support.TestFixtures;
import com.cartlens.window.SlidingWindowManager;

class OracleMinerTest {
	@Test
	void includesBoundaryWusEqualToThreshold() {
		var baseConfig = new MiningConfig(2, 2, new BigDecimal("0"));
		var manager = new SlidingWindowManager(baseConfig);
		var panes = TestFixtures.panes(TestFixtures.dse(), 2);
		manager.accept(panes.get(0));
		var window = manager.accept(panes.get(1)).orElseThrow();
		var threshold = new com.cartlens.service.WusCalculator()
				.calculate(Pattern.of("A", "C"), window.transactions()).wus();
		var config = new MiningConfig(2, 2, threshold);
		var result = new OracleMiner().mine(window, config);
		assertThat(result.patterns()).extracting(value -> value.pattern()).contains(Pattern.of("A", "C"));
	}
}
