package com.cartlens.mining.ct;

import java.util.AbstractList;
import java.util.Arrays;
import java.util.RandomAccess;

/** An immutable primitive snapshot; no boxed Integer per transaction is retained. */
final class IntTidList extends AbstractList<Integer> implements RandomAccess {
    private final int[] values;
    IntTidList(int[] values) { this.values = values; }
    static IntTidList copyOf(int[] values, int length) { return new IntTidList(Arrays.copyOf(values, length)); }
    @Override public Integer get(int index) { return values[java.util.Objects.checkIndex(index, values.length)]; }
    @Override public int size() { return values.length; }
}
