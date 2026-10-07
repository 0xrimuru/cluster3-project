package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.LedgerEntry;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.service.StockService;

import javax.swing.DefaultListModel;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Stock Management: search, add, edit, delete items; adjust stock with a reason; audit history. */
public class StockPanel extends CrudPanel<Product> {

    private final JTextField id = new JTextField();
    private final JTextField name = new JTextField();
    private final JTextField brand = new JTextField();
    private final JComboBox<String> category = new JComboBox<>();
    private final JTextArea desc = new JTextArea(3, 20);
    private final JSpinner onHand = new JSpinner(new SpinnerNumberModel(0, 0, 1_000_000, 1));
    private final JTextField price = new JTextField();
    private final JComboBox<RecordStatus> status = new JComboBox<>(new RecordStatus[]{RecordStatus.ACTIVE, RecordStatus.DISABLED});
    private final JLabel picture = new JLabel();
    private final JLabel level = new JLabel();
    private final JComboBox<StockService.Operation> op = new JComboBox<>(StockService.Operation.values());
    private final JSpinner qty = new JSpinner(new SpinnerNumberModel(1, 0, 1_000_000, 1));
    private final JComboBox<String> reason = new JComboBox<>(StockService.REASONS.toArray(new String[0]));
    private final DefaultListModel<String> history = new DefaultListModel<>();
    private final JPanel adjustCard;

    public StockPanel(Services app, MainFrame frame) {
        super(app, frame, "Stock Management", new BeanTableModel<>(
                new BeanTableModel.Column<Product>("Stock ID", String.class, Product::getId),
                new BeanTableModel.Column<Product>("Name", String.class, Product::getName),
                new BeanTableModel.Column<Product>("Category", String.class, Product::getCategory),
                new BeanTableModel.Column<Product>("On hand", Integer.class, Product::getOnHand),
                new BeanTableModel.Column<Product>("Price", BigDecimal.class, Product::getPrice),
                new BeanTableModel.Column<Product>("Status", String.class, p -> p.getStatus().label())));
        category.setEditable(true);
        desc.setLineWrap(true);
        desc.setWrapStyleWord(true);
        picture.setPreferredSize(new java.awt.Dimension(72, 72));

        JPanel head = new JPanel(new BorderLayout(10, 0));
        head.add(picture, BorderLayout.WEST);
        head.add(level, BorderLayout.CENTER);

        Ui.Form form = new Ui.Form()
                .full(head)
                .add("Stock ID:", id).add("Stock Name:", name).add("Brand:", brand).add("Category:", category)
                .add("Stock Desc.:", new JScrollPane(desc)).add("On-Hand:", onHand).add("Price ($):", price).add("Status:", status);

        Ui.Form adjust = new Ui.Form().add("Operation:", op).add("Quantity:", qty).add("Reason:", reason);
        JPanel adjustButtons = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        adjustButtons.add(Ui.primary("Submit adjustment", e -> adjust()));
        adjust.full(adjustButtons);
        adjustCard = Ui.card(adjust, "Perform stock adjustment");

        JList<String> historyList = new JList<>(history);
        historyList.setVisibleRowCount(5);
        JPanel extra = new JPanel(new BorderLayout(0, 10));
        extra.add(adjustCard, BorderLayout.NORTH);
        extra.add(Ui.card(new JScrollPane(historyList), "Audit history"), BorderLayout.CENTER);

        JPanel all = new JPanel(new BorderLayout(0, 12));
        all.add(form, BorderLayout.NORTH);
        all.add(extra, BorderLayout.CENTER);
        formHolder.add(all, BorderLayout.CENTER);
    }

    @Override public String key() { return "stock"; }
    @Override protected boolean canEdit() { return app.session.can("stock.manage"); }

    @Override
    public void onShow() {
        Async.run(this, app.stock::categories, list -> {
            category.removeAllItems();
            list.forEach(category::addItem);
        });
        boolean edit = canEdit();
        for (var c : new java.awt.Component[]{id, name, brand, category, desc, onHand, price, status}) c.setEnabled(edit);
        super.onShow();
    }

    @Override protected Product blank() { return new Product(); }

    @Override
    protected void fill(Product p) {
        id.setText(p.getId() == null ? "" : p.getId());
        id.setEditable(p.isNew());
        name.setText(p.getName());
        brand.setText(p.getBrand());
        category.setSelectedItem(p.getCategory());
        desc.setText(p.getDescription());
        onHand.setValue(p.getOnHand());
        price.setText(p.isNew() ? "" : p.getPrice().toPlainString());
        status.setSelectedItem(p.getStatus() == RecordStatus.DISABLED ? RecordStatus.DISABLED : RecordStatus.ACTIVE);
        picture.setIcon(Ui.productImage(p.getImage(), 64));
        level.setText(p.isNew() ? "New stock item" : "<html><b>" + Ui.escape(p.getName()) + "</b><br>" + switch (p.level()) {
            case OUT -> "<span style='color:#b3362e'>Out of stock</span>";
            case LOW -> "<span style='color:#b06a00'>Low stock - " + p.getOnHand() + " left</span>";
            case IN -> "In stock - " + p.getOnHand() + " on hand";
        } + "</html>");
        adjustCard.setVisible(!p.isNew() && app.session.can("stock.adjust"));
        history.clear();
        if (!p.isNew() && app.session.can("stock.history")) {
            DateTimeFormatter f = DateTimeFormatter.ofPattern("dd/MM/yyyy h:mm a");
            Async.run(this, () -> app.stock.history(p.getId()), list -> {
                history.clear();
                for (LedgerEntry e : list) history.addElement(e.at().format(f) + "  " + e.operation() + "  " + e.before() + " → " + e.after() + "  " + e.reason() + "  · " + e.user());
                if (list.isEmpty()) history.addElement("No adjustments yet.");
            });
        }
    }

    @Override
    protected Product read() {
        Product p = new Product();
        String sku = id.getText().trim().toUpperCase();
        p.setId(sku.isEmpty() ? null : sku);
        p.setName(name.getText());
        p.setBrand(brand.getText());
        p.setCategory(category.getSelectedItem() == null ? "" : category.getSelectedItem().toString());
        p.setDescription(desc.getText());
        p.setOnHand((Integer) onHand.getValue());
        try {
            p.setPrice(new BigDecimal(price.getText().trim().replace("$", "").replace(",", "")));
        } catch (NumberFormatException e) {
            Ui.errors(this, "Please check", List.of("Price must be a number, for example 89.00."));
            return null;
        }
        p.setStatus((RecordStatus) status.getSelectedItem());
        if (current != null && !current.isNew()) p.setImage(current.getImage());
        return p;
    }

    @Override protected List<Product> load(String q) throws Exception { return app.stock.search(q); }
    @Override protected Product store(Product p) throws Exception { return app.stock.save(p, current == null || current.isNew()); }
    @Override protected void remove(Product p) throws Exception { app.stock.delete(p.getId()); }

    private void adjust() {
        if (current == null || current.isNew()) return;
        String sku = current.getId();
        StockService.Operation operation = (StockService.Operation) op.getSelectedItem();
        int amount = (Integer) qty.getValue();
        String why = (String) reason.getSelectedItem();
        Async.run(this, () -> app.stock.adjust(sku, operation, amount, why), p -> {
            frame.status("Success: stock records revised - " + p.getName() + " now " + p.getOnHand() + " on hand.");
            current = p;
            reload();
        });
    }
}
