package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import au.com.lpa.desktop.security.PasswordHasher;
import au.com.lpa.desktop.util.Db;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

/** User accounts - table lpa_users. Passwords are only ever stored as scrypt hashes. */
public class UserRepository extends JdbcRepository<User> {

    public UserRepository(Db db) { super(db); }

    @Override protected String table() { return "lpa_users"; }
    @Override protected String idColumn() { return "lpa_user_ID"; }
    @Override protected String statusColumn() { return "lpa_user_status"; }
    @Override protected String selectSql() {
        return "SELECT lpa_user_ID, lpa_user_username, lpa_user_firstname, lpa_user_lastname, lpa_user_group, lpa_user_client_ID, lpa_user_status FROM lpa_users";
    }
    @Override protected String searchExpression() { return "CONCAT_WS(' ', lpa_user_ID, lpa_user_username, lpa_user_firstname, lpa_user_lastname, lpa_user_group)"; }

    @Override
    protected User map(ResultSet rs) throws SQLException {
        User u = new User();
        u.setId(rs.getString(1));
        u.setUsername(rs.getString(2));
        u.setFirstName(rs.getString(3));
        u.setLastName(rs.getString(4));
        u.setGroup(UserGroup.fromDb(rs.getString(5)));
        u.setClientId(rs.getString(6));
        u.setStatus(RecordStatus.fromCode(rs.getString(7)));
        return u;
    }

    /** Active account with this user name, together with its password hash (for signing in). */
    public Optional<Credentials> credentials(String username) throws SQLException {
        return db.run(c -> {
            try (PreparedStatement ps = prepare(c, selectSql().replace(" FROM", ", lpa_user_password FROM") + " WHERE lpa_user_username = ? AND lpa_user_status = 'a'",
                    username == null ? "" : username.trim().toLowerCase()); ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new Credentials(map(rs), rs.getString(8))) : Optional.empty();
            }
        });
    }

    /** A user plus the stored hash - kept separate so the hash is never put on a User object. */
    public record Credentials(User user, String passwordHash) { }

    /** Is the user name used by another row (even a deleted one - it is a UNIQUE key)? */
    public boolean usernameTaken(String username, String exceptId) throws SQLException {
        return db.run(c -> {
            try (PreparedStatement ps = prepare(c, "SELECT lpa_user_ID FROM lpa_users WHERE lpa_user_username = ?", username); ResultSet rs = ps.executeQuery()) {
                return rs.next() && !rs.getString(1).equals(exceptId);
            }
        });
    }

    @Override
    public User save(User u) { throw new UnsupportedOperationException("Use save(user, password)"); }

    /** INSERT (password required) or UPDATE (blank password keeps the current one). */
    public User save(User u, String newPassword) throws SQLException {
        return db.transaction(c -> {
            String status = u.getStatus() == RecordStatus.ACTIVE ? "a" : "d";
            if (u.isNew()) {
                u.setId(nextId(c, "U-", 3));
                update(c, "INSERT INTO lpa_users (lpa_user_ID, lpa_user_username, lpa_user_password, lpa_user_firstname, lpa_user_lastname, "
                        + "lpa_user_group, lpa_user_client_ID, lpa_user_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        u.getId(), u.getUsername(), PasswordHasher.hash(newPassword), u.getFirstName(), u.getLastName(),
                        u.getGroup().dbValue(), u.getClientId(), status);
            } else {
                update(c, "UPDATE lpa_users SET lpa_user_username = ?, lpa_user_firstname = ?, lpa_user_lastname = ?, lpa_user_group = ?, "
                        + "lpa_user_status = ? WHERE lpa_user_ID = ?", u.getUsername(), u.getFirstName(), u.getLastName(), u.getGroup().dbValue(), status, u.getId());
                if (newPassword != null && !newPassword.isEmpty()) {
                    update(c, "UPDATE lpa_users SET lpa_user_password = ? WHERE lpa_user_ID = ?", PasswordHasher.hash(newPassword), u.getId());
                }
            }
            return u;
        });
    }
}
