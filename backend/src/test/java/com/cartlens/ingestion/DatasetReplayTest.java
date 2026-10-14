package com.cartlens.ingestion;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.cartlens.api.dto.*;
import com.cartlens.application.StreamService;
import com.cartlens.domain.Algorithm;
import com.cartlens.infrastructure.*;
import com.fasterxml.jackson.databind.ObjectMapper;

class DatasetReplayTest {
    @TempDir Path directory;
    @Test void selectedDatasetIsReadPersistedAndCannotMixWithCheckpointOfAnotherSource() throws Exception {
        for (Dataset dataset : Dataset.values()) {
            var folder = Files.createDirectory(directory.resolve(dataset.directory()));
            String item = dataset == Dataset.RETAIL ? "1" : "2";
            Files.writeString(folder.resolve("investment_table.txt"), "ItemID Total Investment\n====\n"+item+" 100\n");
            Files.writeString(folder.resolve("transactions.txt"), (item+":1:1\n").repeat(8));
        }
        var source = new ChainstoreSource(directory.toString());
        assertThat(source.describe(Dataset.RETAIL).available()).isTrue();
        assertThat(source.fingerprint(Dataset.RETAIL)).isNotEqualTo(source.fingerprint(Dataset.ACCIDENTS));
        var json = new ObjectMapper();
        try (var archive = new StreamArchive(directory.resolve("db").toString(),json)) {
            var service = new StreamService(new StreamStore(archive,json));
            var replay = new ReplayService(source,service,json);
            try {
                var state = service.create();
                replay.start(state.id(), request(Dataset.ACCIDENTS));
                await().atMost(Duration.ofSeconds(5)).until(()->"COMPLETED".equals(replay.status(state.id()).state()) && !state.replaying());
                assertThat(state.transactions(0,8)).allSatisfy(tx->assertThat(tx.items().getFirst().itemId()).isEqualTo("2"));
                assertThat(replay.status(state.id()).request().dataset()).isEqualTo(Dataset.ACCIDENTS);
                assertThat(state.liveSnapshot().ct().result().patterns()).isEqualTo(state.liveSnapshot().dwt().result().patterns());
                assertThatThrownBy(()->replay.apply(state.id(),new ReplayConfigurationRequest(request(Dataset.RETAIL),ReplayConfigurationRequest.Mode.CONTINUE))).isInstanceOf(IllegalArgumentException.class);
                var replacement = replay.apply(state.id(),new ReplayConfigurationRequest(request(Dataset.RETAIL),ReplayConfigurationRequest.Mode.RESTART));
                replay.control(replacement.streamId(),"resume");
                await().atMost(Duration.ofSeconds(5)).until(()->"COMPLETED".equals(replay.status(replacement.streamId()).state()) && !service.get(replacement.streamId()).replaying());
                assertThat(service.get(replacement.streamId()).transactions(0,8)).allSatisfy(tx->assertThat(tx.items().getFirst().itemId()).isEqualTo("1"));
                assertThat(state.total()).isEqualTo(8);
            } finally { replay.close(); }
        }
    }
    private ReplayRequest request(Dataset dataset) {
        return new ReplayRequest(Algorithm.FWUDS_CT,2,2,new BigDecimal("0.5"),0,8,ChainstoreReader.WeightMode.PROVIDED_UTILITY,100,42,dataset);
    }
}
