package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import com.formdev.flatlaf.FlatDarkLaf;
import com.formdev.flatlaf.FlatLaf;
import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.BorderFactory;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JEditorPane;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.event.ActionListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.prefs.Preferences;

/**
 * The main window - the same menus as the LPA reference desktop app:
 *   Menu > Stock Management | Sales and Invoicing > Invoices, New Invoice, Clients |
 *   System Administration > My User Details, User Management | Exit > Logout, Shutdown |
 *   Help > Help Guide, About LPA.
 * Menu items the signed-in user may not use are not shown (access policy).
 */
public class MainFrame extends JFrame {

    private final Services app;
    private final CardLayout cards = new CardLayout();
    private final JPanel content = new JPanel(cards);
    private final Map<String, BasePanel> screens = new LinkedHashMap<>();
    private final JLabel statusBar = new JLabel(" ");
    private final Preferences prefs = Preferences.userNodeForPackage(MainFrame.class);

    public MainFrame(Services app) {
        super("LPA - Administration System v2.0");
        this.app = app;
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1000, 640));
        setSize(1180, 740);
        setLocationRelativeTo(null);

        for (BasePanel p : new BasePanel[]{new HomePanel(app, this), new StockPanel(app, this), new InvoicesPanel(app, this),
                new NewInvoicePanel(app, this), new ClientPanel(app, this), new UserPanel(app, this), new MyDetailsPanel(app, this), new ReportsPanel(app, this)}) {
            screens.put(p.key(), p);
            content.add(p, p.key());
        }
        statusBar.setBorder(BorderFactory.createEmptyBorder(4, 10, 4, 10));
        getContentPane().add(content, BorderLayout.CENTER);
        getContentPane().add(statusBar, BorderLayout.SOUTH);
    }

    /** Builds the menus for the signed-in user and shows the home screen. */
    public void start() {
        setJMenuBar(buildMenus());
        status("Signed in as " + app.session.user().fullName() + " (" + app.session.user().getGroup().label() + ")  ·  database "
                + app.config.get("DB_NAME", "lpa_ecomms") + " on " + app.config.get("DB_HOST", "127.0.0.1"));
        showHome();
        setVisible(true);
    }

    private JMenuBar buildMenus() {
        JMenuBar bar = new JMenuBar();
        JMenu menu = new JMenu("Menu");
        menu.add(item("Home", 'H', e -> showHome()));
        if (app.session.can("stock.view")) menu.add(item("Stock Management", 'S', e -> show("stock")));
        bar.add(menu);

        JMenu sales = new JMenu("Sales and Invoicing");
        if (app.session.can("sales.view")) sales.add(item("Invoices", 'I', e -> show("invoices")));
        if (app.session.can("sales.create")) sales.add(item("New Invoice", 'N', e -> show("new-invoice")));
        if (app.session.can("clients.view")) sales.add(item("Clients", 'C', e -> show("clients")));
        if (sales.getItemCount() > 0) bar.add(sales);

        if (app.session.can("reports.view")) {
            JMenu reports = new JMenu("Reports");
            reports.add(item("Reports and Planning", 'R', e -> show("reports")));
            bar.add(reports);
        }

        JMenu admin = new JMenu("System Administration");
        if (app.session.can("account.password")) admin.add(item("My User Details", (char) 0, e -> show("me")));
        if (app.session.can("users.manage")) admin.add(item("User Management", 'U', e -> show("users")));
        JCheckBoxMenuItem dark = new JCheckBoxMenuItem("Dark theme", FlatLaf.isLafDark());
        dark.addActionListener(e -> setTheme(dark.isSelected()));
        admin.addSeparator();
        admin.add(dark);
        bar.add(admin);

        JMenu exit = new JMenu("Exit");
        exit.add(item("Logout", (char) 0, e -> logout()));
        exit.add(item("Shutdown", 'Q', e -> shutdown()));
        bar.add(exit);

        JMenu help = new JMenu("Help");
        help.add(item("Help Guide", (char) 0, e -> html("Help Guide", "/help.html")));
        help.add(item("About LPA", (char) 0, e -> html("About LPA", "/about.html")));
        bar.add(help);
        return bar;
    }

    private static JMenuItem item(String text, char key, ActionListener action) {
        JMenuItem i = new JMenuItem(text);
        if (key != 0) i.setAccelerator(KeyStroke.getKeyStroke(key, InputEvent.CTRL_DOWN_MASK));
        i.addActionListener(action);
        return i;
    }

    public void show(String key) {
        BasePanel p = screens.get(key);
        if (p == null) return;
        cards.show(content, key);
        p.onShow();
    }

    public void showHome() { show("home"); }

    public void status(String text) { statusBar.setText(text); }


    /** Tests: the screen objects. */
    public java.util.Collection<BasePanel> screens() { return screens.values(); }

    private void logout() {
        app.auth.logout();
        setVisible(false);
        dispose();
        SwingUtilities.invokeLater(() -> au.com.lpa.desktop.App.signIn(app));
    }

    private void shutdown() {
        if (JOptionPane.showConfirmDialog(this, "Close the LPA Administration System?", "Shutdown", JOptionPane.OK_CANCEL_OPTION) == JOptionPane.OK_OPTION) {
            app.close();
            System.exit(0);
        }
    }

    private void setTheme(boolean dark) {
        prefs.putBoolean("dark", dark);
        if (dark) FlatDarkLaf.setup(); else FlatLightLaf.setup();
        FlatLaf.updateUI();
    }

    private void html(String title, String resource) {
        String text;
        try (InputStream in = MainFrame.class.getResourceAsStream(resource)) {
            text = in == null ? "Not found." : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            text = "Not available.";
        }
        JEditorPane pane = new JEditorPane("text/html", text);
        pane.setEditable(false);
        pane.setCaretPosition(0);
        JScrollPane scroll = new JScrollPane(pane);
        scroll.setPreferredSize(new Dimension(560, 460));
        JOptionPane.showMessageDialog(this, scroll, title, JOptionPane.PLAIN_MESSAGE);
    }
}
