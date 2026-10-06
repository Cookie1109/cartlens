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

@SpringBootTest
@AutoConfigureMockMvc
class StreamApiIntegrationTest {
	@Autowired MockMvc mockMvc;
	@Autowired ObjectMapper objectMapper;

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
}
