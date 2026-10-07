package au.com.lpa.desktop;

import au.com.lpa.desktop.algo.BinarySearch;
import au.com.lpa.desktop.algo.Graph;
import au.com.lpa.desktop.algo.LruCache;
import au.com.lpa.desktop.algo.MinHeap;
import au.com.lpa.desktop.algo.MovingAverage;
import au.com.lpa.desktop.algo.RoutePlanner;
import au.com.lpa.desktop.algo.Sorts;
import au.com.lpa.desktop.algo.Trie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

/** Data structures and algorithms (ICTPRG547): correctness against Java's own versions, edge cases, speed. */
class AlgorithmsTest {

    record Item(String name, int qty) { }

    @Test @DisplayName("A-01 Trie: finds entries by any word prefix, alphabetical, limited, case-insensitive")
    void trie() {
        Trie<String> t = new Trie<>();
        t.add("Mechanical Keyboard MK-87", "LPA-001");
        t.add("Mechanical Numpad NP-22", "LPA-007");
        t.add("Wireless Optical Mouse WM-200", "LPA-002");
        t.add("LPA-001", "LPA-001");
        assertEquals(List.of("LPA-001", "LPA-007"), t.suggest("mech", 10));
        assertEquals(List.of("LPA-001"), t.suggest("KEY", 10));
        assertEquals(List.of("LPA-002"), t.suggest("mou", 10));
        assertEquals(List.of("LPA-001"), t.suggest("lpa-00", 1));
        assertTrue(t.suggest("zzz", 5).isEmpty());
        assertTrue(t.suggest("", 5).isEmpty());
        assertEquals(4, t.size());
    }

    @Test @DisplayName("A-02 Trie is faster than scanning a list (100,000 entries)")
    void triePerformance() {
        Trie<Integer> t = new Trie<>();
        List<String> names = new ArrayList<>();
        Random r = new Random(7);
        for (int i = 0; i < 100_000; i++) {
            String n = "item" + Integer.toString(r.nextInt(1_000_000), 36) + " brand" + (i % 500);
            names.add(n);
            t.add(n, i);
        }
        // warm up both (let the JIT compile them), then take the best of 3 rounds of 300 lookups
        long trieNs = Long.MAX_VALUE, scanNs = Long.MAX_VALUE;
        int found = 0, scan = 0;
        for (int round = 0; round < 4; round++) {
            long t0 = System.nanoTime();
            found = 0;
            for (int i = 0; i < 300; i++) found += t.suggest("item" + Integer.toString(i * 37, 36), 10).size();
            long tn = System.nanoTime() - t0;
            t0 = System.nanoTime();
            scan = 0;
            for (int i = 0; i < 300; i++) {
                String p = "item" + Integer.toString(i * 37, 36);
                scan += (int) names.stream().filter(n -> n.startsWith(p)).limit(10).count();
            }
            long sn = System.nanoTime() - t0;
            if (round > 0) { trieNs = Math.min(trieNs, tn); scanNs = Math.min(scanNs, sn); }
        }
        System.out.printf("A-02: trie %.3f ms/lookup, list scan %.3f ms/lookup%n", trieNs / 1e6 / 300, scanNs / 1e6 / 300);
        assertTrue(found > 0 && scan > 0);
        assertTrue(trieNs * 5 < scanNs, "trie should be at least 5x faster");
    }

    @Test @DisplayName("A-03 MinHeap gives the same order as java.util.PriorityQueue (10,000 random values)")
    void heap() {
        Random r = new Random(1);
        MinHeap<Integer> mine = new MinHeap<>(Comparator.naturalOrder());
        PriorityQueue<Integer> java = new PriorityQueue<>();
        for (int i = 0; i < 10_000; i++) {
            int v = r.nextInt(1000);
            mine.add(v); java.add(v);
            if (i % 3 == 0) assertEquals(java.poll(), mine.poll());
        }
        while (!java.isEmpty()) assertEquals(java.poll(), mine.poll());
        assertTrue(mine.isEmpty());
        assertThrows(java.util.NoSuchElementException.class, mine::poll);
    }

    @Test @DisplayName("A-04 topK picks the k largest in order")
    void topK() {
        List<Item> items = List.of(new Item("a", 5), new Item("b", 50), new Item("c", 20), new Item("d", 1), new Item("e", 35));
        assertEquals(List.of("b", "e", "c"), MinHeap.topK(items, 3, Comparator.comparingInt(Item::qty)).stream().map(Item::name).toList());
        assertEquals(5, MinHeap.topK(items, 10, Comparator.comparingInt(Item::qty)).size());
    }

    @Test @DisplayName("A-05 LRU cache: evicts the least recently used, counts hits / misses")
    void lru() {
        LruCache<String, Integer> c = new LruCache<>(3);
        c.put("a", 1); c.put("b", 2); c.put("c", 3);
        assertEquals(1, c.get("a").orElseThrow());     // a becomes most recent
        c.put("d", 4);                                 // evicts b (least recent)
        assertTrue(c.get("b").isEmpty());
        assertEquals(List.of("d", "a", "c"), c.keysByRecency());
        assertEquals(1, c.evictions());
        assertEquals(10, c.computeIfAbsent("e", k -> 10));
        assertEquals(10, c.computeIfAbsent("e", k -> 99)); // cached
        c.invalidate("e");
        assertTrue(c.get("e").isEmpty());
        assertEquals(2, c.hits());
        assertEquals(3, c.misses());
        assertThrows(IllegalArgumentException.class, () -> new LruCache<>(0));
    }

