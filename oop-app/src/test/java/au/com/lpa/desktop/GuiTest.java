package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.ui.LoginDialog;
import au.com.lpa.desktop.ui.MainFrame;
import com.formdev.flatlaf.FlatLightLaf;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import javax.imageio.ImageIO;
import javax.swing.AbstractButton;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JOptionPane;
import javax.swing.JPasswordField;
import javax.swing.JSpinner;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Container;
import java.awt.GraphicsEnvironment;
import java.awt.Rectangle;
import java.awt.Robot;
import java.awt.Window;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Drives the real Swing windows like a user (type, click, read the screen) and saves a screenshot
 * of every step to target/screenshots. Needs a display (on Linux CI: xvfb-run) and the database.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GuiTest {

    static Services app;
    static final AtomicReference<MainFrame> frame = new AtomicReference<>();
    static final File SHOTS = new File("target/screenshots");
    static Robot robot;

    @BeforeAll
    static void start() throws Exception {
        assumeTrue(!GraphicsEnvironment.isHeadless(), "no display - GUI tests skipped");
        Path env = Path.of("..", ".env");
        assumeTrue(Files.exists(env), "no ../.env");
        System.setProperty("lpa.env", env.toString());
        try {
            app = new Services(AppConfig.load());
            app.db.run(c -> c.isValid(2));
        } catch (Exception e) {
            assumeTrue(false, "database not reachable");
        }
        SwingUtilities.invokeAndWait(FlatLightLaf::setup);
        robot = new Robot();
        SHOTS.mkdirs();
    }

    @AfterAll
    static void stop() throws Exception {
        if (frame.get() != null) SwingUtilities.invokeAndWait(() -> frame.get().dispose());
        if (app != null) app.close();
    }

    // ---------- helpers ----------
    static void waitFor(String what, BooleanSupplier ok) throws Exception {
        long end = System.currentTimeMillis() + 10_000;
        while (System.currentTimeMillis() < end) {
            AtomicReference<Boolean> r = new AtomicReference<>(false);
            SwingUtilities.invokeAndWait(() -> r.set(ok.getAsBoolean()));
            if (r.get()) return;
            Thread.sleep(100);
        }
        fail("Timed out waiting for: " + what);
    }

    @SuppressWarnings("unchecked")
    static <T extends Component> T find(Container root, Class<T> type, Predicate<T> test) {
        for (Component c : all(root)) if (type.isInstance(c) && c.isShowing() && test.test((T) c)) return (T) c;
        return null;
    }

    static List<Component> all(Container root) {
        List<Component> out = new ArrayList<>();
        for (Component c : root.getComponents()) {
            out.add(c);
            if (c instanceof Container k) out.addAll(all(k));
        }
        if (root instanceof JMenu m) for (Component c : m.getMenuComponents()) out.add(c);
        return out;
    }

    static <T extends Component> T named(Container root, Class<T> type, String name) { return find(root, type, c -> name.equals(c.getName())); }
    static AbstractButton button(Container root, String text) { return find(root, AbstractButton.class, b -> text.equals(b.getText())); }

    static Window window(Predicate<Window> test) {
        for (Window w : Window.getWindows()) if (w.isShowing() && test.test(w)) return w;
        return null;
    }

    static JDialog optionPane() {
        return (JDialog) window(w -> w instanceof JDialog d && find(d.getContentPane(), JOptionPane.class, p -> true) != null);
    }

    static void shot(String name, Window w) throws Exception {
        Thread.sleep(400);
        Rectangle r = w.getBounds();
        ImageIO.write(robot.createScreenCapture(r), "png", new File(SHOTS, name + ".png"));
    }

    static void edt(Runnable r) throws Exception { SwingUtilities.invokeAndWait(r); }

    static String text(JLabel l) { return l.getText() == null ? "" : l.getText(); }

    static void closeOptionPane() throws Exception {
        waitFor("message box", () -> optionPane() != null);
        edt(() -> optionPane().dispose());
    }

    // ---------- the user's journey ----------
    @Test @Order(1) @DisplayName("G-01 Wrong password: message shown, still on the login window")
    void loginFails() throws Exception {
        SwingUtilities.invokeLater(() -> {
            User u = new LoginDialog(null, app).showDialog();
            if (u != null) { MainFrame f = new MainFrame(app); frame.set(f); f.start(); }
        });
        waitFor("login window", () -> window(w -> w instanceof LoginDialog) != null);
        Window login = window(w -> w instanceof LoginDialog);
        edt(() -> {
            named((Container) login, JTextField.class, "username").setText("palvim");
            named((Container) login, JPasswordField.class, "password").setText("wrong-pass1");
            ((JButton) named((Container) login, JButton.class, "login")).doClick();
        });
        waitFor("error message", () -> optionPane() != null);
        shot("01-login-failed", optionPane());
        closeOptionPane();
        assertTrue(login.isShowing());
    }

    @Test @Order(2) @DisplayName("G-02 Correct password opens the main window with the administrator's menus")
    void loginWorks() throws Exception {
        Window login = window(w -> w instanceof LoginDialog);
        edt(() -> {
            named((Container) login, JPasswordField.class, "password").setText("Lpa#2026");
            ((JButton) named((Container) login, JButton.class, "login")).doClick();
        });
        waitFor("main window", () -> frame.get() != null && frame.get().isShowing());
        MainFrame f = frame.get();
        waitFor("home numbers", () -> find(f.getContentPane(), JLabel.class, l -> text(l).startsWith("$")) != null);
        JMenuBar bar = f.getJMenuBar();
        List<String> menus = new ArrayList<>();
        for (int i = 0; i < bar.getMenuCount(); i++) menus.add(bar.getMenu(i).getText());
        assertEquals(List.of("Menu", "Sales and Invoicing", "System Administration", "Exit", "Help"), menus);
        assertNotNull(find(bar.getMenu(2), javax.swing.JMenuItem.class, m -> "User Management".equals(m.getText())) == null
                ? (Object) all(bar.getMenu(2).getPopupMenu()).stream().filter(c -> c instanceof javax.swing.JMenuItem m && "User Management".equals(m.getText())).findFirst().orElse(null)
                : "ok");
        shot("02-home-administrator", f);
    }

    @Test @Order(3) @DisplayName("G-03 Stock Management lists the items from MySQL; selecting one fills the form")
    void stock() throws Exception {
        MainFrame f = frame.get();
        edt(() -> f.show("stock"));
        waitFor("stock rows", () -> { JTable t = named(f.getContentPane(), JTable.class, "table"); return t != null && t.getRowCount() == 8; });
        edt(() -> named(f.getContentPane(), JTable.class, "table").setRowSelectionInterval(1, 1));
        waitFor("form filled", () -> find(f.getContentPane(), JTextField.class, t -> "LPA-002".equals(t.getText())) != null);
        shot("03-stock", f);
        edt(() -> { JTextField s = named(f.getContentPane(), JTextField.class, "search"); s.setText("keyboard"); s.postActionEvent(); });
        waitFor("search result", () -> named(f.getContentPane(), JTable.class, "table").getRowCount() == 2);
    }

    @Test @Order(4) @DisplayName("G-04 New invoice: client + item lookups, live total, save updates stock")
    void newInvoice() throws Exception {
        MainFrame f = frame.get();
        int before = app.invoices.search("").size();
        edt(() -> f.show("new-invoice"));
        Container c = f.getContentPane();
        edt(() -> { named(c, JTextField.class, "clientId").setText("CL-002"); button(c, "Search Client").doClick(); });
        waitFor("client found", () -> text(named(c, JLabel.class, "clientName")).equals("DevWorks Pty Ltd"));
        edt(() -> { named(c, JTextField.class, "itemId").setText("lpa-005"); button(c, "Search Item").doClick(); });
        waitFor("item found", () -> text(named(c, JLabel.class, "itemName")).equals("1080p HD Webcam CV-10"));
        edt(() -> { named(c, JSpinner.class, "qty").setValue(2); button(c, "Add Item").doClick(); });
        waitFor("total", () -> text(named(c, JLabel.class, "total")).contains("$138.00"));
        shot("04-new-invoice", f);
        edt(() -> button(c, "Save Invoice").doClick());
        waitFor("saved message", () -> optionPane() != null);
        JDialog msg = optionPane();
        String saved = find(msg.getContentPane(), JLabel.class, l -> text(l).startsWith("Invoice INV-")) != null
                ? text(find(msg.getContentPane(), JLabel.class, l -> text(l).startsWith("Invoice INV-"))) : "";
        shot("05-invoice-saved", msg);
        closeOptionPane();
        assertTrue(saved.contains("$138.00"), saved);
        waitFor("invoice list", () -> { JTable t = named(f.getContentPane(), JTable.class, "table"); return t != null && t.isShowing() && t.getRowCount() == before + 1; });
        edt(() -> { JTable t = named(f.getContentPane(), JTable.class, "table"); t.setRowSelectionInterval(before, before); });
        waitFor("invoice detail", () -> find(f.getContentPane(), JLabel.class, l -> text(l).contains("DevWorks Pty Ltd") && text(l).contains("INV-")) != null);
        shot("06-invoices", f);
    }

    @Test @Order(5) @DisplayName("G-05 Clients: phone search finds the client (encrypted column, blind index)")
    void clients() throws Exception {
        MainFrame f = frame.get();
        edt(() -> f.show("clients"));
        Container c = f.getContentPane();
        waitFor("clients", () -> named(c, JTable.class, "table") != null && named(c, JTable.class, "table").getRowCount() >= 6);
        edt(() -> { JTextField s = named(c, JTextField.class, "search"); s.setText("(07) 3266 7788"); s.postActionEvent(); });
        waitFor("phone search", () -> named(c, JTable.class, "table").getRowCount() == 1 && "CL-004".equals(named(c, JTable.class, "table").getValueAt(0, 0)));
        edt(() -> named(c, JTable.class, "table").setRowSelectionInterval(0, 0));
        shot("07-clients-phone-search", f);
    }

    @Test @Order(6) @DisplayName("G-06 User Management and My User Details screens")
    void users() throws Exception {
        MainFrame f = frame.get();
        edt(() -> f.show("users"));
        waitFor("users", () -> named(f.getContentPane(), JTable.class, "table") != null && named(f.getContentPane(), JTable.class, "table").getRowCount() >= 3);
        edt(() -> named(f.getContentPane(), JTable.class, "table").setRowSelectionInterval(1, 1));
        shot("08-users", f);
        edt(() -> f.show("me"));
        shot("09-my-details", f);
    }

    @Test @Order(7) @DisplayName("G-07 Staff sees fewer menus (no New Invoice, no User Management)")
    void staffMenus() throws Exception {
        app.auth.logout();
        app.auth.login("mchang", "Lpa#2026");
        MainFrame staff = new MainFrame(app);
        edt(staff::start);
        waitFor("staff window", staff::isShowing);
        List<String> items = new ArrayList<>();
        JMenuBar bar = staff.getJMenuBar();
        for (int i = 0; i < bar.getMenuCount(); i++) for (Component c : bar.getMenu(i).getMenuComponents()) if (c instanceof javax.swing.JMenuItem m) items.add(m.getText());
        assertFalse(items.contains("User Management"));
        assertFalse(items.contains("New Invoice"));
        assertTrue(items.contains("Stock Management"));
        edt(() -> staff.show("stock"));
        waitFor("staff stock", () -> named(staff.getContentPane(), JTable.class, "table").getRowCount() == 8);
        edt(() -> named(staff.getContentPane(), JTable.class, "table").setRowSelectionInterval(3, 3));
        waitFor("adjust box", () -> button(staff.getContentPane(), "Submit adjustment") != null);
        assertFalse(button(staff.getContentPane(), "Save") != null && button(staff.getContentPane(), "Save").isShowing());
        assertNotNull(button(staff.getContentPane(), "Submit adjustment"));
        shot("10-staff-stock", staff);
        edt(staff::dispose);
    }
}
