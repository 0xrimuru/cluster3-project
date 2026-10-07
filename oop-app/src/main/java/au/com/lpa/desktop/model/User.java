package au.com.lpa.desktop.model;

import java.util.List;
import java.util.regex.Pattern;

/** A user account (lpa_users). The password hash never leaves the repository. */
public class User extends Person {

    public static final Pattern USERNAME = Pattern.compile("^[a-z0-9._-]{3,30}$");

    private String username = "";
    private UserGroup group = UserGroup.USER;
    private String clientId;

    public String getUsername() { return username; }
    public void setUsername(String v) { this.username = v == null ? "" : v.trim().toLowerCase(); }
    public UserGroup getGroup() { return group; }
    public void setGroup(UserGroup g) { this.group = g; }
    public String getClientId() { return clientId; }
    public void setClientId(String v) { this.clientId = v; }

    /** A separate copy (changing the copy never changes the original). */
    public User copy() {
        User u = new User();
        u.setId(getId()); u.setStatus(getStatus()); u.setFirstName(getFirstName()); u.setLastName(getLastName());
        u.username = username; u.group = group; u.clientId = clientId;
        return u;
    }

    @Override
    public List<String> validate() {
        List<String> errors = super.validate();
        if (!USERNAME.matcher(username).matches()) errors.add(0, "User name must be 3-30 characters: lower-case letters, numbers, dot, dash or underscore.");
        if (group == null) errors.add("Choose a user group.");
        return errors;
    }

    @Override public String searchText() { return String.join(" ", String.valueOf(getId()), username, fullName(), group.label()).toLowerCase(); }
}
