package com.cartlens.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Pattern;
import com.cartlens.domain.TransactionItem;
import com.cartlens.support.TestFixtures;
import com.cartlens.window.SlidingWindowManager;

class MathematicalCoreTest {
	private final TwuCalculator twuCalculator = new TwuCalculator();
	private final WusCalculator wusCalculator = new WusCalculator();

	@Test
	void computesPaperExactValuesWithoutPresentationRounding() {
		var dse = TestFixtures.dse();
		assertDecimal("0.475", dse.get(0).twu());
		assertDecimal("0.7", dse.get(1).twu());
		assertDecimal(divide("11", "30"), dse.get(2).twu());
		assertDecimal(divide("29", "30"), dse.get(3).twu());
		assertDecimal(divide("13", "30"), dse.get(4).twu());
		assertDecimal("1.05", dse.get(5).twu());

		var w1 = dse.subList(0, 4);
		var w2 = dse.subList(2, 6);
		assertDecimal(divide("301", "120"), wusCalculator.sumTwu(w1));
		assertDecimal(divide("31", "43"), wusCalculator.calculate(Pattern.of("A", "C"), w1).wus());
		assertDecimal(divide("185", "301"), wusCalculator.calculate(Pattern.of("E"), w1).wus());
		assertDecimal(divide("185", "301"), wusCalculator.calculate(Pattern.of("E", "C"), w1).wus());
		assertDecimal(divide("169", "60"), wusCalculator.sumTwu(w2));
		assertDecimal(divide("11", "13"), wusCalculator.calculate(Pattern.of("A"), w2).wus());
	}

	@Test
	void separatesPaperDisplayRoundingFromCoreValues() {
		var dse = TestFixtures.dse();
		assertThat(dse.stream().map(value -> value.twu().setScale(2, RoundingMode.HALF_UP).toPlainString()))
				.containsExactly("0.48", "0.70", "0.37", "0.97", "0.43", "1.05");
		BigDecimal paperSum = dse.subList(0, 4).stream()
				.map(value -> value.twu().setScale(2, RoundingMode.HALF_UP)).reduce(BigDecimal.ZERO, BigDecimal::add);
		assertThat(paperSum.toPlainString()).isEqualTo("2.52");
	}

	@Test
	void supportsSingleItemQuantityAndChangingWeights() {
		assertDecimal("1.5", twuCalculator.calculate(List.of(new TransactionItem("A", "A", 3, new BigDecimal("0.5")))));
		assertDecimal("0.2", twuCalculator.calculate(List.of(new TransactionItem("A", "A", 1, new BigDecimal("0.2")))));
		assertDecimal("0.5", twuCalculator.calculate(List.of(new TransactionItem("A", "A", 1, new BigDecimal("0.5")))));
	}

	@Test
	void validatesConfigAndInitialWindowLifecycle() {
		assertThatThrownBy(() -> new MiningConfig(0, 2, new BigDecimal("0.5"))).isInstanceOf(IllegalArgumentException.class);
		var config = new MiningConfig(2, 2, new BigDecimal("0.5"));
		var manager = new SlidingWindowManager(config);
		var panes = TestFixtures.panes(TestFixtures.dse(), 2);
		assertThat(manager.accept(panes.get(0))).isEmpty();
		assertThat(manager.accept(panes.get(1))).get().extracting(window -> window.windowId()).isEqualTo(1L);
		assertThat(manager.accept(panes.get(2))).get().extracting(window -> window.windowId()).isEqualTo(2L);
	}

	private static BigDecimal divide(String numerator, String denominator) {
		return new BigDecimal(numerator).divide(new BigDecimal(denominator), TwuCalculator.MATH_CONTEXT);
	}

	private static void assertDecimal(String expected, BigDecimal actual) {
		assertDecimal(new BigDecimal(expected), actual);
	}

	private static void assertDecimal(BigDecimal expected, BigDecimal actual) {
		assertThat(actual.subtract(expected).abs()).isLessThanOrEqualTo(new BigDecimal("1E-32"));
	}
}
