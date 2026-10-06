package com.cartlens.mining;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pattern;
import com.cartlens.domain.Transaction;
import com.cartlens.domain.TransactionItem;
import com.cartlens.mining.ct.FWUDSCTStrategy;
import com.cartlens.mining.dwt.FWUDSDWTStrategy;
import com.cartlens.service.MiningService;
import com.cartlens.service.TwuCalculator;
import com.cartlens.support.TestFixtures;

class DifferentialMiningTest {
	private final MiningService miningService = new MiningService();

	@Test
	void paperDataMatchesOracleInBothWindows() {
		var config = new MiningConfig(2, 2, new BigDecimal("0.5"));
		var comparison = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(),
				TestFixtures.dse(), config);
		assertThat(comparison.differences()).as(comparison.differences().toString()).isEmpty();
		assertThat(comparison.fwudsCt().windowId()).isEqualTo(2);
	}

	@Test
	void deterministicRandomDatasetsMatchOracle() {
		for (long seed = 1; seed <= 30; seed++) {
			var transactions = randomTransactions(seed);
			var config = new MiningConfig(2, 2, new BigDecimal(seed % 3 == 0 ? "0.25" : "0.5"));
			var comparison = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(), transactions, config);
			assertThat(comparison.differences())
					.as("seed=%s transactions=%s differences=%s", seed, transactions, comparison.differences()).isEmpty();
		}
	}

	@Test
	void edgeThresholdsAndIndependentSessionsRemainEquivalent() {
		for (String threshold : List.of("0", "1")) {
			var config = new MiningConfig(1, 4, new BigDecimal(threshold));
			var first = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(), TestFixtures.dse(), config);
			var second = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(), TestFixtures.dse(), config);
			assertThat(first.differences()).isEmpty();
			assertThat(second.differences()).isEmpty();
			assertThat(second.fwudsCt().patterns()).isEqualTo(first.fwudsCt().patterns());
			assertThat(second.fwudsDwt().patterns()).isEqualTo(first.fwudsDwt().patterns());
		}
	}

	@Test
	void sparseStreamWithChangingWeightsNewItemsAndPartialPaneMatchesOracleInEveryWindow() {
		var transactions = List.of(
				tx("s1", item("A", 1, "0.2"), item("B", 1, "0.3")),
				tx("s2", item("C", 2, "0.4")),
				tx("s3", item("A", 2, "0.2"), item("D", 1, "0.5")),
				tx("s4", item("E", 1, "0.8")),
				tx("s5", item("B", 3, "0.3"), item("C", 1, "0.4")),
				tx("s6", item("A", 1, "0.6"), item("E", 2, "0.7")),
				tx("s7", item("D", 2, "0.9"), item("F", 1, "0.2")),
				tx("s8", item("A", 1, "0.6"), item("C", 2, "0.5")),
				tx("s9", item("B", 1, "0.1")),
				tx("s10", item("C", 1, "0.5"), item("D", 1, "0.9"), item("E", 1, "0.7")),
				tx("s11", item("F", 3, "0.8")),
				tx("s12", item("A", 2, "0.4"), item("B", 2, "0.4"), item("D", 2, "0.4")),
				tx("s13-buffered", item("Z", 1, "0.9")));
		var config = new MiningConfig(2, 3, new BigDecimal("0.25"));
		assertAllCompleteWindows("sparse-changing", transactions, config);
		assertThat(miningService.run(new FWUDSCTStrategy(), transactions, config).bufferedTransactionCount()).isEqualTo(1);
		assertThat(miningService.run(new FWUDSDWTStrategy(), transactions, config).bufferedTransactionCount()).isEqualTo(1);
	}

	@Test
	void denseTransactionsProduceLongPatternsAndMatchOracle() {
		var transactions = List.of(
				tx("d1", item("A", 1, "0.4"), item("B", 2, "0.4"), item("C", 1, "0.4"), item("D", 3, "0.4")),
				tx("d2", item("A", 2, "0.5"), item("B", 1, "0.5"), item("C", 2, "0.5"), item("D", 1, "0.5")),
				tx("d3", item("A", 1, "0.6"), item("B", 1, "0.6"), item("C", 1, "0.6")),
				tx("d4", item("A", 3, "0.7"), item("B", 1, "0.7"), item("C", 1, "0.7"), item("D", 1, "0.7")),
				tx("d5", item("A", 1, "0.8"), item("C", 2, "0.8"), item("D", 2, "0.8")),
				tx("d6", item("A", 2, "0.9"), item("B", 2, "0.9"), item("C", 2, "0.9"), item("D", 2, "0.9")),
				tx("d7", item("A", 1, "0.3"), item("B", 1, "0.3"), item("C", 1, "0.3"), item("D", 1, "0.3")),
				tx("d8", item("A", 2, "0.4"), item("B", 2, "0.4"), item("C", 2, "0.4"), item("D", 2, "0.4")),
				tx("d9", item("A", 1, "0.5"), item("B", 1, "0.5"), item("D", 1, "0.5")),
				tx("d10", item("A", 1, "0.6"), item("B", 1, "0.6"), item("C", 1, "0.6"), item("D", 1, "0.6")),
				tx("d11", item("B", 2, "0.7"), item("C", 2, "0.7"), item("D", 2, "0.7")),
				tx("d12", item("A", 3, "0.8"), item("B", 3, "0.8"), item("C", 3, "0.8"), item("D", 3, "0.8")));
		var config = new MiningConfig(3, 2, new BigDecimal("0.55"));
		assertAllCompleteWindows("dense-long-patterns", transactions, config);
		var finalResult = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(), transactions, config);
		assertThat(finalResult.oracle().patterns()).extracting(value -> value.pattern())
				.contains(Pattern.of("A", "B", "C", "D"));
	}

	@Test
	void evictsOldPatternsAndAdmitsNewPatterns() {
		var transactions = List.of(
				tx("e1", item("X", 3, "0.9"), item("A", 1, "0.2")),
				tx("e2", item("X", 2, "0.9"), item("B", 1, "0.2")),
				tx("e3", item("A", 2, "0.3"), item("B", 1, "0.3")),
				tx("e4", item("A", 1, "0.3"), item("C", 2, "0.3")),
				tx("e5", item("B", 2, "0.5"), item("C", 1, "0.5")),
				tx("e6", item("A", 1, "0.5"), item("C", 2, "0.5")),
				tx("e7", item("Y", 3, "0.8"), item("A", 1, "0.4")),
				tx("e8", item("Y", 2, "0.8"), item("C", 1, "0.4")),
				tx("e9", item("Y", 1, "0.9"), item("B", 1, "0.4")),
				tx("e10", item("Y", 2, "0.9"), item("A", 1, "0.4")));
		var config = new MiningConfig(2, 2, new BigDecimal("0.3"));
		assertAllCompleteWindows("eviction-arrival", transactions, config);
		var finalResult = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(), transactions, config);
		assertThat(finalResult.oracle().patterns()).extracting(value -> value.pattern())
				.contains(Pattern.of("Y")).doesNotContain(Pattern.of("X"));
	}

	@Test
	void deterministicTiesAndSingleTransactionPanesMatchOracle() {
		var transactions = List.of(
				tx("q1", item("A", 1, "0.5"), item("B", 1, "0.5")),
				tx("q2", item("B", 1, "0.5"), item("C", 1, "0.5")),
				tx("q3", item("A", 1, "0.5"), item("C", 1, "0.5")),
				tx("q4", item("A", 1, "0.5"), item("B", 1, "0.5"), item("C", 1, "0.5")),
				tx("q5", item("A", 1, "0.7"), item("B", 1, "0.7")),
				tx("q6", item("B", 1, "0.7"), item("C", 1, "0.7")),
				tx("q7", item("A", 1, "0.7"), item("C", 1, "0.7")),
				tx("q8", item("A", 1, "0.7"), item("B", 1, "0.7"), item("C", 1, "0.7")));
		assertAllCompleteWindows("ties-pane-one", transactions,
				new MiningConfig(1, 4, new BigDecimal("0.5")));
	}

	private void assertAllCompleteWindows(String scenario, List<Transaction> transactions, MiningConfig config) {
		int completeTransactionCount = transactions.size() - transactions.size() % config.paneSize();
		for (int end = config.windowTransactionCount(); end <= completeTransactionCount; end += config.paneSize()) {
			var comparison = miningService.compare(new FWUDSCTStrategy(), new FWUDSDWTStrategy(),
					transactions.subList(0, end), config);
			assertThat(comparison.differences())
					.as("scenario=%s end=%s window=%s differences=%s", scenario, end,
							comparison.oracle().windowId(), comparison.differences())
					.isEmpty();
		}
	}

	private static Transaction tx(String id, TransactionItem... items) {
		List<TransactionItem> values = List.of(items);
		return new Transaction(id, values, new TwuCalculator().calculate(values));
	}

	private static TransactionItem item(String id, int quantity, String weight) {
		return new TransactionItem(id, id, quantity, new BigDecimal(weight));
	}

	private List<Transaction> randomTransactions(long seed) {
		var random = new Random(seed);
		var transactions = new ArrayList<Transaction>();
		var calculator = new TwuCalculator();
		for (int transactionIndex = 0; transactionIndex < 10; transactionIndex++) {
			var items = new ArrayList<TransactionItem>();
			for (String item : List.of("A", "B", "C", "D")) {
				if (random.nextBoolean()) {
					items.add(new TransactionItem(item, item, 1 + random.nextInt(3),
							new BigDecimal("0." + (1 + random.nextInt(8)))));
				}
			}
			if (items.isEmpty()) {
				items.add(new TransactionItem("A", "A", 1, new BigDecimal("0.5")));
			}
			transactions.add(new Transaction("S" + seed + "T" + transactionIndex, items, calculator.calculate(items)));
		}
		return List.copyOf(transactions);
	}
}
