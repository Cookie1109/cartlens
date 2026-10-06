package com.cartlens.api.dto;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record TransactionRequest(@NotBlank String id, @NotEmpty List<@Valid ItemRequest> items) {
	public record ItemRequest(@NotBlank String itemId, String name, @Min(1) int quantity,
			@NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal weight) { }
}
