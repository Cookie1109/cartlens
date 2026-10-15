package com.cartlens.mining;

import java.math.*;
import java.nio.ByteBuffer;
import java.util.List;
import com.cartlens.mining.ct.BitTidList;

/** Exact fixed-point sums; unsupported scales/magnitudes fall back to BigDecimal. */
final class FixedTwuIndex {
    private static final int SCALE = 34;
    private final int[] d0, d1, d2, d3;
    private final long[] b0, b1, b2, b3;
    private boolean enabled = true;
    FixedTwuIndex(int capacity) {
        d0 = new int[capacity + 1]; d1 = new int[capacity + 1]; d2 = new int[capacity + 1]; d3 = new int[capacity + 1];
        b0 = new long[(capacity >>> 6) + 1]; b1 = new long[b0.length]; b2 = new long[b0.length]; b3 = new long[b0.length];
    }
    void put(int tid, BigDecimal value) {
        if (!enabled) return;
        value = value.stripTrailingZeros();
        if (value.scale() > SCALE || (long) value.precision() - value.scale() + SCALE > 39) { enabled = false; return; }
        BigInteger units = value.setScale(SCALE).unscaledValue();
        if (units.signum() < 0 || units.bitLength() > 128) { enabled = false; return; }
        d0[tid] = units.intValue(); d1[tid] = units.shiftRight(32).intValue();
        d2[tid] = units.shiftRight(64).intValue(); d3[tid] = units.shiftRight(96).intValue();
        int block = tid >>> 6;
        b0[block] += Integer.toUnsignedLong(d0[tid]); b1[block] += Integer.toUnsignedLong(d1[tid]);
        b2[block] += Integer.toUnsignedLong(d2[tid]); b3[block] += Integer.toUnsignedLong(d3[tid]);
    }
    void remove(int tid) {
        if (!enabled) return;
        int block = tid >>> 6;
        b0[block] -= Integer.toUnsignedLong(d0[tid]); b1[block] -= Integer.toUnsignedLong(d1[tid]);
        b2[block] -= Integer.toUnsignedLong(d2[tid]); b3[block] -= Integer.toUnsignedLong(d3[tid]);
        d0[tid] = d1[tid] = d2[tid] = d3[tid] = 0;
    }
    BigDecimal sum(List<Integer> tids) {
        if (!enabled) return null;
        // Each unsigned 32-bit digit is accumulated in a long; at most Integer.MAX_VALUE terms fit without overflow.
        long s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        if (tids instanceof BitTidList dense) {
            long[] words = dense.words();
            for (int block = 0; block < words.length; block++) {
                long bits = words[block];
                if (bits == -1L) { s0 += b0[block]; s1 += b1[block]; s2 += b2[block]; s3 += b3[block]; continue; }
                while (bits != 0) {
                    int tid = (block << 6) + Long.numberOfTrailingZeros(bits);
                    s0 += Integer.toUnsignedLong(d0[tid]); s1 += Integer.toUnsignedLong(d1[tid]);
                    s2 += Integer.toUnsignedLong(d2[tid]); s3 += Integer.toUnsignedLong(d3[tid]);
                    bits &= bits - 1;
                }
            }
        } else for (int tid : tids) {
            s0 += Integer.toUnsignedLong(d0[tid]); s1 += Integer.toUnsignedLong(d1[tid]);
            s2 += Integer.toUnsignedLong(d2[tid]); s3 += Integer.toUnsignedLong(d3[tid]);
        }
        s1 += s0 >>> 32; s2 += s1 >>> 32; s3 += s2 >>> 32;
        byte[] bytes = ByteBuffer.allocate(20).putInt((int)(s3 >>> 32)).putInt((int)s3).putInt((int)s2).putInt((int)s1).putInt((int)s0).array();
        return new BigDecimal(new BigInteger(1, bytes), SCALE).stripTrailingZeros();
    }
}
