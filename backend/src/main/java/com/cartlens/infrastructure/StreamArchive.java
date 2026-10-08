package com.cartlens.infrastructure;

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

import org.h2.jdbcx.JdbcConnectionPool;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cartlens.application.*;
import com.cartlens.domain.*;
import jakarta.annotation.PreDestroy;

/** Durable, indexed archive. Paging/replay never loads the full transaction history into RAM. */
@Repository
public final class StreamArchive implements AutoCloseable {
    private final JdbcConnectionPool pool;
    private final ObjectMapper json;

    public StreamArchive(@Value("${cartlens.archive-path:./data/cartlens}") String file, ObjectMapper json) {
        this.json = json.copy().enable(com.fasterxml.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
        try {
            Path target = Path.of(file).toAbsolutePath().normalize();
            Files.createDirectories(target.getParent());
            pool = JdbcConnectionPool.create("jdbc:h2:file:" + target.toString().replace('\\', '/')
                    + ";CACHE_SIZE=8192;DB_CLOSE_ON_EXIT=FALSE", "sa", "");
            pool.setMaxConnections(8);
            try (var connection = pool.getConnection(); var statement = connection.createStatement()) {
                statement.execute("CREATE TABLE IF NOT EXISTS streams (id VARCHAR PRIMARY KEY, total BIGINT NOT NULL DEFAULT 0, configuration VARCHAR, replay VARCHAR)");
                statement.execute("CREATE TABLE IF NOT EXISTS transactions (stream_id VARCHAR NOT NULL, seq BIGINT NOT NULL, transaction_id VARCHAR NOT NULL, payload VARBINARY NOT NULL, PRIMARY KEY(stream_id,seq), UNIQUE(stream_id,transaction_id), FOREIGN KEY(stream_id) REFERENCES streams(id))");
                statement.execute("CREATE TABLE IF NOT EXISTS results (stream_id VARCHAR NOT NULL, session_id VARCHAR NOT NULL, window_id BIGINT NOT NULL, algorithm VARCHAR NOT NULL, payload VARCHAR NOT NULL, PRIMARY KEY(stream_id,session_id,window_id), FOREIGN KEY(stream_id) REFERENCES streams(id))");
                statement.execute("ALTER TABLE results ADD COLUMN IF NOT EXISTS summary VARCHAR");
            }
        } catch (Exception error) { throw new IllegalStateException("Không mở được archive", error); }
    }

    public String create() {
        String id = UUID.randomUUID().toString();
        execute("INSERT INTO streams(id) VALUES(?)", id);
        return id;
    }

    public Metadata metadata(String id) {
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT total,configuration,replay FROM streams WHERE id=?")) {
            p.setString(1, id);
            try (var rows = p.executeQuery()) {
                if (!rows.next()) throw new ApplicationException(ErrorCode.STREAM_NOT_FOUND, "Không tìm thấy stream " + id);
                return new Metadata(id, rows.getLong(1), rows.getString(2), rows.getString(3));
            }
        } catch (SQLException error) { throw failure(error); }
    }