    @Test @DisplayName("A-06 Merge sort and quick sort give the same result as Java's sort (random, sorted, reversed, duplicates)")
    void sorts() {
        Random r = new Random(3);
        List<List<Integer>> inputs = List.of(
                List.of(), List.of(5),
                r.ints(5000, 0, 100_000).boxed().toList(),
                IntStream.range(0, 3000).boxed().toList(),
                IntStream.range(0, 3000).map(i -> 3000 - i).boxed().toList(),
                r.ints(5000, 0, 5).boxed().toList());
        for (List<Integer> in : inputs) {
            List<Integer> expected = in.stream().sorted().toList();
            assertEquals(expected, Sorts.mergeSort(in, Comparator.naturalOrder()));
            assertEquals(expected, Sorts.quickSort(in, Comparator.naturalOrder()));
            if (in.size() <= 3000) assertEquals(expected, Sorts.insertionSort(in, Comparator.naturalOrder()));
        }
    }

    @Test @DisplayName("A-07 Merge sort is stable (equal items keep their order)")
    void stable() {
        List<Item> in = new ArrayList<>();
        for (int i = 0; i < 2000; i++) in.add(new Item("n" + i, i % 7));
        List<Item> out = Sorts.mergeSort(in, Comparator.comparingInt(Item::qty));
        for (int i = 1; i < out.size(); i++) {
            if (out.get(i - 1).qty() == out.get(i).qty())
                assertTrue(Integer.parseInt(out.get(i - 1).name().substring(1)) < Integer.parseInt(out.get(i).name().substring(1)));
        }
    }

    @Test @DisplayName("A-08 Binary search: date range on a sorted list, empty and edge ranges")
    void binarySearch() {
        List<Integer> days = List.of(1, 3, 3, 3, 7, 9, 12);
        assertEquals(1, BinarySearch.lowerBound(days, 3, x -> x, Comparator.naturalOrder()));
        assertEquals(4, BinarySearch.upperBound(days, 3, x -> x, Comparator.naturalOrder()));
        assertEquals(List.of(3, 3, 3, 7), BinarySearch.range(days, 2, 8, x -> x, Comparator.naturalOrder()));
        assertEquals(List.of(), BinarySearch.range(days, 13, 20, x -> x, Comparator.naturalOrder()));
        assertEquals(days, BinarySearch.range(days, 0, 99, x -> x, Comparator.naturalOrder()));
    }

    static Graph sample() {
        Graph g = new Graph();
        g.addRoad("A", "B", 4); g.addRoad("A", "C", 2); g.addRoad("C", "B", 1); g.addRoad("B", "D", 5); g.addRoad("C", "D", 8);
        g.addPlace("Island");
        return g;
    }

    @Test @DisplayName("A-09 Dijkstra finds the shortest path (not the fewest roads)")
    void dijkstra() {
        Graph g = sample();
        Graph.Path p = g.shortestPath("A", "D");
        assertEquals(List.of("A", "C", "B", "D"), p.stops());
        assertEquals(8.0, p.km(), 1e-9);
        assertFalse(g.shortestPath("A", "Island").exists());
        assertFalse(g.shortestPath("A", "Nowhere").exists());
        assertThrows(IllegalArgumentException.class, () -> g.addRoad("A", "Z", 0));
    }

    @Test @DisplayName("A-10 Route planner: visits every stop, returns to the depot, 2-opt never longer than greedy")
    void route() {
        Graph g = new Graph();
        String[] p = {"Depot", "P1", "P2", "P3", "P4", "P5"};
        double[][] xy = {{0, 0}, {0, 10}, {10, 10}, {10, 0}, {5, 12}, {12, 5}};
        for (int i = 0; i < p.length; i++)
            for (int j = i + 1; j < p.length; j++)
                g.addRoad(p[i], p[j], Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]));
        RoutePlanner.Plan plan = RoutePlanner.plan(g, "Depot", List.of("P3", "P1", "P5", "P2", "P4", "P1", "Mars"));
        assertEquals("Depot", plan.order().get(0));
        assertEquals("Depot", plan.order().get(plan.order().size() - 1));
        assertEquals(Set5(), plan.order().stream().filter(s -> !s.equals("Depot")).collect(Collectors.toSet()));
        assertEquals(List.of("Mars"), plan.unreachable());
        assertTrue(plan.km() <= plan.greedyKm() + 1e-9);
        assertTrue(plan.km() < 45, "route " + plan.km());
    }

    static java.util.Set<String> Set5() { return java.util.Set.of("P1", "P2", "P3", "P4", "P5"); }

    @Test @DisplayName("A-11 Moving average over a sliding window")
    void movingAverage() {
        MovingAverage m = new MovingAverage(3);
        assertEquals(10, m.add(10), 1e-9);
        assertEquals(15, m.add(20), 1e-9);
        assertEquals(20, m.add(30), 1e-9);
        assertEquals(30, m.add(40), 1e-9); // 20,30,40
        assertEquals(3, m.count());
    }

    @Test @DisplayName("A-12 Speed: merge / quick sort O(n log n) vs insertion sort O(n^2)")
    void sortSpeed() {
        List<Integer> data = new Random(9).ints(20_000, 0, 1_000_000).boxed().toList();
        long t0 = System.nanoTime(); Sorts.mergeSort(data, Comparator.naturalOrder()); long merge = System.nanoTime() - t0;
        t0 = System.nanoTime(); Sorts.quickSort(data, Comparator.naturalOrder()); long quick = System.nanoTime() - t0;
        t0 = System.nanoTime(); Sorts.insertionSort(data, Comparator.naturalOrder()); long ins = System.nanoTime() - t0;
        System.out.printf("A-12: 20,000 items - merge %.1f ms, quick %.1f ms, insertion %.1f ms%n", merge / 1e6, quick / 1e6, ins / 1e6);
        assertTrue(merge * 5 < ins && quick * 5 < ins);
    }
}
