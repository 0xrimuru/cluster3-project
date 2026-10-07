package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import au.com.lpa.desktop.repo.UserRepository;
import au.com.lpa.desktop.security.PasswordHasher;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** User management (administrators) and "My user details" (everyone). */
public class UserService {

    private final UserRepository users;
    private final Session session;

    public UserService(UserRepository users, Session session) {
        this.users = users;
        this.session = session;
    }

    public List<User> search(String text) throws SQLException, ServiceException {
        session.require("users.manage");
        return users.search(text);
    }

    public User save(User u, String password, String confirm) throws SQLException, ServiceException {
        session.require("users.manage");
        List<String> errors = new ArrayList<>(u.validate());
        if (users.usernameTaken(u.getUsername(), u.getId())) errors.add("That user name is already taken.");
        boolean isNew = u.isNew();
        if (isNew || (password != null && !password.isEmpty())) {
            PasswordRules.problem(password, u.getUsername()).ifPresent(errors::add);
            if (!password.equals(confirm)) errors.add("Password and confirm password must match.");
        }
        User me = session.user();
        if (!isNew && u.getId().equals(me.getId()) && (u.getGroup() != UserGroup.ADMINISTRATOR || u.getStatus() != RecordStatus.ACTIVE))
            errors.add("You cannot remove your own administrator access or deactivate yourself.");
        if (!errors.isEmpty()) throw new ServiceException(errors);
        return users.save(u, password);
    }

    public void delete(String id) throws SQLException, ServiceException {
        session.require("users.manage");
        if (id.equals(session.user().getId())) throw new ServiceException("You cannot delete your own account.");
        if (!users.delete(id)) throw new ServiceException("User not found.");
    }

    /** My user details: change my own password (current password required). */
    public void changeMyPassword(String current, String next, String confirm) throws SQLException, ServiceException {
        session.require("account.password");
        User me = session.user();
        List<String> errors = new ArrayList<>();
        boolean currentOk = users.credentials(me.getUsername()).map(c -> PasswordHasher.verify(current, c.passwordHash())).orElse(false);
        if (!currentOk) errors.add("Your current password is not correct.");
        PasswordRules.problem(next, me.getUsername()).ifPresent(errors::add);
        if (next == null || !next.equals(confirm)) errors.add("New password and confirm password must match.");
        if (currentOk && next != null && next.equals(current)) errors.add("The new password must be different from the current one.");
        if (!errors.isEmpty()) throw new ServiceException(errors);
        users.save(me, next);
    }
}
