package com.cartlens.mining.ct;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.cartlens.domain.MiningConfig;
import com.cartlens.support.TestFixtures;

class CTsetTest {
	@Test
	void maintainsCircularChronologyAndReplacesTwuAtomically() {
		var config = new MiningConfig(2, 2, new BigDecimal("0.5"));
		var session = new FWUDSCTSession(config);
		var panes = TestFixtures.panes(TestFixtures.dse(), 2);
		assertThat(session.store().currentLcTid()).isZero();
		session.accept(panes.get(0));
		session.accept(panes.get(1));
		assertThat(session.store().oneItemCTsets().get("A").values()).containsExactly(1, 3, 4);
		assertThat(session.store().currentLcTid()).isEqualTo(4);
		session.accept(panes.get(2));
		assertThat(session.store().oneItemCTsets().get("A").values()).containsExactly(3, 4, 2);
		assertThat(session.store().currentLcTid()).isEqualTo(2);
		assertThat(session.store().twuByLcTid()).containsOnlyKeys(1, 2, 3, 4);
		assertThat(session.store().twuByLcTid().get(1).compareTo(TestFixtures.dse().get(4).twu())).isZero();
	}

	@Test
	void intersectsInCircularOrder() {
		var intersection = new CTsetIntersection();
		assertThat(intersection.intersect(List.of(3, 4, 2), List.of(3, 1, 2), 2, 4)).containsExactly(3, 2);
		assertThat(intersection.intersect(List.of(3, 4), List.of(1, 2), 2, 4)).isEmpty();
		assertThat(intersection.intersect(List.of(3, 4, 1, 2), List.of(3, 4, 1, 2), 2, 4))
				.containsExactly(3, 4, 1, 2);
	}

	@Test
	void survivesMultipleWrapAroundsWithoutStaleTwu() {
		var config = new MiningConfig(2, 2, new BigDecimal("0.1"));
		var session = new FWUDSCTSession(config);
		var base = TestFixtures.dse();
		var transactions = new java.util.ArrayList<com.cartlens.domain.Transaction>();
		for (int cycle = 0; cycle < 3; cycle++) {
			for (var transaction : base) {
				transactions.add(new com.cartlens.domain.Transaction(transaction.id() + "-" + cycle,
						transaction.items(), transaction.twu().add(new BigDecimal("0.01").multiply(BigDecimal.valueOf(cycle)))));
			}
		}
		var panes = TestFixtures.panes(transactions, 2);
		for (var pane : panes) {
			session.accept(pane);
			if (pane.paneId() >= 2) {
				int end = Math.toIntExact(pane.paneId() * 2);
				BigDecimal expected = transactions.subList(end - 4, end).stream()
						.map(com.cartlens.domain.Transaction::twu).reduce(BigDecimal.ZERO, BigDecimal::add);
				assertThat(session.store().sumTwu()).isEqualByComparingTo(expected);
				assertThat(session.store().twuByLcTid()).hasSize(4);
			}
		}
		assertThat(session.store().currentLcTid()).isEqualTo(2);
	}
}
