package au.com.lpa.desktop.algo;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Plans the order to visit delivery stops and come back (a small travelling-salesman problem):
 *  1. distances between every pair of stops with Dijkstra (road network, not straight lines)
 *  2. nearest-neighbour: always drive to the closest stop not visited yet (greedy, fast)
 *  3. 2-opt: reverse any part of the route that makes it shorter, until nothing improves
 * Exact solutions need O(n!) time; this gives a good route quickly for a day's deliveries.
 */
public final class RoutePlanner {

    public record Plan(List<String> order, double km, double greedyKm, List<String> unreachable) { }

    private RoutePlanner() { }

    public static Plan plan(Graph roads, String depot, List<String> stops) {
        List<String> targets = new ArrayList<>();
        List<String> unreachable = new ArrayList<>();
        Map<String, Map<String, Double>> d = new HashMap<>();
        d.put(depot, roads.distancesFrom(depot));
        for (String s : new LinkedHashSet<>(stops)) {
            if (s.equals(depot)) continue;
            if (!roads.has(s) || !d.get(depot).containsKey(s)) { unreachable.add(s); continue; }
            targets.add(s);
            d.put(s, roads.distancesFrom(s));
        }
        // nearest neighbour
        List<String> route = new ArrayList<>();
        route.add(depot);
        List<String> left = new ArrayList<>(targets);
        String at = depot;
        while (!left.isEmpty()) {
            String best = null;
            for (String s : left) if (best == null || d.get(at).get(s) < d.get(at).get(best)) best = s;
            route.add(best);
            left.remove(best);
            at = best;
        }
        route.add(depot);
        double greedy = length(route, d);
        // 2-opt improvement
        boolean improved = true;
        while (improved) {
            improved = false;
            for (int i = 1; i < route.size() - 2; i++) {
                for (int k = i + 1; k < route.size() - 1; k++) {
                    double before = d.get(route.get(i - 1)).get(route.get(i)) + d.get(route.get(k)).get(route.get(k + 1));
                    double after = d.get(route.get(i - 1)).get(route.get(k)) + d.get(route.get(i)).get(route.get(k + 1));
                    if (after < before - 1e-9) {
                        java.util.Collections.reverse(route.subList(i, k + 1));
                        improved = true;
                    }
                }
            }
        }
        return new Plan(List.copyOf(route), length(route, d), greedy, List.copyOf(unreachable));
    }

    private static double length(List<String> route, Map<String, Map<String, Double>> d) {
        double km = 0;
        for (int i = 1; i < route.size(); i++) km += d.get(route.get(i - 1)).get(route.get(i));
        return km;
    }
}
