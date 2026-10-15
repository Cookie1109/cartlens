package com.cartlens.mining.ct;

import java.util.*;

/** Dense CT intersections use machine-word AND while preserving the circular CTset order. */
public final class BitTidList extends AbstractList<Integer> {
    private final BitSet bits;
    private final int current;
    private final int size;
    BitTidList(BitSet ownedBits, int current) { this.bits = ownedBits; this.current = current; this.size = bits.cardinality(); }
    static List<Integer> prepare(List<Integer> ids, int current, int capacity) {
        if (ids.size() < Math.max(64, capacity / 32)) return ids;
        var bits = new BitSet();
        for (int id : ids) bits.set(id);
        return new BitTidList(bits, current);
    }
    BitSet bits() { return bits; }
    public boolean containsTid(int tid) { return bits.get(tid); }
    public long[] words() { return bits.toLongArray(); }
    public BitSet bitSetCopy() { return (BitSet) bits.clone(); }
    @Override public int size() { return size; }
    @Override public Integer get(int index) {
        Objects.checkIndex(index, size);
        var iterator = iterator();
        for (int i = 0; i < index; i++) iterator.next();
        return iterator.next();
    }
    @Override public Iterator<Integer> iterator() {
        return new Iterator<>() {
            int visited;
            int next = first();
            private int first() { int id = bits.nextSetBit(current + 1); return id < 0 ? bits.nextSetBit(1) : id; }
            @Override public boolean hasNext() { return visited < size; }
            @Override public Integer next() {
                if (!hasNext()) throw new NoSuchElementException();
                int value = next;
                next = bits.nextSetBit(value + 1);
                if (next < 0) next = bits.nextSetBit(1);
                visited++;
                return value;
            }
        };
    }
    @Override public Spliterator<Integer> spliterator() { return Spliterators.spliterator(iterator(), size, Spliterator.ORDERED | Spliterator.IMMUTABLE); }
}
