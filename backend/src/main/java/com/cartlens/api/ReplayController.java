package com.cartlens.api;

import org.springframework.web.bind.annotation.*;
import com.cartlens.api.dto.ReplayRequest;
import com.cartlens.api.dto.ReplayConfigurationRequest;
import com.cartlens.ingestion.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public final class ReplayController {
    private final ReplayService replay;
    public ReplayController(ReplayService replay) { this.replay = replay; }
    @GetMapping("/datasets/chainstore") public ChainstoreSource.Description source() { return replay.source(); }
    @GetMapping("/streams/{id}/replay") public org.springframework.http.ResponseEntity<ReplayService.Status> status(@PathVariable String id) {
        var status = replay.status(id);
        return status == null ? org.springframework.http.ResponseEntity.noContent().build() : org.springframework.http.ResponseEntity.ok(status);
    }
    @PostMapping("/streams/{id}/replay") public ReplayService.Status start(@PathVariable String id, @Valid @RequestBody ReplayRequest request) { return replay.start(id, request); }
    @PostMapping("/streams/{id}/replay/configuration") public ReplayService.Applied apply(@PathVariable String id, @Valid @RequestBody ReplayConfigurationRequest request) { return replay.apply(id, request); }
    @PostMapping("/streams/{id}/replay/{action}") public ReplayService.Status control(@PathVariable String id, @PathVariable String action) { return replay.control(id, action); }
}
