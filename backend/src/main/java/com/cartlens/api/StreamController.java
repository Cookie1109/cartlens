package com.cartlens.api;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import com.cartlens.api.dto.ApiResponses.*;
import com.cartlens.api.dto.*;
import com.cartlens.application.StreamService;
import com.cartlens.domain.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/streams")
public class StreamController {
    private final StreamService service;
    private final ApiMapper mapper;
    public StreamController(StreamService service, ApiMapper mapper) { this.service = service; this.mapper = mapper; }
    @PostMapping public ResponseEntity<StreamCreatedResponse> create() {
        return ResponseEntity.status(HttpStatus.CREATED).body(new StreamCreatedResponse(service.create().id()));
    }
    @GetMapping public List<StreamSummary> streams() {
        return service.streams().stream().map(s -> new StreamSummary(s.id(), s.total())).toList();
    }
    @GetMapping("/{streamId}/overview") public OverviewResponse overview(@PathVariable String streamId) {
        var state = service.get(streamId); var latest = state.latestAny(); var configuration = state.configuration();
        return new OverviewResponse(streamId, state.total(), configuration == null ? null : state.total() / configuration.config().paneSize(),
                latest == null ? null : mapper.toResponse(new StreamService.RunView(streamId, latest.runId(), latest.result()), true),
                configuration, state.metrics(), state.failure());
    }
    @GetMapping("/{streamId}/transactions") public List<TransactionResponse> transactions(@PathVariable String streamId,
            @RequestParam(defaultValue="0") long after, @RequestParam(defaultValue="100") int limit) {
        return service.get(streamId).transactions(after, limit).stream().map(mapper::toResponse).toList();
    }
    @PostMapping("/{streamId}/transactions") public ResponseEntity<TransactionResponse> add(@PathVariable String streamId,
            @Valid @RequestBody TransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(service.add(streamId, mapper.toDomain(request))));
    }
    @DeleteMapping("/{streamId}/transactions") public ResponseEntity<Void> reset(@PathVariable String streamId) {
        service.reset(streamId); return ResponseEntity.noContent().build();
    }
    @PostMapping("/{streamId}/configuration") public OverviewResponse configure(@PathVariable String streamId, @Valid @RequestBody MiningRunRequest request) {
        service.configure(streamId, request.algorithm(), new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus()));
        return overview(streamId);
    }
    @PostMapping("/{streamId}/runs") public MiningRunResponse run(@PathVariable String streamId, @Valid @RequestBody MiningRunRequest request) {
        return mapper.toResponse(service.run(streamId, request.algorithm(), new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus())));
    }
    @GetMapping("/{streamId}/results/latest") public MiningRunResponse latest(@PathVariable String streamId, @RequestParam(required=false) Algorithm algorithm) {
        return mapper.toResponse(service.latest(streamId, algorithm));
    }
    @GetMapping("/{streamId}/results") public List<MiningRunResponse> results(@PathVariable String streamId,
            @RequestParam(required=false) String sessionId, @RequestParam(defaultValue="0") long after, @RequestParam(defaultValue="20") int limit) {
        var state = service.get(streamId); String session = sessionId == null ? state.configuration().sessionId() : sessionId;
        return state.summaries(session, after, limit).stream().map(r -> new MiningRunResponse(r.sessionId(), streamId, r.algorithm(), mapper.toResponse(r.config()),
                r.windowId(), r.windowTransactionCount(), List.of(), r.executionTimeMs(), r.patternCount())).toList();
    }
    @GetMapping("/{streamId}/results/window") public MiningRunResponse window(@PathVariable String streamId,
            @RequestParam String sessionId, @RequestParam long windowId, @RequestParam(defaultValue="0") int patternAfter,
            @RequestParam(defaultValue="100") int limit) {
        var state=service.get(streamId); var summaries=state.summaries(sessionId,windowId-1,1);
        if (summaries.isEmpty() || summaries.getFirst().windowId()!=windowId) throw new com.cartlens.application.ApplicationException(com.cartlens.application.ErrorCode.RESULT_NOT_FOUND,"Không có window này.");
        var summary=summaries.getFirst(); var patterns=state.patternPage(sessionId,windowId,patternAfter,limit).stream()
                .map(p -> new PatternResponse(p.pattern().items(),p.wus(),p.support(),p.transactionIds())).toList();
        return new MiningRunResponse(sessionId,streamId,summary.algorithm(),mapper.toResponse(summary.config()),windowId,summary.windowTransactionCount(),patterns,summary.executionTimeMs(),summary.patternCount());
    }

    @GetMapping("/{streamId}/results/export.csv") public ResponseEntity<StreamingResponseBody> export(@PathVariable String streamId,
            @RequestParam(required=false) String sessionId) {
        var state = service.get(streamId); String session = sessionId == null ? state.configuration().sessionId() : sessionId;
        return ResponseEntity.ok().contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=cartlens-results.csv")
                .body(output -> {
                    var writer = new BufferedWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8));
                    writer.write("\uFEFFsessionId,windowId,algorithm,pattern,wus,support,transactionIds,executionTimeMs\n");
                    long after = 0;
                    while (true) {
                        var page = state.summaries(session, after, 20); if (page.isEmpty()) break;
                        for (var summary : page) {
                            if (summary.patternCount()==0) writer.write(csv(session)+","+summary.windowId()+","+summary.algorithm()+",,0,0,,"+summary.executionTimeMs()+"\n");
                            for (int offset=0; offset<summary.patternCount(); offset+=100) {
                                for (var pattern : state.patternPage(session,summary.windowId(),offset,100)) writer.write(csv(session)+","+summary.windowId()+","+summary.algorithm()
                                        +","+csv(pattern.pattern().toString())+","+pattern.wus().toPlainString()+","+pattern.support()
                                        +","+csv(String.join(";",pattern.transactionIds()))+","+summary.executionTimeMs()+"\n");
                                writer.flush();
                            }
                            after=summary.windowId();
                        }
                        writer.flush();
                    }
                    writer.flush();
                });
    }
    private static String csv(String value) { return "\"" + value.replace("\"", "\"\"") + "\""; }
    @PostMapping("/{streamId}/comparisons") public ComparisonResponse compare(@PathVariable String streamId, @Valid @RequestBody ComparisonRequest request) {
        var c = service.compare(streamId, new MiningConfig(request.paneSize(), request.windowPaneCount(), request.minWus()));
        return new ComparisonResponse(mapper.toResponse(c.config()), c.oracle() == null ? null : mapper.toResponse(c.oracle()),
                mapper.toResponse(c.fwudsCt()), mapper.toResponse(c.fwudsDwt()), c.equivalent(), c.differences(), c.oracleVerified());
    }
}
