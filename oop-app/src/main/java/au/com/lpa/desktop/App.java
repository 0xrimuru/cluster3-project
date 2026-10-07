package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.ui.LoginDialog;
import au.com.lpa.desktop.ui.MainFrame;
import com.formdev.flatlaf.FlatDarkLaf;
import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import java.util.prefs.Preferences;

/**
 * LPA Administration System - desktop interface for LPA staff (ICTPRG549).
 * Start:  java -jar lpa-desktop.jar      (needs the web app's .env, see AppConfig)
 */
public final class App {

    private App() { }

    public static void main(String[] args) {
        boolean dark = Preferences.userNodeForPackage(MainFrame.class).getBoolean("dark", false);
        if (dark) FlatDarkLaf.setup(); else FlatLightLaf.setup();
        UIManager.put("Component.arc", 10);
        UIManager.put("Button.arc", 10);
        UIManager.put("TextComponent.arc", 8);
        UIManager.put("Table.showHorizontalLines", true);
        SwingUtilities.invokeLater(() -> {
            Services app;
            try {
                app = new Services(AppConfig.load());
            } catch (RuntimeException e) {
                JOptionPane.showMessageDialog(null, e.getMessage(), "LPA - cannot start", JOptionPane.ERROR_MESSAGE);
                System.exit(1);
                return;
            }
            signIn(app);
        });
    }

    /** Shows the login window, then the main window (also used after Logout). */
    public static void signIn(Services app) {
        User user = new LoginDialog(null, app).showDialog();
        if (user == null) {
            app.close();
            System.exit(0);
        }
        new MainFrame(app).start();
    }
}
