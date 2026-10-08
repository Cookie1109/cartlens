package com.cartlens.ingestion;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.api.dto.ReplayRequest;
import com.cartlens.api.dto.ReplayConfigurationRequest;
import com.cartlens.api.dto.ReplayConfigurationRequest.Mode;
import com.cartlens.application.StreamService;
import com.cartlens.domain.Algorithm;
import com.cartlens.infrastructure.*;

class ReplayLifecycleTest {
    @TempDir Path directory;
    @Test void pauseStopResumeMaintainsCheckpointAndDoesNotDropOrDuplicateTransactions() throws Exception {
        Files.writeString(directory.resolve("investment_table.txt"), "ItemID Total Investment\n====\n1 100\n2 200\n");
        Files.writeString(directory.resolve("transactions.txt"), "1 2:3:1 2\n".repeat(80));
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("replay-db").toString(), json)) {
            var service = new StreamService(new StreamStore(archive, json)); var state = service.create();
            var replay = new ReplayService(new ChainstoreSource(directory.toString()), service, json);
            try {
                replay.start(state.id(), new ReplayRequest(Algorithm.FWUDS_DWT, 4, 2, new BigDecimal("0.5"), 50, 32,
                        ChainstoreReader.WeightMode.PROVIDED_UTILITY, 3, 42));
                replay.control(state.id(), "pause");
                await().atMost(Duration.ofSeconds(3)).until(() -> "PAUSED".equals(replay.status(state.id()).state()));
                long paused = state.total(); Thread.sleep(120); assertThat(state.total()).isEqualTo(paused);
                assertThatThrownBy(() -> service.add(state.id(), state.transactions(0, 1).isEmpty()
                        ? ChainstoreReader.parse("1:1:1", 99, java.util.Map.of("1", BigDecimal.ONE), ChainstoreReader.WeightMode.PROVIDED_UTILITY, 3, 42)
                        : state.transactions(0, 1).getFirst())).isInstanceOf(com.cartlens.application.ApplicationException.class);
                replay.control(state.id(), "resume");
                await().atMost(Duration.ofSeconds(3)).until(() -> state.total() > paused);
                replay.control(state.id(), "stop");
                await().atMost(Duration.ofSeconds(3)).until(() -> "STOPPED".equals(replay.status(state.id()).state()) && !state.replaying());
                replay.control(state.id(), "resume");
                await().atMost(Duration.ofSeconds(5)).until(() -> "COMPLETED".equals(replay.status(state.id()).state()) && !state.replaying());
                assertThat(state.total()).isEqualTo(32); assertThat(state.metrics().processedTransactions()).isEqualTo(32);
                assertThat(state.latestAny().result().windowId()).isEqualTo(7);
                assertThat(state.retained()).isEqualTo(8);
                assertThat(state.transactions(0, 100)).extracting(tx -> tx.id()).doesNotHaveDuplicates();
                assertThat(state.results(state.configuration().sessionId(), 0, 20)).hasSize(7);
                double finished = replay.status(state.id()).elapsedMs();
                Thread.sleep(30);
                assertThat(replay.status(state.id()).elapsedMs()).isEqualTo(finished);
            } finally { replay.close(); }
        }
    }

    private ReplayRequest request(Algorithm algorithm, int pane, int window, int rate, long limit, ChainstoreReader.WeightMode weights) {
        return new ReplayRequest(algorithm, pane, window, new BigDecimal("0.5"), rate, limit, weights, 3, 42);
    }

    @Test void pausedConfigurationContinuesAtCheckpointWithNewWindowAndPreservedHistory() throws Exception {
        Files.writeString(directory.resolve("investment_table.txt"), "ItemID Total Investment\n====\n1 100\n2 200\n");
        Files.writeString(directory.resolve("transactions.txt"), "1 2:3:1 2\n".repeat(200));
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("config-db").toString(), json)) {
            var service = new StreamService(new StreamStore(archive, json)); var state = service.create();
            var replay = new ReplayService(new ChainstoreSource(directory.toString()), service, json);
            try {
                var original = request(Algorithm.FWUDS_CT, 4, 2, 20, 80, ChainstoreReader.WeightMode.PROVIDED_UTILITY);
                var started = replay.start(state.id(), original);
                var next = request(Algorithm.FWUDS_DWT, 3, 3, 0, 80, ChainstoreReader.WeightMode.PROVIDED_UTILITY);
                assertThatThrownBy(() -> replay.apply(state.id(), new ReplayConfigurationRequest(next, Mode.CONTINUE)))
                        .isInstanceOf(com.cartlens.application.ApplicationException.class);
                assertThat(replay.status(state.id()).request()).isEqualTo(original);
                await().atMost(Duration.ofSeconds(3)).until(() -> state.total() >= 15);
                replay.control(state.id(), "pause");
                await().atMost(Duration.ofSeconds(3)).until(() -> "PAUSED".equals(replay.status(state.id()).state()));
                long checkpoint = state.total(); String oldSession = state.configuration().sessionId();
                var oldHistory = state.results(oldSession, 0, 100);
                var applied = replay.apply(state.id(), new ReplayConfigurationRequest(next, Mode.CONTINUE));
                assertThat(applied.replay().state()).isEqualTo("PAUSED");
                assertThat(applied.replay().runId()).isEqualTo(started.runId());
                assertThat(applied.replay().configurationVersion()).isEqualTo(2);
                assertThat(state.total()).isEqualTo(checkpoint);
                assertThat(state.buffered()).isEqualTo((int) (checkpoint % 3));
                assertThat(state.results(oldSession, 0, 100)).hasSize(oldHistory.size());
                assertThat(state.results(state.configuration().sessionId(), 0, 100)).hasSize(1);
                replay.control(state.id(), "resume");
                await().atMost(Duration.ofSeconds(5)).until(() -> "COMPLETED".equals(replay.status(state.id()).state()) && !state.replaying());
                assertThat(state.total()).isEqualTo(80);
                assertThat(state.transactions(0, 100)).extracting(tx -> tx.id()).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1,80).mapToObj(Integer::toString).toList());
                assertThat(service.compare(state.id(), state.configuration().config()).equivalent()).isTrue();
                assertThat(state.latestAny().result().algorithm()).isEqualTo(Algorithm.FWUDS_DWT);
                assertThat(state.latestAny().result().windowId()).isEqualTo(24);
                service.reset(state.id()); assertThat(replay.status(state.id())).isNull();
            } finally { replay.close(); }
        }
    }

    @Test void weightChangesRequireRestartAndNewRunWaitsForExplicitResume() throws Exception {
        Files.writeString(directory.resolve("investment_table.txt"), "ItemID Total Investment\n====\n1 100\n2 200\n");
        Files.writeString(directory.resolve("transactions.txt"), "1 2:3:1 2\n".repeat(80));
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("weights-db").toString(), json)) {
            var service = new StreamService(new StreamStore(archive, json)); var old = service.create();
            var source = new ChainstoreSource(directory.toString());
            var replay = new ReplayService(source, service, json);
            try {
                replay.start(old.id(), request(Algorithm.FWUDS_CT, 2, 2, 20, 40, ChainstoreReader.WeightMode.PROVIDED_UTILITY));
                await().atMost(Duration.ofSeconds(3)).until(() -> old.total() >= 6);
                replay.control(old.id(), "pause");
                await().atMost(Duration.ofSeconds(3)).until(() -> "PAUSED".equals(replay.status(old.id()).state()));
                long checkpoint = old.total(); String oldSession = old.configuration().sessionId();
                var synthetic = request(Algorithm.FWUDS_DWT, 2, 2, 0, 20, ChainstoreReader.WeightMode.SYNTHETIC_BATCH);
                assertThatThrownBy(() -> replay.apply(old.id(), new ReplayConfigurationRequest(synthetic, Mode.CONTINUE)))
                        .hasMessageContaining("Restart");
                var applied = replay.apply(old.id(), new ReplayConfigurationRequest(synthetic, Mode.RESTART));
                var next = service.get(applied.streamId());
                assertThat(next.id()).isNotEqualTo(old.id()); assertThat(next.total()).isZero();
                assertThat(applied.replay().restartPending()).isTrue(); assertThat(applied.replay().state()).isEqualTo("PAUSED");
                assertThat(old.total()).isEqualTo(checkpoint); assertThat(old.results(oldSession, 0, 100)).isNotEmpty();
                replay.close();
                var restored = new ReplayService(source, new StreamService(new StreamStore(archive, json)), json);
                try {
                    assertThat(restored.status(next.id()).restartPending()).isTrue();
                    assertThat(restored.status(next.id()).request()).isEqualTo(synthetic);
                    restored.control(next.id(), "resume");
                    await().atMost(Duration.ofSeconds(5)).until(() -> "COMPLETED".equals(restored.status(next.id()).state()));
                    assertThat(service.get(next.id()).transactions(0, 100)).hasSize(20);
                    var parsed = ChainstoreReader.parse("1 2:3:1 2", 1, java.util.Map.of("1",BigDecimal.ONE,"2",BigDecimal.ONE), ChainstoreReader.WeightMode.SYNTHETIC_BATCH,3,42);
                    assertThat(service.get(next.id()).transactions(0,1).getFirst()).isEqualTo(parsed);
                } finally { restored.close(); }
            } finally { replay.close(); }
        }
    }

    @Test void failedApplyRestoresOriginalConfigurationAndLeavesCheckpointPaused() throws Exception {
        var metadata = new StringBuilder("ItemID Total Investment\n====\n");
        var input = new StringBuilder();
        for (int line=0; line<8; line++) {
            var ids = new java.util.ArrayList<String>();
            for (int item=1; item<=17; item++) { String id = Integer.toString(line*17+item); ids.add(id); metadata.append(id).append(" 100\n"); }
            input.append(String.join(" ",ids)).append(":17:").append("1 ".repeat(17).trim()).append("\n");
        }
        Files.writeString(directory.resolve("investment_table.txt"),metadata);
        Files.writeString(directory.resolve("transactions.txt"),input);
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("rollback-db").toString(),json)) {
            var service = new StreamService(new StreamStore(archive,json)); var state = service.create();
            var replay = new ReplayService(new ChainstoreSource(directory.toString()),service,json);
            try {
                var original = new ReplayRequest(Algorithm.FWUDS_CT,4,2,BigDecimal.ONE,10,8,ChainstoreReader.WeightMode.PROVIDED_UTILITY,3,42);
                replay.start(state.id(),original);
                await().atMost(Duration.ofSeconds(3)).until(() -> state.total()>=2);
                replay.control(state.id(),"pause");
                await().atMost(Duration.ofSeconds(3)).until(() -> "PAUSED".equals(replay.status(state.id()).state()));
                var settings = state.configuration(); long checkpoint = state.total();
                var excessive = new ReplayRequest(Algorithm.FWUDS_DWT,1,1,BigDecimal.ZERO,0,8,ChainstoreReader.WeightMode.PROVIDED_UTILITY,3,42);
                assertThatThrownBy(() -> replay.apply(state.id(),new ReplayConfigurationRequest(excessive,Mode.CONTINUE))).hasMessageContaining("16 item");
                assertThat(state.configuration()).isEqualTo(settings); assertThat(state.total()).isEqualTo(checkpoint);
                assertThat(state.failure()).isNull(); assertThat(replay.status(state.id()).request()).isEqualTo(original);
                assertThat(replay.status(state.id()).configurationVersion()).isEqualTo(1);
                assertThat(replay.status(state.id()).state()).isEqualTo("PAUSED");
                replay.control(state.id(),"resume");
                await().atMost(Duration.ofSeconds(3)).until(() -> "COMPLETED".equals(replay.status(state.id()).state()));
                assertThat(state.total()).isEqualTo(8);
            } finally { replay.close(); }
        }
    }
}
