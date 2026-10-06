package com.cartlens.mining.dwt;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.cartlens.support.TestFixtures;
import com.cartlens.domain.Pane;
import com.cartlens.domain.Transaction;
import com.cartlens.domain.MiningConfig;

class DSWUNTreeTest {
	@Test
	void buildsUpdatesAndMaintainsTailEntriesAndParents() {
		var panes = TestFixtures.panes(TestFixtures.dse(), 2);
		var session = new FWUDSDWTSession(new MiningConfig(2, 2, new BigDecimal("0.5")));
		session.accept(panes.get(0));
		session.accept(panes.get(1));
		assertThat(session.tree().treeRank()).containsEntry("C", 0).containsEntry("D", 1)
				.containsEntry("A", 2).containsEntry("E", 3).containsEntry("B", 4);
		var tree = new DSWUNTree(List.of("C", "A", "D", "E", "B"));
		tree.insert(panes.get(0));
		tree.insert(panes.get(1));
		assertThat(tree.tailList().size()).isEqualTo(4);
		assertThat(tree.tailList().entries()).extracting(TailEntry::transactionId)
				.containsExactly("t1", "t2", "t3", "t4");
		assertThat(tree.tailList().entries()).allSatisfy(entry -> assertThat(entry.tailNode().parent()).isNotNull());
		assertThat(tree.tailList().entries()).allSatisfy(entry -> {
			assertThat(entry.transactionTwu()).isPositive();
			assertThat(entry.transactionId()).isNotBlank();
		});
		tree.update(panes.get(2), 2);
		assertThat(tree.tailList().entries()).extracting(TailEntry::transactionId)
				.containsExactly("t3", "t4", "t5", "t6");
		assertThat(tree.tailList().size()).isEqualTo(4);
		assertThat(tree.root().children().get("C").children().get("D").children())
				.doesNotContainKey("E");
	}

	@Test
	void intersectsWunListsWithContractABoundary() {
		var descendant = new WUNList(List.of(new WUNCode(2, 3, new BigDecimal("0.6"))));
		var ancestor = new WUNList(List.of(new WUNCode(1, 4, new BigDecimal("1.0"))));
		var intersection = new WUNListIntersection();
		assertThat(intersection.intersect(descendant, ancestor, new BigDecimal("0.6"), BigDecimal.ONE))
				.get().extracting(WUNList::codes)
				.satisfies(codes -> assertThat(codes)
						.containsExactly(new WUNCode(1, 4, new BigDecimal("0.6"))));
		assertThat(intersection.intersect(descendant, ancestor, new BigDecimal("0.7"), BigDecimal.ONE)).isEmpty();
		assertThat(descendant.codes().getFirst().isDescendantOf(ancestor.codes().getFirst())).isTrue();
	}

	@Test
	void mergesDescendantWeightsAtTheSameAncestorAndUsesIndependentPrePostCounters() {
		var descendants = new WUNList(List.of(
				new WUNCode(2, 0, new BigDecimal("0.2")),
				new WUNCode(3, 1, new BigDecimal("0.3"))));
		var ancestors = new WUNList(List.of(new WUNCode(1, 2, new BigDecimal("0.8"))));
		var joined = new WUNListIntersection().intersect(descendants, ancestors, new BigDecimal("0.5"), BigDecimal.ONE);
		assertThat(joined).get().extracting(WUNList::codes)
				.satisfies(codes -> assertThat(codes)
						.containsExactly(new WUNCode(1, 2, new BigDecimal("0.5"))));

		var panes = TestFixtures.panes(TestFixtures.dse(), 2);
		var tree = new DSWUNTree(List.of("C", "D", "A", "E", "B"));
		tree.insert(panes.get(0));
		tree.insert(panes.get(1));
		tree.assignPrePost();
		assertThat(tree.root().pre()).isZero();
		assertThat(tree.root().children().get("C").pre()).isEqualTo(1);
		assertThat(tree.root().children().get("C").post()).isGreaterThan(
				tree.root().children().get("C").children().get("D").post());
	}

	@Test
	void reproducesExactPaperWunListsWithoutUsingRoundedWeights() {
		var dse = TestFixtures.dse().subList(0, 4).stream()
				.map(transaction -> new Transaction(transaction.id(), transaction.items().stream()
						.filter(item -> !item.itemId().equals("B")).toList(), transaction.twu()))
				.toList();
		var tree = new DSWUNTree(List.of("C", "D", "A", "E"));
		tree.insert(new Pane(1, dse));
		WUNList c = tree.wunList("C");
		assertThat(c.codes()).hasSize(1);
		assertThat(c.codes().getFirst().pre()).isEqualTo(1);
		assertThat(c.codes().getFirst().post()).isEqualTo(6);
		assertThat(c.codes().getFirst().weight().subtract(divide("301", "120")).abs())
				.isLessThanOrEqualTo(new BigDecimal("1E-32"));
		WUNList ec = new WUNListIntersection().intersect(tree.wunList("E"), c, BigDecimal.ZERO,
				divide("301", "120")).orElseThrow();
		assertThat(ec.codes()).hasSize(1);
		assertThat(ec.codes().getFirst().pre()).isEqualTo(1);
		assertThat(ec.codes().getFirst().post()).isEqualTo(6);
		assertThat(ec.codes().getFirst().weight().subtract(divide("185", "120")).abs())
				.isLessThanOrEqualTo(new BigDecimal("1E-32"));
	}

	private static BigDecimal divide(String numerator, String denominator) {
		return new BigDecimal(numerator).divide(new BigDecimal(denominator), com.cartlens.service.TwuCalculator.MATH_CONTEXT);
	}
}
