package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.util.Clocks;

import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridLayout;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * New invoice (as in the LPA reference app): search a client by ID, search items by ID, add them
 * with a quantity, see the total, Save Invoice. The server-side rules (stock on hand, catalogue
 * prices, active client) are checked again by InvoiceService inside one transaction.
 */
public class NewInvoicePanel extends BasePanel {

    private final JLabel number = new JLabel();
    private final JTextField date = new JTextField(10);
    private final JTextField clientId = new JTextField(10);
    private final JLabel clientName = new JLabel("-");
    private final JLabel clientAddress = new JLabel("-");
    private final JLabel clientPhone = new JLabel("-");
    private final JTextField itemId = new JTextField(10);
    private final JLabel itemName = new JLabel("-");
    private final JLabel itemPrice = new JLabel("-");
    private final JLabel itemStock = new JLabel("-");
    private final JSpinner qty = new JSpinner(new SpinnerNumberModel(1, 1, 100000, 1));
    private final JButton addItem;
    private final BeanTableModel<InvoiceLine> linesModel = new BeanTableModel<>(
            new BeanTableModel.Column<InvoiceLine>("Stock ID", String.class, InvoiceLine::sku),
            new BeanTableModel.Column<InvoiceLine>("Name", String.class, InvoiceLine::name),
            new BeanTableModel.Column<InvoiceLine>("Qty", Integer.class, InvoiceLine::qty),
            new BeanTableModel.Column<InvoiceLine>("Price", BigDecimal.class, InvoiceLine::price),
            new BeanTableModel.Column<InvoiceLine>("Amount", BigDecimal.class, InvoiceLine::amount));
    private final JTable lines = new JTable(linesModel);
    private final JLabel total = new JLabel();
    private Invoice draft = new Invoice();
    private Client client;
    private Product item;

