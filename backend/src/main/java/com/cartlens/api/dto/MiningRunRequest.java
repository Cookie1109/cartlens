package com.cartlens.api.dto;

import java.math.BigDecimal;

import com.cartlens.domain.Algorithm;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record MiningRunRequest(@NotNull Algorithm algorithm, @Min(1) int paneSize,
		@Min(1) int windowPaneCount,
		@NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal minWus) { }
