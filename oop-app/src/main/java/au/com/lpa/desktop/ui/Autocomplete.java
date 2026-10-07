package au.com.lpa.desktop.ui;

import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.JTextField;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Type-ahead suggestions under a text field. While the user types, the lookup (a trie in
 * LookupCache) runs in the background 150 ms after the last key press; clicking a suggestion
 * puts its ID in the field and runs the field's search.
 */
public final class Autocomplete<T> {

    public interface Lookup<T> { List<T> find(String prefix) throws Exception; }

    private final JTextField field;
    private final JPopupMenu popup = new JPopupMenu();
    private final Timer debounce;
    private boolean picking;

    private Autocomplete(JTextField field, Lookup<T> lookup, Function<T, String> label, Function<T, String> id, Consumer<String> onPick) {
        this.field = field;
        popup.setFocusable(false);
        debounce = new Timer(150, e -> {
            String text = field.getText().trim();
            if (text.length() < 2) { popup.setVisible(false); return; }
            Async.run(field, () -> lookup.find(text), items -> show(items, label, id, onPick));
        });
        debounce.setRepeats(false);
        field.getDocument().addDocumentListener(new DocumentListener() {
            @Override public void insertUpdate(DocumentEvent e) { changed(); }
            @Override public void removeUpdate(DocumentEvent e) { changed(); }
            @Override public void changedUpdate(DocumentEvent e) { changed(); }
        });
    }

    public static <T> Autocomplete<T> attach(JTextField field, Lookup<T> lookup, Function<T, String> label, Function<T, String> id, Consumer<String> onPick) {
        return new Autocomplete<>(field, lookup, label, id, onPick);
    }

    private void changed() {
        if (!picking) debounce.restart();
    }

    private void show(List<T> items, Function<T, String> label, Function<T, String> id, Consumer<String> onPick) {
        popup.setVisible(false);
        popup.removeAll();
        if (items.isEmpty() || !field.isShowing() || !field.hasFocus() && !Boolean.getBoolean("lpa.test")) return;
        for (T item : items) {
            JMenuItem mi = new JMenuItem(label.apply(item));
            mi.addActionListener(e -> {
                picking = true;
                field.setText(id.apply(item));
                picking = false;
                popup.setVisible(false);
                onPick.accept(id.apply(item));
            });
            popup.add(mi);
        }
        popup.show(field, 0, field.getHeight());
    }

    /** For tests: the suggestions currently shown. */
    public List<String> shown() {
        return java.util.Arrays.stream(popup.getComponents()).filter(c -> c instanceof JMenuItem).map(c -> ((JMenuItem) c).getText()).toList();
    }

    public void pick(int index) { ((JMenuItem) popup.getComponent(index)).doClick(); }
}
