package com.cartlens.api.dto;

import java.math.BigDecimal;
import java.util.List;
import com.cartlens.domain.Algorithm;
import com.cartlens.infrastructure.StreamState;

public final class ApiResponses {
    private ApiResponses() { }
    public record StreamCreatedResponse(String streamId) { }
    public record StreamSummary(String streamId, long transactionCount) { }
    public record ItemResponse(String itemId, String name, int quantity, BigDecimal weight) { }
    public record TransactionResponse(String id, List<ItemResponse> items, BigDecimal twu) { }
    public record ConfigResponse(int paneSize, int windowPaneCount, BigDecimal minWus) { }
    public record PatternResponse(List<String> items, BigDecimal wus, int support, List<String> transactionIds) { }
    public record MiningRunResponse(String runId, String streamId, Algorithm algorithm, ConfigResponse config,
            long windowId, int windowTransactionCount, List<PatternResponse> patterns, long executionTimeMs, int patternCount) { }
    public record ComparisonResponse(ConfigResponse config, MiningRunResponse oracle, MiningRunResponse fwudsCt,
            MiningRunResponse fwudsDwt, boolean equivalent, List<String> differences, boolean oracleVerified) { }
    public record OverviewResponse(String streamId, long transactionCount, Long completedPaneCount,
            MiningRunResponse latestRun, StreamState.SessionConfiguration configuration, StreamState.Metrics metrics, String miningError) { }
    public record FieldErrorResponse(String field, String message) { }
    public record ErrorResponse(String code, String message, List<FieldErrorResponse> fieldErrors) { }
}