    public NewInvoicePanel(Services app, MainFrame frame) {
        super(app, frame, "New Invoice");
        clientId.setName("clientId"); itemId.setName("itemId"); qty.setName("qty"); clientName.setName("clientName"); itemName.setName("itemName"); total.setName("total");
        clientId.addActionListener(e -> findClient());
        itemId.addActionListener(e -> findItem());
        addItem = Ui.button("Add Item", e -> addLine());
        lines.setRowHeight(24);

        Ui.Form inv = new Ui.Form().add("Invoice No.:", number).add("Date (YYYY-MM-DD):", date);
        JPanel cl = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        cl.add(clientId);
        cl.add(Ui.button("Search Client", e -> findClient()));
        Ui.Form clientForm = new Ui.Form().add("Client ID:", cl).add("Name:", clientName).add("Address:", clientAddress).add("Phone:", clientPhone);
        JPanel it = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        it.add(itemId);
        it.add(Ui.button("Search Item", e -> findItem()));
        JPanel q = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        q.add(qty);
        q.add(addItem);
        Ui.Form itemForm = new Ui.Form().add("Stock ID:", it).add("Name:", itemName).add("Price:", itemPrice).add("On hand:", itemStock).add("Quantity:", q);

        JPanel top = new JPanel(new GridLayout(1, 3, 12, 0));
        top.add(Ui.card(inv, "Invoice"));
        top.add(Ui.card(clientForm, "Client"));
        top.add(Ui.card(itemForm, "Item"));

        JPanel bottom = new JPanel(new BorderLayout());
        bottom.add(total, BorderLayout.WEST);
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 0));
        actions.add(Ui.danger("Remove line", e -> removeLine()));
        actions.add(Ui.primary("Save Invoice", e -> save()));
        actions.add(Ui.button("Close", e -> frame.show("invoices")));
        bottom.add(actions, BorderLayout.EAST);

        JPanel centre = new JPanel(new BorderLayout(0, 10));
        centre.add(top, BorderLayout.NORTH);
        centre.add(Ui.card(new JScrollPane(lines), "Line items"), BorderLayout.CENTER);
        centre.add(bottom, BorderLayout.SOUTH);
        add(centre, BorderLayout.CENTER);
    }

    @Override public String key() { return "new-invoice"; }

    @Override
    public void onShow() {
        reset();
        Async.run(this, app.invoices::nextNumberPreview, n -> number.setText(n + " (on save)"));
        clientId.requestFocusInWindow();
    }

    private void reset() {
        draft = new Invoice();
        client = null;
        item = null;
        date.setText(Clocks.nowBrisbane().toLocalDate().toString());
        for (JTextField f : new JTextField[]{clientId, itemId}) f.setText("");
        for (JLabel l : new JLabel[]{clientName, clientAddress, clientPhone, itemName, itemPrice, itemStock}) l.setText("-");
        qty.setValue(1);
        addItem.setEnabled(false);
        refreshLines();
    }

    private void findClient() {
        String code = clientId.getText().trim();
        Async.run(this, () -> app.invoices.findClient(code), found -> {
            client = found.orElse(null);
            if (client == null) {
                clientName.setText("<html><span style='color:#b3362e'>No client with ID " + Ui.escape(code.toUpperCase()) + "</span></html>");
                clientAddress.setText("-");
                clientPhone.setText("-");
                return;
            }
            clientName.setText(client.fullName() + (client.isActive() ? "" : "  (disabled)"));
            clientAddress.setText(client.getAddress());
            clientPhone.setText(client.getPhone());
            itemId.requestFocusInWindow();
        });
    }

    private void findItem() {
        String sku = itemId.getText().trim();
        Async.run(this, () -> app.invoices.findProduct(sku), found -> {
            item = found.orElse(null);
            if (item == null) {
                itemName.setText("<html><span style='color:#b3362e'>No stock item " + Ui.escape(sku.toUpperCase()) + "</span></html>");
                itemPrice.setText("-");
                itemStock.setText("-");
                addItem.setEnabled(false);
                return;
            }
            itemName.setText(item.getName());
            itemPrice.setText(Ui.money(item.getPrice()));
            boolean sellable = item.isActive() && item.getOnHand() > 0;
            itemStock.setText(item.getOnHand() == 0 ? "<html><span style='color:#b3362e'>Out of stock</span></html>"
                    : (!item.isActive() ? "Disabled - cannot be sold" : String.valueOf(item.getOnHand())));
            addItem.setEnabled(sellable);
            qty.requestFocusInWindow();
        });
    }

    private void addLine() {
        if (item == null) return;
        int already = draft.getLines().stream().filter(l -> l.sku().equals(item.getId())).mapToInt(InvoiceLine::qty).sum();
        int want = (Integer) qty.getValue();
        if (already + want > item.getOnHand()) {
            Ui.errors(this, "Please check", List.of("Only " + item.getOnHand() + " of " + item.getName() + " on hand (" + already + " already on this invoice)."));
            return;
        }
        draft.addLine(new InvoiceLine(item.getId(), item.getName(), want, item.getPrice()));
        refreshLines();
        itemId.setText("");
        itemId.requestFocusInWindow();
    }

    private void removeLine() {
        int row = lines.getSelectedRow();
        if (row < 0) return;
        draft.removeLine(linesModel.row(row).sku());
        refreshLines();
    }

    private void refreshLines() {
        linesModel.setRows(draft.getLines());
        total.setText("<html>Total (incl. GST " + Ui.money(draft.gst()) + "): <b style='font-size:14pt'>" + Ui.money(draft.total()) + "</b></html>");
    }

    private void save() {
        try {
            draft.setDate(LocalDate.parse(date.getText().trim()));
        } catch (DateTimeParseException e) {
            Ui.errors(this, "Please check", List.of("Date must be a valid date, for example " + LocalDate.now() + "."));
            return;
        }
        draft.setClientId(client == null ? "" : client.getId());
        Invoice toSave = draft;
        Async.run(this, () -> app.invoices.create(toSave), saved -> {
            Ui.info(this, "Invoice " + saved.getId() + " saved: " + Ui.money(saved.total()) + ". Stock updated.");
            frame.status("Invoice " + saved.getId() + " saved.");
            frame.show("invoices");
        });
    }
}
