package au.com.lpa.desktop.model;

/** Anything the quick filter on a list can match against the typed text. */
public interface Searchable {
    /** The text a search looks in (lower-case). */
    String searchText();

    default boolean matches(String query) {
        if (query == null || query.isBlank()) return true;
        String text = searchText();
        for (String word : query.toLowerCase().trim().split("\\s+")) if (!text.contains(word)) return false;
        return true;
    }
}
