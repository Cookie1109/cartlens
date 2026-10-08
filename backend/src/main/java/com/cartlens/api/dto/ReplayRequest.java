package com.cartlens.api.dto;

import java.math.BigDecimal;
import com.cartlens.domain.Algorithm;
import com.cartlens.ingestion.ChainstoreReader.WeightMode;
import jakarta.validation.constraints.*;

public record ReplayRequest(@NotNull Algorithm algorithm, @Min(1) int paneSize, @Min(1) int windowPaneCount,
        @NotNull @DecimalMin("0") @DecimalMax("1") BigDecimal minWus,
        @Min(0) @Max(100000) int transactionsPerSecond, @Min(0) long maxTransactions,
        @NotNull WeightMode weightMode, @Min(1) int weightBatchSize, long seed) { }
