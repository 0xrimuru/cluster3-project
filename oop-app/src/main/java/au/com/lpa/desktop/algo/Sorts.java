package au.com.lpa.desktop.algo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Sorting algorithms written out (all generic, all take a Comparator):
 *  - merge sort     O(n log n) always, STABLE (equal items keep their order) - used for reports
 *  - quick sort     O(n log n) on average, random pivot (avoids the O(n^2) worst case on sorted input)
 *  - insertion sort O(n^2) - fast only for tiny lists; used inside merge sort for small pieces
 * The Algorithm lab screen times them against Java's built-in sort.
 */
public final class Sorts {

    private static final int SMALL = 16;

    private Sorts() { }

    public static <T> List<T> mergeSort(List<T> input, Comparator<? super T> order) {
        @SuppressWarnings("unchecked")
        T[] a = (T[]) input.toArray();
        @SuppressWarnings("unchecked")
        T[] tmp = (T[]) new Object[a.length];
        mergeSort(a, tmp, 0, a.length - 1, order);
        return new ArrayList<>(java.util.Arrays.asList(a));
    }

    private static <T> void mergeSort(T[] a, T[] tmp, int lo, int hi, Comparator<? super T> order) {
        if (hi - lo < SMALL) { insertion(a, lo, hi, order); return; }
        int mid = (lo + hi) >>> 1;
        mergeSort(a, tmp, lo, mid, order);       // recursion: sort each half
        mergeSort(a, tmp, mid + 1, hi, order);
        if (order.compare(a[mid], a[mid + 1]) <= 0) return; // already in order
        System.arraycopy(a, lo, tmp, lo, hi - lo + 1);
        int i = lo, j = mid + 1;
        for (int k = lo; k <= hi; k++) {
            if (i > mid) a[k] = tmp[j++];
            else if (j > hi) a[k] = tmp[i++];
            else if (order.compare(tmp[j], tmp[i]) < 0) a[k] = tmp[j++]; // strict < keeps it stable
            else a[k] = tmp[i++];
        }
    }

    private static <T> void insertion(T[] a, int lo, int hi, Comparator<? super T> order) {
        for (int i = lo + 1; i <= hi; i++) {
            T x = a[i];
            int j = i - 1;
            while (j >= lo && order.compare(a[j], x) > 0) { a[j + 1] = a[j]; j--; }
            a[j + 1] = x;
        }
    }

    public static <T> List<T> insertionSort(List<T> input, Comparator<? super T> order) {
        @SuppressWarnings("unchecked")
        T[] a = (T[]) input.toArray();
        insertion(a, 0, a.length - 1, order);
        return new ArrayList<>(java.util.Arrays.asList(a));
    }

    public static <T> List<T> quickSort(List<T> input, Comparator<? super T> order) {
        @SuppressWarnings("unchecked")
        T[] a = (T[]) input.toArray();
        quick(a, 0, a.length - 1, order);
        return new ArrayList<>(java.util.Arrays.asList(a));
    }

    private static <T> void quick(T[] a, int lo, int hi, Comparator<? super T> order) {
        while (lo < hi) {
            if (hi - lo < SMALL) { insertion(a, lo, hi, order); return; }
            T pivot = a[ThreadLocalRandom.current().nextInt(lo, hi + 1)];
            // three-way partition: < pivot | == pivot | > pivot (handles many equal values)
            int lt = lo, gt = hi, i = lo;
            while (i <= gt) {
                int c = order.compare(a[i], pivot);
                if (c < 0) swap(a, lt++, i++);
                else if (c > 0) swap(a, i, gt--);
                else i++;
            }
            // recurse into the smaller part, loop on the bigger one (stack depth O(log n))
            if (lt - lo < hi - gt) { quick(a, lo, lt - 1, order); lo = gt + 1; }
            else { quick(a, gt + 1, hi, order); hi = lt - 1; }
        }
    }

    private static <T> void swap(T[] a, int i, int j) { T t = a[i]; a[i] = a[j]; a[j] = t; }

    public static <T> boolean isSorted(List<T> list, Comparator<? super T> order) {
        for (int i = 1; i < list.size(); i++) if (order.compare(list.get(i - 1), list.get(i)) > 0) return false;
        return true;
    }
}
