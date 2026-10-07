package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.algo.LruCache;
import au.com.lpa.desktop.algo.Sorts;
import au.com.lpa.desktop.algo.Trie;
import au.com.lpa.desktop.export.CsvExport;
import au.com.lpa.desktop.report.DeliveryPlanner;
import au.com.lpa.desktop.report.ReorderPlanner;
import au.com.lpa.desktop.report.ReportRepository;
import au.com.lpa.desktop.report.SalesReport;
import au.com.lpa.desktop.util.Clocks;
import org.jfree.chart.ChartPanel;
import org.jfree.chart.ChartUtils;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.axis.CategoryAxis;
import org.jfree.chart.axis.NumberAxis;
import org.jfree.chart.plot.CategoryPlot;
import org.jfree.chart.plot.DatasetRenderingOrder;
import org.jfree.chart.renderer.category.BarRenderer;
import org.jfree.chart.renderer.category.LineAndShapeRenderer;
import org.jfree.data.category.DefaultCategoryDataset;

import javax.swing.DefaultListModel;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JSplitPane;
import javax.swing.JTabbedPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.FlowLayout;
import java.io.File;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Random;

/**
 * Reports and planning (ICTPRG547): reorder planner (heap), sales report with a chart (JFreeChart) and
 * moving average, delivery route (graph + Dijkstra + 2-opt), and an Algorithm lab that times the sorting
 * algorithms and shows the cache / trie statistics. Lists can be exported to CSV (Commons CSV).
 */
public class ReportsPanel extends BasePanel {

