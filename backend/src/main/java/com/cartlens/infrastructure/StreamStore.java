package com.cartlens.infrastructure;

import java.util.*;
import java.lang.ref.*;
import org.springframework.stereotype.Repository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.domain.*;

@Repository
public final class StreamStore {
    private final StreamArchive archive;
    private final ObjectMapper json;
    private final LinkedHashMap<String, StreamState> cache = new LinkedHashMap<>(16, .75f, true);
    private final Map<String, StateReference> identities = new HashMap<>();
    private final ReferenceQueue<StreamState> collected = new ReferenceQueue<>();
    public StreamStore(StreamArchive archive, ObjectMapper json) { this.archive = archive; this.json = json; }
    public synchronized StreamState create() {
        var state = new StreamState(archive.metadata(archive.create()), archive, json);
        state.configure(Algorithm.FWUDS_DWT, new MiningConfig(2, 2, new java.math.BigDecimal("0.5")));
        remember(state); return state;
    }
    public synchronized StreamState require(String id) {
        var state = cache.get(id);
        if (state == null) {
            var reference = identities.get(id);
            state = reference == null ? null : reference.get();
            if (state == null) state = new StreamState(archive.metadata(id), archive, json);
            remember(state);
        }
        return state;
    }
    private void evict() {
        var iterator = cache.values().iterator();
        while (cache.size() > 16 && iterator.hasNext()) {
            var state = iterator.next();
            if (!state.replaying()) iterator.remove();
        }
    }
    private void remember(StreamState state) {
        StateReference reference;
        while ((reference = (StateReference) collected.poll()) != null) identities.remove(reference.id, reference);
        identities.put(state.id(), new StateReference(state, collected));
        cache.put(state.id(), state); evict();
    }
    private static final class StateReference extends WeakReference<StreamState> {
        final String id;
        StateReference(StreamState state, ReferenceQueue<StreamState> queue) { super(state, queue); id = state.id(); }
    }
    public List<StreamArchive.Metadata> streams() { return archive.streams(); }
}
