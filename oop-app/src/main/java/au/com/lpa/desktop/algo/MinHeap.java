package au.com.lpa.desktop.algo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Binary min-heap (priority queue) stored in an array list: the parent of index i is (i-1)/2, its
 * children are 2i+1 and 2i+2. add and poll are O(log n), peek is O(1).
 * Used by the reorder planner to pick the most urgent items, and by Dijkstra's shortest path.
 */
public class MinHeap<T> {

    private final List<T> items = new ArrayList<>();
    private final Comparator<? super T> order;

    public MinHeap(Comparator<? super T> order) { this.order = order; }

    public void add(T item) {
        items.add(item);
        siftUp(items.size() - 1);
    }

    public T peek() {
        if (items.isEmpty()) throw new NoSuchElementException("heap is empty");
        return items.get(0);
    }

    /** Removes and returns the smallest item. */
    public T poll() {
        T top = peek();
        T last = items.remove(items.size() - 1);
        if (!items.isEmpty()) {
            items.set(0, last);
            siftDown(0);
        }
        return top;
    }

    public int size() { return items.size(); }
    public boolean isEmpty() { return items.isEmpty(); }

    private void siftUp(int i) {
        while (i > 0) {
            int parent = (i - 1) / 2;
            if (order.compare(items.get(i), items.get(parent)) >= 0) return;
            swap(i, parent);
            i = parent;
        }
    }

    private void siftDown(int i) {
        int n = items.size();
        while (true) {
            int left = 2 * i + 1, right = left + 1, smallest = i;
            if (left < n && order.compare(items.get(left), items.get(smallest)) < 0) smallest = left;
            if (right < n && order.compare(items.get(right), items.get(smallest)) < 0) smallest = right;
            if (smallest == i) return;
            swap(i, smallest);
            i = smallest;
        }
    }

    private void swap(int a, int b) {
        T t = items.get(a);
        items.set(a, items.get(b));
        items.set(b, t);
    }

    /**
     * The k LARGEST items by the given order, largest first, in O(n log k): keep a min-heap of size k
     * and throw away the smallest whenever it grows past k.
     */
    public static <T> List<T> topK(Iterable<T> all, int k, Comparator<? super T> order) {
        MinHeap<T> heap = new MinHeap<>(order);
        for (T t : all) {
            heap.add(t);
            if (heap.size() > k) heap.poll();
        }
        List<T> out = new ArrayList<>();
        while (!heap.isEmpty()) out.add(0, heap.poll());
        return out;
    }
}
