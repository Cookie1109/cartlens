package com.cartlens.infrastructure;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Repository;

import com.cartlens.application.ApplicationException;
import com.cartlens.application.ErrorCode;

@Repository
public class InMemoryStreamStore {
	private final ConcurrentHashMap<String, StreamState> streams = new ConcurrentHashMap<>();

	public StreamState create() {
		String id = UUID.randomUUID().toString();
		var state = new StreamState(id);
		streams.put(id, state);
		return state;
	}

	public StreamState require(String id) {
		StreamState state = streams.get(id);
		if (state == null) {
			throw new ApplicationException(ErrorCode.STREAM_NOT_FOUND, "Không tìm thấy stream " + id + ".");
		}
		return state;
	}
}
