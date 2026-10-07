package au.com.lpa.desktop.algo;

import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/**
 * Binary search on a SORTED list - O(log n): halve the range each step.
 * lowerBound = first index whose key is >= the target; upperBound = first index whose key is > the target.
 * Used to cut a date range out of invoices sorted by date (report "from" / "to").
 */
public final class BinarySearch {

    private BinarySearch() { }

    public static <T, K> int lowerBound(List<T> sorted, K target, Function<T, K> key, Comparator<? super K> order) {
        int lo = 0, hi = sorted.size();
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (order.compare(key.apply(sorted.get(mid)), target) < 0) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    public static <T, K> int upperBound(List<T> sorted, K target, Function<T, K> key, Comparator<? super K> order) {
        int lo = 0, hi = sorted.size();
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (order.compare(key.apply(sorted.get(mid)), target) <= 0) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    /** The items with from <= key <= to. */
    public static <T, K> List<T> range(List<T> sorted, K from, K to, Function<T, K> key, Comparator<? super K> order) {
        return sorted.subList(lowerBound(sorted, from, key, order), upperBound(sorted, to, key, order));
    }
}
