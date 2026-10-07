package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.User;

import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import java.awt.BorderLayout;
import java.awt.FlowLayout;

/** My User Details: who I am, and change my own password (current password required). */
public class MyDetailsPanel extends BasePanel {

    private final JLabel info = new JLabel();
    private final JPasswordField current = new JPasswordField(18);
    private final JPasswordField next = new JPasswordField(18);
    private final JPasswordField confirm = new JPasswordField(18);

    public MyDetailsPanel(Services app, MainFrame frame) {
        super(app, frame, "My User Details");
        JPanel buttons = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        buttons.add(Ui.primary("Change password", e -> change()));
        buttons.add(Ui.button("Close", e -> frame.showHome()));
        Ui.Form pw = new Ui.Form().add("Current password:", current).add("New password:", next).add("Confirm new password:", confirm)
                .full(new JLabel("<html><small>8+ characters with a letter and a number; not a common password or your user name.</small></html>"))
                .full(buttons);
        JPanel body = new JPanel(new BorderLayout(0, 12));
        body.add(Ui.card(info, "My account"), BorderLayout.NORTH);
        body.add(Ui.card(pw, "Change password"), BorderLayout.CENTER);
        JPanel wrap = new JPanel(new BorderLayout());
        wrap.add(body, BorderLayout.NORTH);
        add(wrap, BorderLayout.CENTER);
    }

    @Override public String key() { return "me"; }

    @Override
    public void onShow() {
        User u = app.session.user();
        info.setText("<html><table><tr><td>User ID:</td><td><b>" + u.getId() + "</b></td></tr><tr><td>Username:</td><td><b>" + Ui.escape(u.getUsername())
                + "</b></td></tr><tr><td>Name:</td><td><b>" + Ui.escape(u.fullName()) + "</b></td></tr><tr><td>Group:</td><td><b>" + u.getGroup().label()
                + "</b></td></tr></table></html>");
        for (JPasswordField f : new JPasswordField[]{current, next, confirm}) f.setText("");
    }

    private void change() {
        String c = new String(current.getPassword()), n = new String(next.getPassword()), k = new String(confirm.getPassword());
        Async.run(this, () -> { app.users.changeMyPassword(c, n, k); return true; }, ok -> {
            Ui.info(this, "Password changed. Use the new password next time you sign in (web or desktop).");
            onShow();
        });
    }
}
