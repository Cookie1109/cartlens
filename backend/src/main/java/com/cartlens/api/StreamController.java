package com.cartlens.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cartlens.api.dto.ApiResponses.ComparisonResponse;
import com.cartlens.api.dto.ApiResponses.MiningRunResponse;
import com.cartlens.api.dto.ApiResponses.OverviewResponse;
import com.cartlens.api.dto.ApiResponses.StreamCreatedResponse;
import com.cartlens.api.dto.ApiResponses.TransactionResponse;
import com.cartlens.api.dto.ComparisonRequest;
import com.cartlens.api.dto.MiningRunRequest;
import com.cartlens.api.dto.TransactionRequest;
import com.cartlens.application.StreamService;
import com.cartlens.domain.Algorithm;
import com.cartlens.domain.MiningConfig;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/streams")
public class StreamController {
	private final StreamService service;
	private final ApiMapper mapper;

	public StreamController(StreamService service, ApiMapper mapper) {
		this.service = service;
		this.mapper = mapper;
	}

	@PostMapping
	public ResponseEntity<StreamCreatedResponse> create() {
		return ResponseEntity.status(HttpStatus.CREATED).body(new StreamCreatedResponse(service.create().id()));
	}

	@GetMapping("/{streamId}/overview")
	public OverviewResponse overview(@PathVariable String streamId) {
		var state = service.get(streamId);
		var latest = state.latestAny();
		MiningRunResponse latestResponse = latest == null ? null
				: mapper.toResponse(new StreamService.RunView(streamId, latest.runId(), latest.result()));
		Integer paneCount = latest == null ? null : state.transactions().size() / latest.result().config().paneSize();
		return new OverviewResponse(streamId, state.transactions().size(), paneCount, latestResponse);
	}

	@GetMapping("/{streamId}/transactions")
	public List<TransactionResponse> transactions(@PathVariable String streamId) {
		return service.get(streamId).transactions().stream().map(mapper::toResponse).toList();
	}

	@PostMapping("/{streamId}/transactions")
	public ResponseEntity<TransactionResponse> add(@PathVariable String streamId,
			@Valid @RequestBody TransactionRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(service.add(streamId, mapper.toDomain(request))));
	}

	@DeleteMapping("/{streamId}/transactions")
	public ResponseEntity<Void> reset(@PathVariable String streamId) {
		service.reset(streamId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{streamId}/runs")
	public MiningRunResponse run(@PathVariable String streamId, @Valid @RequestBody MiningRunRequest request) {
		return mapper.toResponse(service.run(streamId, request.algorithm(),
				new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus())));
	}

	@GetMapping("/{streamId}/results/latest")
	public MiningRunResponse latest(@PathVariable String streamId,
			@RequestParam(required = false) Algorithm algorithm) {
		return mapper.toResponse(service.latest(streamId, algorithm));
	}

	@PostMapping("/{streamId}/comparisons")
	public ComparisonResponse compare(@PathVariable String streamId, @Valid @RequestBody ComparisonRequest request) {
		var comparison = service.compare(streamId,
				new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus()));
		return new ComparisonResponse(mapper.toResponse(comparison.config()), mapper.toResponse(comparison.oracle()),
				mapper.toResponse(comparison.fwudsCt()), mapper.toResponse(comparison.fwudsDwt()),
				comparison.equivalent(), comparison.differences());
	}
}
