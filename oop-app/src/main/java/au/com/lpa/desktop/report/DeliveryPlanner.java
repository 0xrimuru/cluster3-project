package au.com.lpa.desktop.report;

import au.com.lpa.desktop.algo.Graph;
import au.com.lpa.desktop.algo.RoutePlanner;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Delivery route for a set of invoices: each delivery address is mapped to its suburb, distances come
 * from a road graph of Brisbane suburbs (delivery-map.json, read with Gson) using Dijkstra, and the visiting
 * order is planned with nearest-neighbour + 2-opt ({@link RoutePlanner}), starting and ending at the warehouse.
 */
public class DeliveryPlanner {

    public record Stop(String suburb, List<String> deliveries) { }
    public record Route(List<Stop> stops, double km, double greedyKm, List<String> notOnMap, String depot) { }

    private static final Pattern SUBURB = Pattern.compile(",\\s*([A-Za-z .'-]+?)\\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\\b");
    private final Graph roads = new Graph();
    private final String depot;

    public DeliveryPlanner() {
        try (InputStream in = DeliveryPlanner.class.getResourceAsStream("/delivery-map.json")) {
            JsonObject root = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
            depot = root.get("depot").getAsString();
            for (JsonElement e : root.getAsJsonArray("roads")) {
                JsonArray r = e.getAsJsonArray();
                roads.addRoad(r.get(0).getAsString(), r.get(1).getAsString(), r.get(2).getAsDouble());
            }
        } catch (Exception e) {
            throw new IllegalStateException("delivery-map.json could not be read", e);
        }
    }

    /** "88 Ann St, Brisbane City QLD 4000" -> "Brisbane City" (or "" when it cannot be read). */
    public static String suburbOf(String address) {
        Matcher m = SUBURB.matcher(address == null ? "" : address);
        String found = "";
        while (m.find()) found = m.group(1).trim();
        return found;
    }

    public Route plan(List<ReportRepository.InvoiceRow> invoices) {
        Map<String, List<String>> bySuburb = new LinkedHashMap<>();
        List<String> notOnMap = new ArrayList<>();
        for (ReportRepository.InvoiceRow r : invoices) {
            String suburb = suburbOf(r.address());
            String label = r.number() + " " + r.client();
            if (!roads.has(suburb)) { notOnMap.add(label + " (" + (suburb.isEmpty() ? "address not recognised" : suburb) + ")"); continue; }
            bySuburb.computeIfAbsent(suburb, k -> new ArrayList<>()).add(label);
        }
        RoutePlanner.Plan plan = RoutePlanner.plan(roads, depot, new ArrayList<>(bySuburb.keySet()));
        List<Stop> stops = new ArrayList<>();
        for (String s : plan.order()) stops.add(new Stop(s, bySuburb.getOrDefault(s, List.of())));
        return new Route(stops, plan.km(), plan.greedyKm(), notOnMap, depot);
    }

}
