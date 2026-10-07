package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.Entity;

import javax.swing.BorderFactory;
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
import java.util.List;

/**
 * A list + form screen for one kind of record (search, New, Save, Delete, Close) - the layout of
 * the LPA reference desktop app. Stock, Clients and Users are subclasses that only describe their
 * columns, their form and which service to call (template method pattern + generics).
 */
public abstract class CrudPanel<T extends Entity<String>> extends BasePanel {

    protected final JTextField searchField = new JTextField(22);
    protected final BeanTableModel<T> model;
    protected final JTable table;
    protected final JLabel count = new JLabel();
    protected final JButton newButton;
    protected final JButton saveButton;
    protected final JButton deleteButton;
    protected final JPanel formHolder = new JPanel(new BorderLayout(0, 10));
    protected T current;

    protected CrudPanel(Services app, MainFrame frame, String title, BeanTableModel<T> model) {
        super(app, frame, title);
        this.model = model;
        this.table = new JTable(model);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setAutoCreateRowSorter(true);
        table.setRowHeight(26);
        table.getSelectionModel().addListSelectionListener(e -> {
            if (e.getValueIsAdjusting()) return;
            int view = table.getSelectedRow();
            if (view >= 0) select(model.row(table.convertRowIndexToModel(view)));
        });

        searchField.putClientProperty("JTextField.placeholderText", "Search...");
        searchField.setName("search");
        table.setName("table");
        searchField.addActionListener(e -> reload());
        newButton = Ui.button("New", e -> select(blank()));
        saveButton = Ui.primary("Save", e -> save());
        deleteButton = Ui.danger(deleteLabel(), e -> delete());

        JPanel bar = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        bar.add(new JLabel("Search:"));
        bar.add(searchField);
        bar.add(Ui.button("Search", e -> reload()));
        bar.add(newButton);
        bar.add(Ui.button("Close", e -> frame.showHome()));
        bar.add(count);

        JPanel left = new JPanel(new BorderLayout(0, 8));
        left.add(bar, BorderLayout.NORTH);
        left.add(new JScrollPane(table), BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        actions.add(saveButton);
        actions.add(deleteButton);
        formHolder.add(actions, BorderLayout.SOUTH);
        formHolder.setBorder(BorderFactory.createEmptyBorder(0, 12, 0, 0));

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, left, new JScrollPane(formHolder));
        split.setResizeWeight(0.55);
        split.setBorder(null);
        add(split, BorderLayout.CENTER);
    }

    // ---- what each screen provides ----
    protected abstract T blank();
    protected abstract void fill(T item);
    /** Reads the form into a new object; returns null (after showing a message) when a field cannot be read. */
    protected abstract T read();
    protected abstract List<T> load(String query) throws Exception;
    protected abstract T store(T item) throws Exception;
    protected abstract void remove(T item) throws Exception;
    protected abstract boolean canEdit();
    protected String deleteLabel() { return "Delete"; }

    @Override
    public void onShow() {
        boolean edit = canEdit();
        newButton.setVisible(edit);
        saveButton.setVisible(edit);
        deleteButton.setVisible(edit);
        reload();
        searchField.requestFocusInWindow();
    }

    protected void reload() {
        String q = searchField.getText();
        Async.run(this, () -> load(q), rows -> {
            model.setRows(rows);
            count.setText(rows.size() + " result" + (rows.size() == 1 ? "" : "s"));
            if (current == null || current.isNew()) select(current == null ? blank() : current);
            else rows.stream().filter(r -> r.equals(current)).findFirst().ifPresentOrElse(this::select, () -> select(blank()));
        });
    }

    protected void select(T item) {
        current = item;
        fill(item);
        deleteButton.setEnabled(item != null && !item.isNew());
    }

    private void save() {
        T item = read();
        if (item == null) return;
        Async.run(this, () -> store(item), saved -> {
            current = saved;
            frame.status("Saved " + saved.getId() + " " + saved.displayName());
            reload();
        });
    }

    private void delete() {
        if (current == null || current.isNew()) return;
        if (!Ui.confirm(this, deleteLabel() + " " + current.getId() + " " + current.displayName() + "?")) return;
        T item = current;
        Async.run(this, () -> { remove(item); return item; }, done -> {
            frame.status(deleteLabel() + ": " + done.getId());
            current = null;
            reload();
        });
    }
}
