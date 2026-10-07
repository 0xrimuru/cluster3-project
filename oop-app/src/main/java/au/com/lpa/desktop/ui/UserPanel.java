package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;

import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import java.util.List;

/** User Management (administrators): search, add, edit, deactivate, delete accounts. */
public class UserPanel extends CrudPanel<User> {

    private final JLabel userId = new JLabel();
    private final JTextField username = new JTextField();
    private final JTextField first = new JTextField();
    private final JTextField last = new JTextField();
    private final JComboBox<UserGroup> group = new JComboBox<>(UserGroup.values());
    private final JPasswordField password = new JPasswordField();
    private final JPasswordField confirm = new JPasswordField();
    private final JComboBox<RecordStatus> status = new JComboBox<>(new RecordStatus[]{RecordStatus.ACTIVE, RecordStatus.DISABLED});
    private final JLabel passwordHint = new JLabel();
    private String pendingPassword = "";
    private String pendingConfirm = "";

    public UserPanel(Services app, MainFrame frame) {
        super(app, frame, "User Management", new BeanTableModel<>(
                new BeanTableModel.Column<User>("User ID", String.class, User::getId),
                new BeanTableModel.Column<User>("Username", String.class, User::getUsername),
                new BeanTableModel.Column<User>("Name", String.class, User::fullName),
                new BeanTableModel.Column<User>("Group", String.class, u -> u.getGroup().label()),
                new BeanTableModel.Column<User>("Status", String.class, u -> u.getStatus() == RecordStatus.ACTIVE ? "Active" : "Inactive")));
        formHolder.add(new Ui.Form().add("User ID:", userId).add("Username:", username).add("First Name:", first).add("Last Name:", last)
                .add("Group:", group).add("Password:", password).add("Confirm:", confirm).full(passwordHint).add("Status:", status).end(), java.awt.BorderLayout.CENTER);
    }

    @Override public String key() { return "users"; }
    @Override protected boolean canEdit() { return app.session.can("users.manage"); }
    @Override protected User blank() { User u = new User(); u.setGroup(UserGroup.USER); return u; }

    @Override
    protected void fill(User u) {
        userId.setText(u.isNew() ? "(new - next U number)" : u.getId());
        username.setText(u.getUsername());
        first.setText(u.getFirstName());
        last.setText(u.getLastName());
        group.setSelectedItem(u.getGroup());
        password.setText("");
        confirm.setText("");
        status.setSelectedItem(u.getStatus() == RecordStatus.ACTIVE ? RecordStatus.ACTIVE : RecordStatus.DISABLED);
        passwordHint.setText("<html><small>" + (u.isNew() ? "Required: 8+ characters with a letter and a number; not a common password."
                : "Leave blank to keep the current password.") + "</small></html>");
    }

    @Override
    protected User read() {
        User u = new User();
        if (current != null && !current.isNew()) u.setId(current.getId());
        u.setUsername(username.getText());
        u.setFirstName(first.getText());
        u.setLastName(last.getText());
        u.setGroup((UserGroup) group.getSelectedItem());
        u.setStatus((RecordStatus) status.getSelectedItem());
        pendingPassword = new String(password.getPassword());
        pendingConfirm = new String(confirm.getPassword());
        return u;
    }

    @Override protected List<User> load(String q) throws Exception { return app.users.search(q); }
    @Override protected User store(User u) throws Exception { return app.users.save(u, pendingPassword, pendingConfirm); }
    @Override protected void remove(User u) throws Exception { app.users.delete(u.getId()); }
}