    public List<Metadata> streams() {
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT id,total,configuration,replay FROM streams ORDER BY id"); var r = p.executeQuery()) {
            var list = new ArrayList<Metadata>();
            while (r.next()) list.add(new Metadata(r.getString(1), r.getLong(2), r.getString(3), r.getString(4)));
            return list;
        } catch (SQLException error) { throw failure(error); }
    }

    public void append(String id, long previousCount, List<Transaction> transactions) { append(id, previousCount, transactions, null); }

    public void append(String id, long previousCount, List<Transaction> transactions, String checkpoint) {
        try (var c = pool.getConnection()) {
            c.setAutoCommit(false);
            try (var p = c.prepareStatement("INSERT INTO transactions(stream_id,seq,transaction_id,payload) VALUES(?,?,?,?)")) {
                long sequence = previousCount;
                for (var tx : transactions) {
                    p.setString(1, id); p.setLong(2, ++sequence);
                    p.setString(3, tx.id().toLowerCase(Locale.ROOT)); p.setBytes(4, encode(tx)); p.addBatch();
                }
                p.executeBatch();
                try (var update = c.prepareStatement("UPDATE streams SET total=?,replay=COALESCE(?,replay) WHERE id=? AND total=?")) {
                    update.setLong(1, sequence); update.setString(2, checkpoint); update.setString(3, id); update.setLong(4, previousCount);
                    if (update.executeUpdate() != 1) throw new SQLException("Concurrent archive append");
                }
                c.commit();
            } catch (Exception error) {
                c.rollback();
                if (error instanceof SQLException sql && "23505".equals(sql.getSQLState()))
                    throw new ApplicationException(ErrorCode.DUPLICATE_TRANSACTION_ID, "Mã giao dịch đã tồn tại trong stream.");
                throw failure(error);
            }
        } catch (SQLException error) { throw failure(error); }
    }

    public List<Transaction> page(String id, long after, int limit) {
        if (after < 0 || limit < 1 || limit > 1000) throw new IllegalArgumentException("after>=0; limit trong [1,1000]");
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT payload FROM transactions WHERE stream_id=? AND seq>? ORDER BY seq FETCH FIRST ? ROWS ONLY")) {
            p.setString(1, id); p.setLong(2, after); p.setInt(3, limit);
            try (var rows = p.executeQuery()) {
                var list = new ArrayList<Transaction>();
                while (rows.next()) list.add(decode(rows.getBytes(1)));
                return list;
            }
        } catch (SQLException error) { throw failure(error); }
    }

    public long latestWindow(String id, String session) {
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT COALESCE(MAX(window_id),0) FROM results WHERE stream_id=? AND session_id=?")) {
            p.setString(1,id); p.setString(2,session);
            try (var rows = p.executeQuery()) { rows.next(); return rows.getLong(1); }
        } catch (SQLException error) { throw failure(error); }
    }

    public void configure(String id, String configuration) { execute("UPDATE streams SET configuration=? WHERE id=?", configuration, id); }
    public void replay(String id, String replay) { execute("UPDATE streams SET replay=? WHERE id=?", replay, id); }

    public void result(String id, StreamState.RunRecord run) {
        var result = run.result();
        var patterns = result.patterns().stream().map(p -> Map.of("items", p.pattern().items(), "wus", p.wus(),
                "support", p.support(), "transactionIds", p.transactionIds())).toList();
        try {
            String payload = json.writeValueAsString(Map.of("config", result.config(), "patterns", patterns,
                    "executionTimeMs", result.executionTimeMs(), "windowTransactionCount", result.windowTransactionCount()));
            String summary = json.writeValueAsString(Map.of("config", result.config(), "executionTimeMs", result.executionTimeMs(), "windowTransactionCount", result.windowTransactionCount(), "patternCount", result.patterns().size()));
            execute("MERGE INTO results(stream_id,session_id,window_id,algorithm,payload,summary) KEY(stream_id,session_id,window_id) VALUES(?,?,?,?,?,?)",
                    id, run.runId(), result.windowId(), result.algorithm().name(), payload, summary);
        } catch (IOException error) { throw failure(error); }
    }

    public List<StreamState.RunRecord> results(String id, String session, long after, int limit) {
        if (limit < 1 || limit > 100 || after < 0) throw new IllegalArgumentException("limit trong [1,100]; after>=0");
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT window_id,algorithm,payload FROM results WHERE stream_id=? AND session_id=? AND window_id>? ORDER BY window_id FETCH FIRST ? ROWS ONLY")) {
            p.setString(1, id); p.setString(2, session); p.setLong(3, after); p.setInt(4, limit);
            try (var r = p.executeQuery()) {
                var list = new ArrayList<StreamState.RunRecord>();
                while (r.next()) {
                    var node = json.readTree(r.getString(3));
                    var config = json.treeToValue(node.get("config"), MiningConfig.class);
                    var patterns = new ArrayList<PatternResult>();
                    for (var item : node.get("patterns")) {
                        var ids = new ArrayList<String>(); item.get("transactionIds").forEach(v -> ids.add(v.asText()));
                        var items = new ArrayList<String>(); item.get("items").forEach(v -> items.add(v.asText()));
                        patterns.add(new PatternResult(new Pattern(items), new BigDecimal(item.get("wus").asText()), item.get("support").asInt(), ids));
                    }
                    list.add(new StreamState.RunRecord(session, new MiningResult(r.getLong(1), Algorithm.valueOf(r.getString(2)), config,
                            patterns, node.get("executionTimeMs").asLong(), node.get("windowTransactionCount").asInt())));
                }
                return list;
            }
        } catch (Exception error) { throw failure(error); }
    }

    public List<RunSummary> summaries(String id, String session, long after, int limit) {
        if (limit < 1 || limit > 100 || after < 0) throw new IllegalArgumentException("limit trong [1,100]; after>=0");
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT window_id,algorithm,summary FROM results WHERE stream_id=? AND session_id=? AND window_id>? ORDER BY window_id FETCH FIRST ? ROWS ONLY")) {
            p.setString(1,id); p.setString(2,session); p.setLong(3,after); p.setInt(4,limit);
            try (var rows = p.executeQuery()) {
                var summaries = new ArrayList<RunSummary>();
                while (rows.next()) {
                    String text = rows.getString(3);
                    if (text==null) {
                        var legacy=results(id,session,rows.getLong(1)-1,1).getFirst().result();
                        summaries.add(new RunSummary(session,legacy.windowId(),legacy.algorithm(),legacy.config(),legacy.executionTimeMs(),legacy.windowTransactionCount(),legacy.patterns().size()));
                        continue;
                    }
                    var node = json.readTree(text);
                    summaries.add(new RunSummary(session,rows.getLong(1),Algorithm.valueOf(rows.getString(2)),json.treeToValue(node.get("config"),MiningConfig.class),
                            node.get("executionTimeMs").asLong(),node.get("windowTransactionCount").asInt(),node.get("patternCount").asInt()));
                }
                return summaries;
            }
        } catch (Exception error) { throw failure(error); }
    }

    public List<PatternResult> patternPage(String id, String session, long window, int after, int limit) {
        if (after < 0 || limit < 1 || limit > 1000) throw new IllegalArgumentException("patternAfter>=0; limit trong [1,1000]");
        try (var c = pool.getConnection(); var p = c.prepareStatement("SELECT payload FROM results WHERE stream_id=? AND session_id=? AND window_id=?")) {
            p.setString(1,id); p.setString(2,session); p.setLong(3,window);
            try (var rows = p.executeQuery()) {
                if (!rows.next()) throw new ApplicationException(ErrorCode.RESULT_NOT_FOUND,"Không có window này.");
                try (var reader = rows.getCharacterStream(1); var parser = json.getFactory().createParser(reader)) {
                    var patterns = new ArrayList<PatternResult>();
                    while (parser.nextToken() != null) {
                        if (parser.currentToken() == com.fasterxml.jackson.core.JsonToken.FIELD_NAME && "patterns".equals(parser.currentName())) {
                            parser.nextToken(); int index=0;
                            while (parser.nextToken() != com.fasterxml.jackson.core.JsonToken.END_ARRAY) {
                                if (index++ < after || patterns.size() >= limit) { parser.skipChildren(); continue; }
                                com.fasterxml.jackson.databind.JsonNode node = json.readTree(parser); var items = new ArrayList<String>(); var ids = new ArrayList<String>();
                                node.get("items").forEach(v -> items.add(v.asText())); node.get("transactionIds").forEach(v -> ids.add(v.asText()));
                                patterns.add(new PatternResult(new Pattern(items),new BigDecimal(node.get("wus").asText()),node.get("support").asInt(),ids));
                                if (patterns.size()>=limit) return patterns;
                            }
                            return patterns;
                        }
                    }
                    return patterns;
                }
            }
        } catch (ApplicationException error) { throw error; }
        catch (Exception error) { throw failure(error); }
    }

    public record RunSummary(String sessionId,long windowId,Algorithm algorithm,MiningConfig config,long executionTimeMs,int windowTransactionCount,int patternCount) { }

    public void reset(String id) {
        try (var c = pool.getConnection()) {
            c.setAutoCommit(false);
            for (String table : List.of("transactions", "results")) {
                try (var p = c.prepareStatement("DELETE FROM " + table + " WHERE stream_id=?")) { p.setString(1, id); p.executeUpdate(); }
            }
            try (var p = c.prepareStatement("UPDATE streams SET total=0,configuration=NULL,replay=NULL WHERE id=?")) { p.setString(1, id); p.executeUpdate(); }
            c.commit();
        } catch (SQLException error) { throw failure(error); }
    }

    private void execute(String sql, Object... args) {
        try (var c = pool.getConnection(); var p = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) p.setObject(i + 1, args[i]);
            p.executeUpdate();
        } catch (SQLException error) { throw failure(error); }
    }

    private static byte[] encode(Transaction tx) {
        try (var buffer = new ByteArrayOutputStream(); var out = new DataOutputStream(buffer)) {
            out.writeUTF(tx.id()); out.writeUTF(tx.twu().toPlainString()); out.writeInt(tx.items().size());
            for (var item : tx.items()) {
                out.writeUTF(item.itemId()); out.writeUTF(item.name()); out.writeInt(item.quantity()); out.writeUTF(item.weight().toPlainString());
            }
            return buffer.toByteArray();
        } catch (IOException error) { throw failure(error); }
    }

    private static Transaction decode(byte[] bytes) {
        try (var input = new DataInputStream(new ByteArrayInputStream(bytes))) {
            String id = input.readUTF(); BigDecimal twu = new BigDecimal(input.readUTF()); int count = input.readInt();
            var items = new ArrayList<TransactionItem>(count);
            for (int i = 0; i < count; i++) items.add(new TransactionItem(input.readUTF(), input.readUTF(), input.readInt(), new BigDecimal(input.readUTF())));
            return new Transaction(id, items, twu);
        } catch (IOException error) { throw failure(error); }
    }

    private static IllegalStateException failure(Exception error) { return new IllegalStateException("Lỗi đọc/ghi archive", error); }
    @PreDestroy @Override public void close() { pool.dispose(); }
    public record Metadata(String id, long total, String configuration, String replay) { }
}
