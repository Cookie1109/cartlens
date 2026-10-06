package com.cartlens.api;

import java.util.List;

import org.springframework.stereotype.Component;

import com.cartlens.api.dto.ApiResponses.ConfigResponse;
import com.cartlens.api.dto.ApiResponses.ItemResponse;
import com.cartlens.api.dto.ApiResponses.MiningRunResponse;
import com.cartlens.api.dto.ApiResponses.PatternResponse;
import com.cartlens.api.dto.ApiResponses.TransactionResponse;
import com.cartlens.api.dto.TransactionRequest;
import com.cartlens.application.StreamService.RunView;
import com.cartlens.domain.MiningConfig;
import com.cartlens.domain.Transaction;
import com.cartlens.domain.TransactionItem;
import com.cartlens.service.TwuCalculator;

@Component
public class ApiMapper {
	private final TwuCalculator twuCalculator = new TwuCalculator();

	public Transaction toDomain(TransactionRequest request) {
		List<TransactionItem> items = request.items().stream()
				.map(item -> new TransactionItem(item.itemId(), item.name(), item.quantity(), item.weight())).toList();
		return new Transaction(request.id(), items, twuCalculator.calculate(items));
	}

	public TransactionResponse toResponse(Transaction transaction) {
		return new TransactionResponse(transaction.id(), transaction.items().stream()
				.map(item -> new ItemResponse(item.itemId(), item.name(), item.quantity(), item.weight())).toList(),
				transaction.twu());
	}

	public MiningRunResponse toResponse(RunView view) {
		var result = view.result();
		return new MiningRunResponse(view.runId(), view.streamId(), result.algorithm(), toResponse(result.config()),
				result.windowId(), result.windowTransactionCount(), result.patterns().stream()
						.map(pattern -> new PatternResponse(pattern.pattern().items(), pattern.wus(), pattern.support(),
								pattern.transactionIds())).toList(), result.executionTimeMs());
	}

	public ConfigResponse toResponse(MiningConfig config) {
		return new ConfigResponse(config.paneSize(), config.windowPaneCount(), config.minWus());
	}
}