    private final JTabbedPane tabs = new JTabbedPane();
    // reorder
    private final BeanTableModel<ReorderPlanner.Suggestion> reorder = new BeanTableModel<>(
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Stock ID", String.class, s -> s.product().getId()),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Item", String.class, s -> s.product().getName()),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("On hand", Integer.class, s -> s.product().getOnHand()),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Sold (90 days)", Integer.class, ReorderPlanner.Suggestion::soldInPeriod),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Per day", String.class, s -> String.format("%.2f", s.perDay())),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Days of cover", String.class, s -> Double.isInfinite(s.daysOfCover()) ? "-" : String.format("%.0f", s.daysOfCover())),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Order qty", Integer.class, ReorderPlanner.Suggestion::suggestedQty),
            new BeanTableModel.Column<ReorderPlanner.Suggestion>("Why", String.class, ReorderPlanner.Suggestion::reason));
    // sales
    private final JTextField from = new JTextField(10);
    private final JTextField to = new JTextField(10);
    private final JLabel salesSummary = new JLabel(" ");
    private final DefaultCategoryDataset monthly = new DefaultCategoryDataset();
    private final DefaultCategoryDataset trend = new DefaultCategoryDataset();
    private final JFreeChart chart;
    private final BeanTableModel<ReportRepository.ItemSales> topItems = new BeanTableModel<>(
            new BeanTableModel.Column<ReportRepository.ItemSales>("Stock ID", String.class, ReportRepository.ItemSales::sku),
            new BeanTableModel.Column<ReportRepository.ItemSales>("Item", String.class, ReportRepository.ItemSales::name),
            new BeanTableModel.Column<ReportRepository.ItemSales>("Units", Integer.class, ReportRepository.ItemSales::units),
            new BeanTableModel.Column<ReportRepository.ItemSales>("Revenue", BigDecimal.class, ReportRepository.ItemSales::revenue));
    private SalesReport.Result lastSales;
    // delivery
    private final JTextField dFrom = new JTextField(10);
    private final JTextField dTo = new JTextField(10);
    private final DefaultListModel<String> route = new DefaultListModel<>();
    private final JLabel routeSummary = new JLabel(" ");
    // lab
    private final JSpinner sortSize = new JSpinner(new SpinnerNumberModel(20000, 1000, 200000, 1000));
    private final DefaultListModel<String> lab = new DefaultListModel<>();
    private final JTextField triePrefix = new JTextField(14);

    public ReportsPanel(Services app, MainFrame frame) {
        super(app, frame, "Reports and Planning");
        // --- reorder tab
        JTable reorderTable = new JTable(reorder);
        reorderTable.setRowHeight(24);
        reorderTable.setName("reorder");
        reorderTable.getColumnModel().getColumn(1).setPreferredWidth(220);
        reorderTable.getColumnModel().getColumn(7).setPreferredWidth(200);
        JPanel reorderBar = bar(Ui.primary("Refresh", e -> loadReorder()), Ui.button("Export CSV", e -> exportReorder()),
                new JLabel("Most urgent first: out of stock and selling, under 30 days of stock, out of stock, low stock."));
        JPanel reorderTab = new JPanel(new BorderLayout(0, 8));
        reorderTab.add(reorderBar, BorderLayout.NORTH);
        reorderTab.add(new JScrollPane(reorderTable), BorderLayout.CENTER);
        tabs.addTab("Reorder planner", reorderTab);

        // --- sales tab (JFreeChart: bars = month totals, line = 3-month moving average)
        CategoryPlot plot = new CategoryPlot(monthly, new CategoryAxis("Month"), new NumberAxis("Sales ($, incl. GST)"), new BarRenderer());
        ((BarRenderer) plot.getRenderer()).setSeriesPaint(0, Ui.BRAND);
        ((BarRenderer) plot.getRenderer()).setShadowVisible(false);
        ((BarRenderer) plot.getRenderer()).setBarPainter(new org.jfree.chart.renderer.category.StandardBarPainter());
        plot.setDataset(1, trend);
        LineAndShapeRenderer line = new LineAndShapeRenderer();
        line.setSeriesPaint(0, Ui.WARN);
        plot.setRenderer(1, line);
        plot.setDatasetRenderingOrder(DatasetRenderingOrder.FORWARD);
        plot.setBackgroundPaint(Color.WHITE);
        plot.setRangeGridlinePaint(new Color(0xDDDDDD));
        chart = new JFreeChart("Sales per month", JFreeChart.DEFAULT_TITLE_FONT, plot, true);
        chart.setBackgroundPaint(new Color(0, 0, 0, 0));
        ChartPanel chartPanel = new ChartPanel(chart);
        chartPanel.setName("chart");
        JTable top = new JTable(topItems);
        top.setRowHeight(24);
        top.setName("topItems");
        JPanel salesBar = bar(new JLabel("From:"), from, new JLabel("To:"), to, Ui.primary("Run report", e -> loadSales()),
                Ui.button("Export invoices CSV", e -> exportSales()), Ui.button("Save chart PNG", e -> saveChart()));
        JSplitPane salesSplit = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, chartPanel, Ui.card(new JScrollPane(top), "Best-selling items"));
        salesSplit.setResizeWeight(0.62);
        salesSplit.setBorder(null);
        JPanel salesTab = new JPanel(new BorderLayout(0, 8));
        salesTab.add(salesBar, BorderLayout.NORTH);
        salesTab.add(salesSplit, BorderLayout.CENTER);
        salesTab.add(salesSummary, BorderLayout.SOUTH);
        tabs.addTab("Sales report", salesTab);

        // --- delivery tab
        JList<String> routeList = new JList<>(route);
        routeList.setName("route");
        JPanel deliveryTab = new JPanel(new BorderLayout(0, 8));
        deliveryTab.add(bar(new JLabel("Invoices from:"), dFrom, new JLabel("To:"), dTo, Ui.primary("Plan route", e -> loadRoute())), BorderLayout.NORTH);
        deliveryTab.add(Ui.card(new JScrollPane(routeList), "Delivery route (starts and ends at the warehouse)"), BorderLayout.CENTER);
        deliveryTab.add(routeSummary, BorderLayout.SOUTH);
        tabs.addTab("Delivery route", deliveryTab);

        // --- algorithm lab
        JList<String> labList = new JList<>(lab);
        labList.setName("lab");
        labList.setFont(new java.awt.Font(java.awt.Font.MONOSPACED, java.awt.Font.PLAIN, 13));
        JPanel labTab = new JPanel(new BorderLayout(0, 8));
        labTab.add(bar(new JLabel("Items to sort:"), sortSize, Ui.primary("Time the sorts", e -> runSorts()),
                new JLabel("   Trie prefix:"), triePrefix, Ui.button("Look up", e -> runTrie()), Ui.button("Cache stats", e -> showCache())), BorderLayout.NORTH);
        labTab.add(new JScrollPane(labList), BorderLayout.CENTER);
        tabs.addTab("Algorithm lab", labTab);

        tabs.setName("tabs");
        add(tabs, BorderLayout.CENTER);
        LocalDate today = Clocks.nowBrisbane().toLocalDate();
        from.setText(today.minusMonths(5).withDayOfMonth(1).toString());
        to.setText(today.toString());
        dFrom.setText(today.minusDays(90).toString());
        dTo.setText(today.toString());
        triePrefix.setText("mech");
    }

    private static JPanel bar(java.awt.Component... items) {
        JPanel p = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        for (java.awt.Component c : items) p.add(c);
        return p;
    }

    @Override public String key() { return "reports"; }

    @Override
    public void onShow() {
        loadReorder();
        loadSales();
        loadRoute();
    }

    public JTabbedPane tabs() { return tabs; }

    void loadReorder() {
        Async.run(this, () -> app.reports.reorderPlan(10), reorder::setRows);
    }

    void loadSales() {
        LocalDate f = date(from), t = date(to);
        if (f == null || t == null) return;
        Async.run(this, () -> app.reports.sales(f, t), r -> {
            lastSales = r;
            monthly.clear();
            trend.clear();
            DateTimeFormatter mf = DateTimeFormatter.ofPattern("MMM yy", Locale.forLanguageTag("en-AU"));
            for (SalesReport.Month m : r.months()) {
                monthly.addValue(m.total(), "Sales", m.month().format(mf));
                trend.addValue(m.movingAverage(), "3-month average", m.month().format(mf));
            }
            topItems.setRows(r.topItems());
            salesSummary.setText("<html>" + r.invoices().size() + " invoices from " + r.from() + " to " + r.to() + " &nbsp; Total: <b>" + Ui.money(r.total()) + "</b></html>");
        });
    }

    void loadRoute() {
        LocalDate f = date(dFrom), t = date(dTo);
        if (f == null || t == null) return;
        Async.run(this, () -> app.reports.deliveryRoute(app.reports.invoicesBetween(f, t)), r -> {
            route.clear();
            List<DeliveryPlanner.Stop> stops = r.stops();
            for (int i = 0; i < stops.size(); i++) {
                DeliveryPlanner.Stop s = stops.get(i);
                if (i == 0) route.addElement("Start   " + s.suburb() + " (warehouse)" + (s.deliveries().isEmpty() ? "" : "  -  deliver: " + String.join(", ", s.deliveries())));
                else if (i == stops.size() - 1) route.addElement("Return  " + s.suburb() + " (warehouse)");
                else route.addElement(i + ".      " + s.suburb() + "  -  " + String.join(", ", s.deliveries()));
            }
            for (String miss : r.notOnMap()) route.addElement("Not on the delivery map: " + miss);
            routeSummary.setText(String.format("<html>Route: <b>%.1f km</b> (nearest-neighbour alone: %.1f km). Distances are approximate road kilometres.</html>", r.km(), r.greedyKm()));
        });
    }

    void runSorts() {
        int n = (Integer) sortSize.getValue();
        Async.run(this, () -> {
            List<Integer> data = new Random(42).ints(n, 0, 1_000_000).boxed().toList();
            List<String> out = new ArrayList<>();
            out.add(String.format("Sorting %,d random numbers:", n));
            out.add(time("Merge sort (O(n log n), stable)", () -> Sorts.mergeSort(data, Comparator.naturalOrder())));
            out.add(time("Quick sort (O(n log n) average)", () -> Sorts.quickSort(data, Comparator.naturalOrder())));
            out.add(time("Java built-in List.sort (TimSort)", () -> { List<Integer> c = new ArrayList<>(data); c.sort(null); return c; }));
            if (n <= 50_000) out.add(time("Insertion sort (O(n^2))", () -> Sorts.insertionSort(data, Comparator.naturalOrder())));
            else out.add("  Insertion sort skipped (too slow above 50,000 items - O(n^2))");
            return out;
        }, rows -> { lab.clear(); rows.forEach(lab::addElement); });
    }

    private static String time(String name, java.util.function.Supplier<List<Integer>> sort) {
        long t = System.nanoTime();
        List<Integer> r = sort.get();
        double ms = (System.nanoTime() - t) / 1e6;
        return String.format("  %-38s %9.1f ms   sorted=%s", name, ms, Sorts.isSorted(r, Comparator.naturalOrder()));
    }

    void runTrie() {
        String p = triePrefix.getText();
        Async.run(this, () -> {
            app.invoices.suggestProducts("a", 1); // make sure the index is built
            long t = System.nanoTime();
            var found = app.invoices.suggestProducts(p, 10);
            double us = (System.nanoTime() - t) / 1e3;
            List<String> out = new ArrayList<>();
            out.add(String.format("Trie lookup \"%s\": %d match(es) in %.1f microseconds", p, found.size(), us));
            found.forEach(x -> out.add("  " + x.getId() + "  " + x.getName()));
            return out;
        }, rows -> { lab.clear(); rows.forEach(lab::addElement); });
    }

    void showCache() {
        lab.clear();
        LruCache<?, ?> pc = app.cache.productCache(), cc = app.cache.clientCache();
        NumberFormat pct = NumberFormat.getPercentInstance();
        lab.addElement("LRU caches (New Invoice lookups by ID):");
        lab.addElement(String.format("  Products: %d cached, %d hits, %d misses, hit rate %s, %d evicted", pc.size(), pc.hits(), pc.misses(), pct.format(pc.hitRate()), pc.evictions()));
        lab.addElement(String.format("  Clients:  %d cached, %d hits, %d misses, hit rate %s, %d evicted", cc.size(), cc.hits(), cc.misses(), pct.format(cc.hitRate()), cc.evictions()));
        lab.addElement("  Most recent first: " + pc.keysByRecency());
    }

    private LocalDate date(JTextField f) {
        try {
            return LocalDate.parse(f.getText().trim());
        } catch (DateTimeParseException e) {
            Ui.errors(this, "Please check", List.of("Dates must look like " + Clocks.nowBrisbane().toLocalDate() + "."));
            return null;
        }
    }

    private Path choose(String name, String ext) {
        JFileChooser fc = new JFileChooser();
        fc.setSelectedFile(new File(name));
        fc.setFileFilter(new FileNameExtensionFilter(ext.toUpperCase() + " file", ext));
        return fc.showSaveDialog(this) == JFileChooser.APPROVE_OPTION ? fc.getSelectedFile().toPath() : null;
    }

    void exportReorder() {
        Path p = choose("lpa-reorder-plan.csv", "csv");
        if (p != null) exportReorder(p);
    }

    /** Also used by tests (no file dialog). */
    public void exportReorder(Path p) {
        List<ReorderPlanner.Suggestion> rows = reorder.rows();
        Async.run(this, () -> {
            CsvExport.write(p, rows,
                    new CsvExport.Column<>("Stock ID", s -> s.product().getId()), new CsvExport.Column<>("Item", s -> s.product().getName()),
                    new CsvExport.Column<>("On hand", s -> s.product().getOnHand()), new CsvExport.Column<>("Sold in 90 days", ReorderPlanner.Suggestion::soldInPeriod),
                    new CsvExport.Column<>("Per day", s -> String.format("%.2f", s.perDay())), new CsvExport.Column<>("Order qty", ReorderPlanner.Suggestion::suggestedQty),
                    new CsvExport.Column<>("Why", ReorderPlanner.Suggestion::reason));
            return p;
        }, done -> frame.status("Saved " + done));
    }

    void exportSales() {
        Path p = choose("lpa-sales.csv", "csv");
        if (p != null && lastSales != null) Async.run(this, () -> {
            CsvExport.write(p, lastSales.invoices(),
                    new CsvExport.Column<>("Invoice", ReportRepository.InvoiceRow::number), new CsvExport.Column<>("Date", ReportRepository.InvoiceRow::date),
                    new CsvExport.Column<>("Client ID", ReportRepository.InvoiceRow::clientId), new CsvExport.Column<>("Client", ReportRepository.InvoiceRow::client),
                    new CsvExport.Column<>("Address", ReportRepository.InvoiceRow::address), new CsvExport.Column<>("Amount", ReportRepository.InvoiceRow::amount));
            return p;
        }, done -> frame.status("Saved " + done));
    }

    void saveChart() {
        Path p = choose("lpa-sales-chart.png", "png");
        if (p != null) Async.run(this, () -> { ChartUtils.saveChartAsPNG(p.toFile(), chart, 900, 500); return p; }, done -> frame.status("Saved " + done));
    }

    public JFreeChart chart() { return chart; }
}
