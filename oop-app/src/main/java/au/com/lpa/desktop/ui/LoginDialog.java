package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.User;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

/** The sign-in window (shown first, and again after Logout). */
public class LoginDialog extends JDialog {

    private final Services app;
    private final JTextField username = new JTextField(18);
    private final JPasswordField password = new JPasswordField(18);
    private final JLabel message = new JLabel(" ");
    private final JButton login;
    private User result;

    public LoginDialog(JFrame owner, Services app) {
        super(owner, "LPA - User Login", true);
        this.app = app;
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        addWindowListener(new WindowAdapter() {
            @Override public void windowClosing(WindowEvent e) { result = null; dispose(); }
        });

        JLabel logo = new JLabel("LPA", SwingConstants.CENTER);
        logo.setFont(logo.getFont().deriveFont(Font.BOLD, 34f));
        logo.setForeground(Ui.BRAND);
        JLabel sub = new JLabel("Administration System", SwingConstants.CENTER);
        sub.setForeground(Color.GRAY);
        JPanel head = new JPanel(new BorderLayout());
        head.add(logo, BorderLayout.CENTER);
        head.add(sub, BorderLayout.SOUTH);

        message.setForeground(Ui.DANGER);
        login = Ui.primary("Login", e -> attempt());
        getRootPane().setDefaultButton(login);
        Ui.Form form = new Ui.Form().add("User name:", username).add("Password:", password).full(message).full(login);
        username.setName("username");
        password.setName("password");
        login.setName("login");

        JPanel root = new JPanel(new BorderLayout(0, 14));
        root.setBorder(BorderFactory.createEmptyBorder(22, 28, 22, 28));
        root.add(head, BorderLayout.NORTH);
        root.add(form, BorderLayout.CENTER);
        setContentPane(root);
        pack();
        setResizable(false);
        setLocationRelativeTo(owner);
    }

    private void attempt() {
        String u = username.getText();
        String p = new String(password.getPassword());
        login.setEnabled(false);
        message.setText("Signing in...");
        message.setForeground(Color.GRAY);
        Async.run(this, () -> app.auth.login(u, p), user -> {
            result = user;
            dispose();
        }, () -> {
            login.setEnabled(true);
            password.setText("");
            message.setText("Sign-in failed - see the message.");
            message.setForeground(Ui.DANGER);
            password.requestFocusInWindow();
        });
    }

    /** Shows the dialog; returns the signed-in user, or null if the window was closed. */
    public User showDialog() {
        setVisible(true);
        return result;
    }
}
