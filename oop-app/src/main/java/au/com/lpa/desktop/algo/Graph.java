package au.com.lpa.desktop.algo;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Weighted, undirected graph stored as an adjacency list (place -> neighbours with distances),
 * with Dijkstra's shortest-path algorithm (using {@link MinHeap}): O((V + E) log V).
 * Used for delivery distances between suburbs.
 */
public class Graph {

    public record Edge(String to, double km) { }
    public record Path(List<String> stops, double km) {
        public static final Path NONE = new Path(List.of(), Double.POSITIVE_INFINITY);
        public boolean exists() { return !stops.isEmpty(); }
    }

    private final Map<String, List<Edge>> adjacency = new LinkedHashMap<>();

    public void addPlace(String place) { adjacency.computeIfAbsent(place, k -> new ArrayList<>()); }

    public void addRoad(String a, String b, double km) {
        if (km <= 0) throw new IllegalArgumentException("distance must be positive");
        addPlace(a);
        addPlace(b);
        adjacency.get(a).add(new Edge(b, km));
        adjacency.get(b).add(new Edge(a, km));
    }

    public boolean has(String place) { return adjacency.containsKey(place); }

    /** Shortest distances from one place to every reachable place. */
    public Map<String, Double> distancesFrom(String start) {
        return dijkstra(start).distance;
    }

    public Path shortestPath(String from, String to) {
        if (!has(from) || !has(to)) return Path.NONE;
        Result r = dijkstra(from);
        if (!r.distance.containsKey(to)) return Path.NONE;
        Deque<String> stops = new ArrayDeque<>();
        for (String p = to; p != null; p = r.previous.get(p)) stops.addFirst(p);
        return new Path(List.copyOf(stops), r.distance.get(to));
    }

    private record Item(String place, double km) { }
    private record Result(Map<String, Double> distance, Map<String, String> previous) { }

    private Result dijkstra(String start) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        MinHeap<Item> queue = new MinHeap<>((x, y) -> Double.compare(x.km(), y.km()));
        dist.put(start, 0.0);
        queue.add(new Item(start, 0));
        while (!queue.isEmpty()) {
            Item cur = queue.poll();
            if (cur.km() > dist.getOrDefault(cur.place(), Double.POSITIVE_INFINITY)) continue; // stale entry
            for (Edge e : adjacency.getOrDefault(cur.place(), List.of())) {
                double nd = cur.km() + e.km();
                if (nd < dist.getOrDefault(e.to(), Double.POSITIVE_INFINITY)) {
                    dist.put(e.to(), nd);
                    prev.put(e.to(), cur.place());
                    queue.add(new Item(e.to(), nd));
                }
            }
        }
        return new Result(dist, prev);
    }
}
