package au.com.lpa.desktop.model;

/** User groups (lpa_users.lpa_user_group). */
public enum UserGroup {
    ADMINISTRATOR("administrator", "Administrator"), USER("user", "Staff"), CUSTOMER("customer", "Customer");

    private final String db;
    private final String label;

    UserGroup(String db, String label) { this.db = db; this.label = label; }

    public String dbValue() { return db; }
    public String label() { return label; }

    public static UserGroup fromDb(String v) {
        for (UserGroup g : values()) if (g.db.equalsIgnoreCase(v)) return g;
        throw new IllegalArgumentException("Unknown user group " + v);
    }

    @Override public String toString() { return label; }
}
