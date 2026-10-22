package com.cartlens.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(properties="cartlens.archive-path=./target/api-test-archive")
@AutoConfigureMockMvc
class StreamApiIntegrationTest {
	@Autowired MockMvc mockMvc;
	@Autowired ObjectMapper objectMapper;

    @Test void auditIsIsolatedByAlgorithmSessionAndWindowAndExcludedFromLive() throws Exception {
        String created = mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(created).get("streamId").asText();
        String overview = mockMvc.perform(get("/api/v1/streams/{id}/overview", id)).andReturn().getResponse().getContentAsString();
        String session = objectMapper.readTree(overview).get("configuration").get("sessionId").asText();
        mockMvc.perform(get("/api/v1/streams/{id}/audit/FWUDS_CT", id).param("sessionId", session).param("windowId", "1"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/audit/FWUDS_CT", id).param("sessionId", session))
                .andExpect(status().isNotFound());
        for (int t = 1; t <= 6; t++) {
            mockMvc.perform(post("/api/v1/streams/{id}/transactions", id).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"id\":\"audit-" + t + "\",\"items\":[{\"itemId\":\"A\",\"quantity\":1,\"weight\":1}]}"))
                    .andExpect(status().isCreated());
            if (t != 4 && t != 6) continue;
            String window = t == 4 ? "1" : "2";
            for (String algorithm : java.util.List.of("FWUDS_CT", "FWUDS_DWT")) {
                mockMvc.perform(get("/api/v1/streams/{id}/audit/{algorithm}", id, algorithm)
                        .param("sessionId", session).param("windowId", "999").param("latest", "true"))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.windowId").value(Integer.parseInt(window)))
                        .andExpect(jsonPath("$.algorithm").value(algorithm));
                mockMvc.perform(get("/api/v1/streams/{id}/audit/{algorithm}", id, algorithm).param("sessionId", session))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.windowId").value(Integer.parseInt(window)))
                        .andExpect(jsonPath("$.algorithm").value(algorithm)).andExpect(jsonPath("$.samples[0].numerator").value(4));
                mockMvc.perform(get("/api/v1/streams/{id}/audit/{algorithm}", id, algorithm)
                        .param("sessionId", session).param("windowId", window)).andExpect(status().isOk())
                        .andExpect(jsonPath("$.algorithm").value(algorithm)).andExpect(jsonPath("$.sumTwu").value(4))
                        .andExpect(jsonPath("$.patternCount").value(1)).andExpect(jsonPath("$.samples[0].numerator").value(4))
                        .andExpect(jsonPath("$.samples[0].wus").value(1))
                        .andExpect(jsonPath("$.samples[0].operation").value(algorithm.equals("FWUDS_CT") ? "CT_SINGLETON" : "DWT_SINGLETON"));
            }
        }
        for (String algorithm : java.util.List.of("FWUDS_CT", "FWUDS_DWT", "ORACLE"))
            mockMvc.perform(get("/api/v1/streams/{id}/audit/{algorithm}", id, algorithm).param("sessionId", session).param("windowId", "1"))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESULT_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/streams/{id}/audit/FWUDS_CT", id).param("sessionId", "old").param("windowId", "2"))
                .andExpect(status().isNotFound());
        for (String algorithm : java.util.List.of("FWUDS_CT", "FWUDS_DWT", "ORACLE"))
            mockMvc.perform(get("/api/v1/streams/{id}/audit/{algorithm}", id, algorithm).param("sessionId", "old"))
                    .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/audit/ORACLE", id).param("sessionId", session)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/live", id)).andExpect(jsonPath("$.audit").doesNotExist())
                .andExpect(jsonPath("$.ct.samples").doesNotExist());
        mockMvc.perform(delete("/api/v1/streams/{id}/transactions", id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/streams/{id}/audit/FWUDS_CT", id).param("sessionId", session).param("windowId", "2"))
                .andExpect(status().isNotFound());
    }

    @Test
    void fullDwtTreeIncludesNodesBeyondLivePreviewAndRejectsStaleWindows() throws Exception {
        String created = mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(created).get("streamId").asText();
        String configured = mockMvc.perform(post("/api/v1/streams/{id}/configuration", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"algorithm\":\"FWUDS_DWT\",\"paneSize\":70,\"windowPaneCount\":1,\"minWus\":0.9}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String session = objectMapper.readTree(configured).get("configuration").get("sessionId").asText();
        for (int i = 0; i < 70; i++) {
            String input = objectMapper.writeValueAsString(java.util.Map.of("id", "tree-" + i, "items", java.util.List.of(
                    java.util.Map.of("itemId", "C", "quantity", 1, "weight", 1),
                    java.util.Map.of("itemId", "item-" + i, "quantity", 1, "weight", 1))));
            mockMvc.perform(post("/api/v1/streams/{id}/transactions", id).contentType(MediaType.APPLICATION_JSON).content(input))
                    .andExpect(status().isCreated());
        }
        mockMvc.perform(get("/api/v1/streams/{id}/live", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.ctStructure.ctsets.length()").value(32))
                .andExpect(jsonPath("$.ctStructure.totalEntries").value(71))
                .andExpect(jsonPath("$.dwtStructure.nodes.length()").value(64))
                .andExpect(jsonPath("$.dwtStructure.totalEntries").value(72));
        mockMvc.perform(get("/api/v1/streams/{id}/structures/ct", id).param("sessionId", session).param("windowId", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ctsets.length()").value(71))
                .andExpect(jsonPath("$.totalEntries").value(71));
        mockMvc.perform(get("/api/v1/streams/{id}/structures/ct", id).param("sessionId", session).param("windowId", "2"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/structures/ct", id).param("sessionId", "old-session").param("windowId", "1"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/structures/dwt", id).param("sessionId", session).param("windowId", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nodes.length()").value(72))
                .andExpect(jsonPath("$.totalEntries").value(72));
        mockMvc.perform(get("/api/v1/streams/{id}/structures/dwt", id).param("sessionId", session).param("windowId", "2"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/streams/{id}/structures/dwt", id).param("sessionId", "old-session").param("windowId", "1"))
                .andExpect(status().isNotFound());
    }

	@Test
	void completeTransactionRunResultCompareAndResetFlow() throws Exception {
		String created = mockMvc.perform(post("/api/v1/streams"))
				.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		String streamId = objectMapper.readTree(created).get("streamId").asText();

		String[] transactions = {
			"""
			{"id":"t1","items":[{"itemId":"A","name":"A","quantity":1,"weight":0.2},{"itemId":"C","name":"C","quantity":2,"weight":0.2},{"itemId":"D","name":"D","quantity":2,"weight":0.4},{"itemId":"E","name":"E","quantity":1,"weight":0.5}]}
			""",
			"""
			{"id":"t2","items":[{"itemId":"B","name":"B","quantity":2,"weight":0.4},{"itemId":"C","name":"C","quantity":1,"weight":0.2},{"itemId":"D","name":"D","quantity":2,"weight":0.4},{"itemId":"E","name":"E","quantity":2,"weight":0.5}]}
			""",
			"""
			{"id":"t3","items":[{"itemId":"A","name":"A","quantity":2,"weight":0.2},{"itemId":"C","name":"C","quantity":1,"weight":0.2},{"itemId":"E","name":"E","quantity":1,"weight":0.5}]}
			""",
			"""
			{"id":"t4","items":[{"itemId":"A","name":"A","quantity":1,"weight":0.5},{"itemId":"C","name":"C","quantity":3,"weight":0.4},{"itemId":"D","name":"D","quantity":2,"weight":0.6}]}
			"""
		};
		for (String transaction : transactions) {
			mockMvc.perform(post("/api/v1/streams/{id}/transactions", streamId)
					.contentType(MediaType.APPLICATION_JSON).content(transaction)).andExpect(status().isCreated());
		}

		mockMvc.perform(post("/api/v1/streams/{id}/transactions", streamId)
				.contentType(MediaType.APPLICATION_JSON).content(transactions[0]))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_TRANSACTION_ID"));

		String run = """
				{"algorithm":"FWUDS_CT","paneSize":2,"windowPaneCount":2,"minWus":0.5}
				""";
		mockMvc.perform(post("/api/v1/streams/{id}/runs", streamId).contentType(MediaType.APPLICATION_JSON).content(run))
				.andExpect(status().isOk()).andExpect(jsonPath("$.algorithm").value("FWUDS_CT"))
				.andExpect(jsonPath("$.windowId").value(1)).andExpect(jsonPath("$.patterns").isArray());
		mockMvc.perform(get("/api/v1/streams/{id}/results/latest", streamId).param("algorithm", "FWUDS_CT"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.config.paneSize").value(2));

		String comparison = """
				{"paneSize":2,"windowPaneCount":2,"minWus":0.5}
				""";
		mockMvc.perform(post("/api/v1/streams/{id}/comparisons", streamId)
				.contentType(MediaType.APPLICATION_JSON).content(comparison))
				.andExpect(status().isOk()).andExpect(jsonPath("$.equivalent").value(true))
				.andExpect(jsonPath("$.differences").isEmpty());

		mockMvc.perform(get("/api/v1/streams/{id}/overview", streamId))
				.andExpect(status().isOk()).andExpect(jsonPath("$.transactionCount").value(4));
		mockMvc.perform(delete("/api/v1/streams/{id}/transactions", streamId)).andExpect(status().isNoContent());
		mockMvc.perform(get("/api/v1/streams/{id}/transactions", streamId))
				.andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void returnsStableValidationAndWindowErrors() throws Exception {
		String created = mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
		String streamId = objectMapper.readTree(created).get("streamId").asText();
		mockMvc.perform(post("/api/v1/streams/{id}/transactions", streamId)
				.contentType(MediaType.APPLICATION_JSON).content("""
						{"id":"","items":[]}
						"""))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors").isNotEmpty());
		mockMvc.perform(post("/api/v1/streams/{id}/runs", streamId).contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"algorithm":"FWUDS_DWT","paneSize":2,"windowPaneCount":2,"minWus":0.5}
						"""))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WINDOW_NOT_READY"));
		mockMvc.perform(get("/api/v1/streams/missing/transactions"))
				.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("STREAM_NOT_FOUND"));
	}
    @Test
    void automaticallyMinesWithoutRunRequestAndPagesHistoricalPatterns() throws Exception {
        String created=mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
        String id=objectMapper.readTree(created).get("streamId").asText();
        String configuration="{\"algorithm\":\"FWUDS_DWT\",\"paneSize\":1,\"windowPaneCount\":2,\"minWus\":0.5}";
        mockMvc.perform(post("/api/v1/streams/{id}/configuration",id).contentType(MediaType.APPLICATION_JSON).content(configuration)).andExpect(status().isOk());
        String[] inputs={"{\"id\":\"t1\",\"items\":[{\"itemId\":\"A\",\"quantity\":1,\"weight\":1}]}",
            "{\"id\":\"t2\",\"items\":[{\"itemId\":\"A\",\"quantity\":1,\"weight\":1}]}",
            "{\"id\":\"t3\",\"items\":[{\"itemId\":\"X\",\"quantity\":1,\"weight\":1},{\"itemId\":\"Y\",\"quantity\":1,\"weight\":1}]}"};
        for(String input:inputs) mockMvc.perform(post("/api/v1/streams/{id}/transactions",id).contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isCreated());
        String body=mockMvc.perform(get("/api/v1/streams/{id}/overview",id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.latestRun.windowId").value(2)).andExpect(jsonPath("$.latestRun.patternCount").value(4))
            .andExpect(jsonPath("$.latestRun.patterns").isEmpty()).andExpect(jsonPath("$.metrics.processedTransactions").value(3)).andReturn().getResponse().getContentAsString();
        String session=objectMapper.readTree(body).get("configuration").get("sessionId").asText();
        mockMvc.perform(get("/api/v1/streams/{id}/results",id)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/api/v1/streams/{id}/results/window",id).param("sessionId",session).param("windowId","2").param("patternAfter","2").param("limit","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.patternCount").value(4)).andExpect(jsonPath("$.patterns.length()").value(1))
            .andExpect(jsonPath("$.patterns[0].items[0]").value("X")).andExpect(jsonPath("$.patterns[0].items[1]").value("Y"));
        mockMvc.perform(get("/api/v1/streams/{id}/results/window",id).param("sessionId",session).param("windowId","1").param("limit","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.patterns[0].items[0]").value("A"));
        mockMvc.perform(get("/api/v1/streams/{id}/transactions",id).param("after","1").param("limit","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value("t2"));
        mockMvc.perform(get("/api/v1/streams/{id}/transactions",id).param("limit","10000"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/streams/{id}/replay",id)).andExpect(status().isNoContent());
    }

    @Test
    void rejectsFractionalQuantityAndOverflowingWindowConfiguration() throws Exception {
        String body=mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
        String id=objectMapper.readTree(body).get("streamId").asText();
        mockMvc.perform(post("/api/v1/streams/{id}/transactions",id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"id\":\"fraction\",\"items\":[{\"itemId\":\"A\",\"quantity\":1.5,\"weight\":1}]}"))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/streams/{id}/configuration",id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"algorithm\":\"FWUDS_CT\",\"paneSize\":2147483647,\"windowPaneCount\":2,\"minWus\":0.5}"))
            .andExpect(status().isBadRequest());
    }


    @Test void replayApplyValidatesNestedConfigurationBeforeMutation() throws Exception {
        String created = mockMvc.perform(post("/api/v1/streams")).andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(created).get("streamId").asText();
        mockMvc.perform(post("/api/v1/streams/{id}/replay/configuration",id).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
        mockMvc.perform(post("/api/v1/streams/{id}/replay/configuration",id).contentType(MediaType.APPLICATION_JSON).content("""
                {"mode":"CONTINUE","configuration":{"algorithm":"FWUDS_CT","paneSize":0,"windowPaneCount":2,"minWus":2,"transactionsPerSecond":10,"maxTransactions":0,"weightMode":"PROVIDED_UTILITY","weightBatchSize":3,"seed":42}}
                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors").isNotEmpty());
        mockMvc.perform(get("/api/v1/streams/{id}/overview",id)).andExpect(jsonPath("$.transactionCount").value(0));
    }
}
