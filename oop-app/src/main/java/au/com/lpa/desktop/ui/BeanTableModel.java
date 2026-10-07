package au.com.lpa.desktop.ui;

import javax.swing.table.AbstractTableModel;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/**
 * A reusable (generic) table model: give it the columns once, then any list of objects.
 * Used by every list screen (stock, clients, users, invoices, invoice lines).
 */
public class BeanTableModel<T> extends AbstractTableModel {

    /** One column: heading, value type (for sorting / alignment) and how to read the value. */
    public record Column<T>(String name, Class<?> type, Function<T, Object> value) { }

    private final List<Column<T>> columns;
    private List<T> rows = new ArrayList<>();

    @SafeVarargs
    public BeanTableModel(Column<T>... columns) { this.columns = List.of(columns); }

    public void setRows(List<T> rows) {
        this.rows = new ArrayList<>(rows);
        fireTableDataChanged();
    }

    public List<T> rows() { return List.copyOf(rows); }
    public T row(int i) { return i >= 0 && i < rows.size() ? rows.get(i) : null; }

    @Override public int getRowCount() { return rows.size(); }
    @Override public int getColumnCount() { return columns.size(); }
    @Override public String getColumnName(int c) { return columns.get(c).name(); }
    @Override public Class<?> getColumnClass(int c) { return columns.get(c).type(); }
    @Override public Object getValueAt(int r, int c) { return columns.get(c).value().apply(rows.get(r)); }
}
