package com.cartlens.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ReplayConfigurationRequest(@NotNull @Valid ReplayRequest configuration, @NotNull Mode mode) {
    public enum Mode { CONTINUE, RESTART }
}
