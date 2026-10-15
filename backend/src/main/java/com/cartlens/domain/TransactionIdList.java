package com.cartlens.domain;

import java.security.MessageDigest;
import java.util.*;

/** Immutable selections sharing one ID dictionary per result window. */
public final class TransactionIdList extends AbstractList<String> {
    public static final class Window {
        private final String[] ids;
        public Window(String[] ids) { this.ids = ids.clone(); }
        public TransactionIdList select(int[] positions) {
            int previous = -1;
            for (int position : positions) {
                if (position <= previous || position >= ids.length) throw new IllegalArgumentException("positions must be ordered and unique");
                previous = position;
            }
            return new TransactionIdList(this, positions);
        }
        public TransactionIdList select(BitSet positions) {
            if (positions.length() > ids.length) throw new IllegalArgumentException("position exceeds window");
            return new TransactionIdList(this, positions);
        }
        public List<String> ids() { return Collections.unmodifiableList(Arrays.asList(ids)); }
    }
    private final Window window;
    private final int[] sparse;
    private final BitSet dense;
    private final int size;

    private TransactionIdList(Window window, int[] positions) {
        this.window = window;
        this.size = positions.length;
        int words = positions.length == 0 ? 0 : (positions[positions.length - 1] >>> 6) + 1;
        if ((long) words * Long.BYTES < (long) positions.length * Integer.BYTES) {
            dense = new BitSet();
            for (int position : positions) dense.set(position);
            sparse = null;
        } else {
            sparse = positions.clone();
            dense = null;
        }
    }
    private TransactionIdList(Window window, BitSet positions) {
        this.window = window;
        this.size = positions.cardinality();
        if ((long) positions.length() / 8 < (long) size * Integer.BYTES) {
            dense = (BitSet) positions.clone(); sparse = null;
        } else {
            sparse = positions.stream().toArray(); dense = null;
        }
    }
    @Override public int size() { return size; }
    @Override public String get(int index) {
        Objects.checkIndex(index, size);
        if (sparse != null) return window.ids[sparse[index]];
        int bit = dense.nextSetBit(0);
        for (int i = 0; i < index; i++) bit = dense.nextSetBit(bit + 1);
        return window.ids[bit];
    }
    @Override public Iterator<String> iterator() {
        return new Iterator<>() {
            int index;
            int nextBit = dense == null ? -1 : dense.nextSetBit(0);
            @Override public boolean hasNext() { return index < size; }
            @Override public String next() {
                if (!hasNext()) throw new NoSuchElementException();
                int position = sparse == null ? nextBit : sparse[index];
                if (dense != null) nextBit = dense.nextSetBit(nextBit + 1);
                index++;
                return window.ids[position];
            }
        };
    }
    @Override public Spliterator<String> spliterator() {
        return Spliterators.spliterator(iterator(), size, Spliterator.ORDERED | Spliterator.IMMUTABLE | Spliterator.NONNULL);
    }
    @Override public boolean equals(Object other) {
        if (other == this) return true;
        if (!(other instanceof List<?> list) || list.size() != size) return false;
        var left = iterator(); var right = list.iterator();
        while (left.hasNext()) if (!Objects.equals(left.next(), right.next())) return false;
        return true;
    }
    @Override public int hashCode() {
        int hash = 1;
        for (String id : this) hash = 31 * hash + id.hashCode();
        return hash;
    }
    public Window window() { return window; }
    public long storageBytes() { return 48L + (sparse == null ? dense.size() / 8L : sparse.length * 4L); }
    /** Canonical positions, independent of sparse/dense representation. The caller hashes the dictionary once. */
    public void updateSelectionDigest(MessageDigest digest) {
        BitSet bits;
        if (dense != null) bits = dense;
        else { bits = new BitSet(); for (int position : sparse) bits.set(position); }
        long[] words = bits.toLongArray();
        var bytes = java.nio.ByteBuffer.allocate(4 + words.length * Long.BYTES).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        bytes.putInt(words.length);
        for (long word : words) bytes.putLong(word);
        digest.update(bytes.array());
    }
}
