package com.cartlens.mining.ct;

import java.util.List;

public final class CircularTidset {
    private int[] ids = new int[4];
    private int head;
    private int size;
    private List<Integer> snapshot;

    public void add(int lcTid) {
        if (size == ids.length) {
            int[] grown = new int[Math.multiplyExact(ids.length, 2)];
            for (int i = 0; i < size; i++) grown[i] = ids[(head + i) % ids.length];
            ids = grown;
            head = 0;
        }
        ids[(head + size) % ids.length] = lcTid;
        size++;
        snapshot = null;
    }

    public void removeOldestRange(int fromInclusive, int toInclusive) {
        while (size > 0) {
            int value = ids[head];
            if (value < fromInclusive || value > toInclusive) break;
            head = (head + 1) % ids.length;
            size--;
            snapshot = null;
        }
    }

    public List<Integer> values() {
        if (snapshot == null) {
            int[] ordered = new int[size];
            int first = Math.min(size, ids.length - head);
            System.arraycopy(ids, head, ordered, 0, first);
            System.arraycopy(ids, 0, ordered, first, size - first);
            snapshot = new IntTidList(ordered);
        }
        return snapshot;
    }

    public int size() { return size; }
}
