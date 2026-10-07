package au.com.lpa.desktop.model;

/** The status codes stored in the lpa_* tables: a = active, d = disabled / inactive, x = deleted. */
public enum RecordStatus {
    ACTIVE('a', "Active"), DISABLED('d', "Disabled"), DELETED('x', "Deleted");

    private final char code;
    private final String label;

    RecordStatus(char code, String label) { this.code = code; this.label = label; }

    public String code() { return String.valueOf(code); }
    public String label() { return label; }

    public static RecordStatus fromCode(String c) {
        if (c != null && !c.isEmpty()) for (RecordStatus s : values()) if (s.code == Character.toLowerCase(c.charAt(0))) return s;
        return ACTIVE;
    }

    @Override public String toString() { return label; }
}
