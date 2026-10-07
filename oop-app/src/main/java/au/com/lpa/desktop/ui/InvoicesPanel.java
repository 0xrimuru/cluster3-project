package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;

import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Sales and Invoicing: search invoices (number, client, address, date), open one, delete it. */
public class InvoicesPanel extends BasePanel {

    private final JTextField search = new JTextField(22);
    private final BeanTableModel<Invoice> list = new BeanTableModel<>(
            new BeanTableModel.Column<Invoice>("Invoice", String.class, Invoice::getId),
            new BeanTableModel.Column<Invoice>("Date", LocalDate.class, Invoice::getDate),
            new BeanTableModel.Column<Invoice>("Client", String.class, Invoice::getClientName),
            new BeanTableModel.Column<Invoice>("Amount", BigDecimal.class, Invoice::total));
    private final BeanTableModel<InvoiceLine> lines = new BeanTableModel<>(
            new BeanTableModel.Column<InvoiceLine>("Item", String.class, l -> l.sku() + "  " + l.name()),
            new BeanTableModel.Column<InvoiceLine>("Qty", Integer.class, InvoiceLine::qty),
            new BeanTableModel.Column<InvoiceLine>("Price", BigDecimal.class, InvoiceLine::price),
            new BeanTableModel.Column<InvoiceLine>("Amount", BigDecimal.class, InvoiceLine::amount));
    private final JTable table = new JTable(list);
    private final JLabel total = new JLabel();
    private final JLabel header = new JLabel(" ");
    private final JLabel invTotal = new JLabel(" ");
    private final JButton newButton;
    private final JButton deleteButton;
    private Invoice open;

    public InvoicesPanel(Services app, MainFrame frame) {
        super(app, frame, "Sales and Invoicing");
        table.setAutoCreateRowSorter(true);
        table.setRowHeight(26);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.getSelectionModel().addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting() && table.getSelectedRow() >= 0) openInvoice(list.row(table.convertRowIndexToModel(table.getSelectedRow())));
        });
        search.putClientProperty("JTextField.placeholderText", "Number, client, address or YYYY-MM-DD");
        search.addActionListener(e -> reload());
        search.setName("search");
        table.setName("table");
        newButton = Ui.primary("New invoice", e -> frame.show("new-invoice"));
        deleteButton = Ui.danger("Delete invoice", e -> delete());

        JPanel bar = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        bar.add(new JLabel("Search:"));
        bar.add(search);
        bar.add(Ui.button("Search", e -> reload()));
        bar.add(newButton);
        bar.add(Ui.button("Close", e -> frame.showHome()));

        JPanel left = new JPanel(new BorderLayout(0, 8));
        left.add(bar, BorderLayout.NORTH);
        left.add(new JScrollPane(table), BorderLayout.CENTER);
        left.add(total, BorderLayout.SOUTH);

        JTable linesTable = new JTable(lines);
        linesTable.setRowHeight(24);
        linesTable.getColumnModel().getColumn(0).setPreferredWidth(260);
        linesTable.getColumnModel().getColumn(1).setPreferredWidth(50);
        JPanel detail = new JPanel(new BorderLayout(0, 8));
        detail.add(header, BorderLayout.NORTH);
        detail.add(new JScrollPane(linesTable), BorderLayout.CENTER);
        JPanel foot = new JPanel(new BorderLayout());
        foot.add(invTotal, BorderLayout.WEST);
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        actions.add(deleteButton);
        foot.add(actions, BorderLayout.EAST);
        detail.add(foot, BorderLayout.SOUTH);

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, left, Ui.card(detail, "Invoice"));
        split.setResizeWeight(0.5);
        split.setBorder(null);
        add(split, BorderLayout.CENTER);
    }

    @Override public String key() { return "invoices"; }

    @Override
    public void onShow() {
        newButton.setVisible(app.session.can("sales.create"));
        deleteButton.setVisible(app.session.can("sales.delete"));
        reload();
    }

    public void reload() {
        String q = search.getText();
        Async.run(this, () -> app.invoices.search(q), rows -> {
            list.setRows(rows);
            BigDecimal sum = rows.stream().map(Invoice::total).reduce(BigDecimal.ZERO, BigDecimal::add);
            total.setText("<html><b>" + rows.size() + "</b> invoice" + (rows.size() == 1 ? "" : "s") + " &nbsp; Total sales: <b>" + Ui.money(sum) + "</b></html>");
            if (open != null) rows.stream().filter(i -> i.getId().equals(open.getId())).findFirst().ifPresentOrElse(this::openInvoice, () -> show(null));
        });
    }

    public void openInvoice(Invoice summary) {
        Async.run(this, () -> app.invoices.open(summary.getId()), found -> show(found.orElse(null)));
    }

    private void show(Invoice inv) {
        open = inv;
        if (inv == null) {
            header.setText(" ");
            lines.setRows(List.of());
            invTotal.setText(" ");
            deleteButton.setEnabled(false);
            return;
        }
        header.setText("<html><b style='font-size:13pt'>" + inv.getId() + "</b> &nbsp; " + inv.getDate() + "<br>" + Ui.escape(inv.getClientName())
                + " (" + inv.getClientId() + ")<br><small>" + Ui.escape(inv.getClientAddress()) + " &middot; Payment: " + Ui.escape(inv.getPayment()) + "</small></html>");
        lines.setRows(inv.getLines());
        invTotal.setText("<html>Total (incl. GST " + Ui.money(inv.gst()) + "): <b>" + Ui.money(inv.total()) + "</b></html>");
        deleteButton.setEnabled(true);
    }

    private void delete() {
        if (open == null || !Ui.confirm(this, "Delete invoice " + open.getId() + "? Its items will be returned to stock.")) return;
        String no = open.getId();
        Async.run(this, () -> { app.invoices.delete(no); return no; }, n -> {
            frame.status("Invoice " + n + " deleted and its stock returned.");
            open = null;
            reload();
        });
    }
}
