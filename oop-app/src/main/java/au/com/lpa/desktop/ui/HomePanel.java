package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.time.LocalTime;

/** Home: greeting, today's numbers from the database, and shortcuts the user is allowed to use. */
public class HomePanel extends BasePanel {

    private final JLabel greeting = new JLabel();
    private final JPanel tiles = new JPanel(new GridLayout(1, 5, 10, 0));
    private final JPanel shortcuts = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final BeanTableModel<au.com.lpa.desktop.model.Product> attention = new BeanTableModel<>(
            new BeanTableModel.Column<au.com.lpa.desktop.model.Product>("Stock ID", String.class, au.com.lpa.desktop.model.Product::getId),
            new BeanTableModel.Column<au.com.lpa.desktop.model.Product>("Item", String.class, au.com.lpa.desktop.model.Product::getName),
            new BeanTableModel.Column<au.com.lpa.desktop.model.Product>("On hand", Integer.class, au.com.lpa.desktop.model.Product::getOnHand),
            new BeanTableModel.Column<au.com.lpa.desktop.model.Product>("Level", String.class, p -> p.level() == au.com.lpa.desktop.model.Product.Level.OUT ? "Out of stock" : "Low stock"));

    public HomePanel(Services app, MainFrame frame) {
        super(app, frame, "LPA Administration System");
        greeting.setFont(greeting.getFont().deriveFont(15f));
        JPanel body = new JPanel(new BorderLayout(0, 16));
        body.add(greeting, BorderLayout.NORTH);
        body.add(tiles, BorderLayout.CENTER);
        body.add(shortcuts, BorderLayout.SOUTH);
        javax.swing.JTable table = new javax.swing.JTable(attention);
        table.setRowHeight(24);
        table.setName("attention");
        JPanel wrap = new JPanel(new BorderLayout(0, 16));
        wrap.add(body, BorderLayout.NORTH);
        wrap.add(Ui.card(new javax.swing.JScrollPane(table), "Needs attention (low or out of stock)"), BorderLayout.CENTER);
        add(wrap, BorderLayout.CENTER);
    }

    @Override public String key() { return "home"; }

    @Override
    public void onShow() {
        int h = LocalTime.now().getHour();
        String part = h < 12 ? "Good morning" : (h < 18 ? "Good afternoon" : "Good evening");
        greeting.setText("<html>" + part + ", <b>" + Ui.escape(app.session.user().getFirstName()) + "</b>. Signed in as "
                + app.session.user().getGroup().label() + ".</html>");
        shortcuts.removeAll();
        if (app.session.can("stock.view")) shortcuts.add(Ui.button("Stock Management", e -> frame.show("stock")));
        if (app.session.can("sales.view")) shortcuts.add(Ui.button("Invoices", e -> frame.show("invoices")));
        if (app.session.can("sales.create")) shortcuts.add(Ui.primary("New Invoice", e -> frame.show("new-invoice")));
        if (app.session.can("clients.view")) shortcuts.add(Ui.button("Clients", e -> frame.show("clients")));
        if (app.session.can("users.manage")) shortcuts.add(Ui.button("User Management", e -> frame.show("users")));
        if (app.session.can("reports.view")) shortcuts.add(Ui.button("Reports and Planning", e -> frame.show("reports")));
        Async.run(this, () -> app.stock.search(""), list -> attention.setRows(list.stream()
                .filter(p -> p.level() != au.com.lpa.desktop.model.Product.Level.IN)
                .sorted(java.util.Comparator.comparingInt(au.com.lpa.desktop.model.Product::getOnHand)).toList()));
        Async.run(this, app.dashboard::stats, s -> {
            tiles.removeAll();
            tiles.add(tile("Stock items", String.valueOf(s.items()), Ui.BRAND));
            tiles.add(tile("Low stock", String.valueOf(s.lowStock()), Ui.WARN));
            tiles.add(tile("Out of stock", String.valueOf(s.outOfStock()), Ui.DANGER));
            tiles.add(tile("Invoices", String.valueOf(s.invoices()), Ui.BRAND));
            tiles.add(tile("Total sales", Ui.money(s.sales()), Ui.BRAND_DARK));
            tiles.revalidate();
            tiles.repaint();
        });
    }

    private static JPanel tile(String label, String value, Color colour) {
        JPanel p = new JPanel(new BorderLayout());
        p.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createMatteBorder(0, 4, 0, 0, colour), BorderFactory.createEmptyBorder(10, 12, 10, 12)));
        JLabel v = new JLabel(value);
        v.setFont(v.getFont().deriveFont(Font.BOLD, 22f));
        v.setForeground(colour);
        p.add(v, BorderLayout.CENTER);
        p.add(new JLabel(label), BorderLayout.SOUTH);
        return p;
    }
}
