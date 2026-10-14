package com.cartlens.mining;

import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.*;

/** Estimated retained graph size: 64-bit HotSpot, compressed references, 8-byte alignment.
 * Shared objects are counted once per algorithm; this is not a whole-JVM heap measurement. */
public final class RetainedMemory {
    private final Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
    public static long estimate(Object... roots) {
        var meter = new RetainedMemory(); long bytes = 0;
        for (var root : roots) bytes += meter.visit(root);
        return bytes;
    }
    private long visit(Object value) {
        if (value == null || !seen.add(value)) return 0;
        if (value instanceof String s) return 24 + aligned(16L + s.length() * 2L);
        if (value instanceof BigDecimal n) return 40 + visit(n.unscaledValue());
        if (value instanceof BigInteger n) return 40 + aligned(16L + ((n.bitLength() + 31L) / 32L) * 4);
        if (value instanceof Number || value instanceof Boolean || value instanceof Character) return 24;
        if (value instanceof Enum<?>) return 0;
        if (value instanceof BitSet bits) return 24 + aligned(16L + bits.size() / 8L);
        if (value instanceof Map<?, ?> map) {
            long size = 48 + aligned(16L + map.size() * 8L);
            for (var entry : map.entrySet()) size += 32 + visit(entry.getKey()) + visit(entry.getValue());
            return size;
        }
        if (value instanceof Collection<?> rows) {
            long size = value instanceof LinkedList<?> ? 24 + 24L * rows.size() : 24 + aligned(16L + rows.size() * 4L);
            for (var row : rows) size += visit(row);
            return size;
        }
        if (value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            long size = aligned(16L + length * 4L);
            for (int i = 0; i < length; i++) size += visit(java.lang.reflect.Array.get(value, i));
            return size;
        }
        if (!value.getClass().getName().startsWith("com.cartlens.")) return 16;
        long shallow = 12, children = 0;
        for (var field : value.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) continue;
            if (field.getType().isPrimitive()) {
                shallow += field.getType() == long.class || field.getType() == double.class ? 8 : 4;
            } else {
                shallow += 4;
                try { field.setAccessible(true); children += visit(field.get(value)); }
                catch (IllegalAccessException error) { throw new IllegalStateException(error); }
            }
        }
        return aligned(shallow) + children;
    }
    private static long aligned(long bytes) { return (bytes + 7) & ~7L; }
}
