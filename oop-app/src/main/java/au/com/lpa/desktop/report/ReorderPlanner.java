package au.com.lpa.desktop.report;

import au.com.lpa.desktop.algo.MinHeap;
import au.com.lpa.desktop.model.Product;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Reorder planner: which stock items should LPA buy first?
 * For each active item: units sold in the last {@code days} days -> average per day -> days of cover
 * (on hand / per day). The most urgent items (out of stock with demand first, then the fewest days of
 * cover) are picked with a heap ({@link MinHeap#topK}), and a quantity is suggested to reach
 * {@code targetDays} of cover.
 */
public class ReorderPlanner {

    public record Suggestion(Product product, int soldInPeriod, double perDay, double daysOfCover, int suggestedQty, String reason, int targetDays) {
        /** Higher = more urgent. Tiers: out of stock and selling > under the target cover > out of stock > low stock > the rest. */
        double urgency() {
            int onHand = product.getOnHand();
            if (onHand == 0 && soldInPeriod > 0) return 1_000_000 + perDay;
            if (!Double.isInfinite(daysOfCover) && daysOfCover < targetDays) return 100_000 - daysOfCover;
            if (onHand == 0) return 50_000;
            if (onHand <= Product.LOW_STOCK && Double.isInfinite(daysOfCover)) return 40_000 + (Product.LOW_STOCK - onHand);
            return Double.isInfinite(daysOfCover) ? 0 : 10_000 - Math.min(daysOfCover, 9_999);
        }
    }

    private final int days;
    private final int targetDays;

    public ReorderPlanner(int days, int targetDays) {
        this.days = days;
        this.targetDays = targetDays;
    }

    public List<Suggestion> plan(List<Product> products, Map<String, ReportRepository.ItemSales> sales, int limit) {
        List<Suggestion> all = new ArrayList<>();
        for (Product p : products) {
            if (!p.isActive()) continue;
            int sold = sales.containsKey(p.getId()) ? sales.get(p.getId()).units() : 0;
            double perDay = (double) sold / days;
            // whole-number maths: 31 / (93 / 90.0) would give 29.999... days instead of exactly 30
            double cover = sold == 0 ? Double.POSITIVE_INFINITY : (double) p.getOnHand() * days / sold;
            int target = (sold * targetDays + days - 1) / days; // ceil(sold * targetDays / days)
            int qty = Math.max(0, target - p.getOnHand());
            if (qty == 0 && p.getOnHand() <= Product.LOW_STOCK && sold == 0) qty = Product.LOW_STOCK + 1 - p.getOnHand();
            String reason;
            if (p.getOnHand() == 0) reason = sold > 0 ? "Out of stock and selling" : "Out of stock";
            else if (cover < targetDays) reason = String.format("Only %.0f days of stock left", cover);
            else if (p.getOnHand() <= Product.LOW_STOCK) reason = "Low stock";
            else reason = Double.isInfinite(cover) ? "No recent sales" : String.format("%.0f days of stock", cover);
            all.add(new Suggestion(p, sold, perDay, cover, qty, reason, targetDays));
        }
        return MinHeap.topK(all, limit, Comparator.comparingDouble(Suggestion::urgency));
    }

    public LocalDate since(LocalDate today) { return today.minusDays(days); }
}
