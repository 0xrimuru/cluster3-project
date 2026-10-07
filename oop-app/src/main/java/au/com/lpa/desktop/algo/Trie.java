package au.com.lpa.desktop.algo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Prefix tree (trie) for type-ahead suggestions.
 * Every word of every entry is inserted ("mechanical keyboard mk-87" can be found by "mec", "key" or
 * "mk"), so finding suggestions costs O(length of the typed prefix + number of results) - it does not
 * depend on how many entries there are (a list scan is O(n x length)).
 *
 * @param <V> the value returned for a match (e.g. a Product)
 */
public class Trie<V> {

    /** One node: children by character (TreeMap keeps them in alphabetical order) + values ending here. */
    private static final class Node<V> {
        final Map<Character, Node<V>> children = new TreeMap<>();
        final Set<V> values = new LinkedHashSet<>();
    }

    private final Node<V> root = new Node<>();
    private int size;

    /** Adds the value under the whole text and under each of its words. */
    public void add(String text, V value) {
        if (text == null || value == null) return;
        String clean = normalise(text);
        Set<String> keys = new LinkedHashSet<>();
        keys.add(clean);
        for (String w : clean.split(" ")) if (!w.isEmpty()) keys.add(w);
        for (String key : keys) insert(key, value);
        size++;
    }

    private void insert(String key, V value) {
        Node<V> n = root;
        for (char c : key.toCharArray()) n = n.children.computeIfAbsent(c, k -> new Node<>());
        n.values.add(value);
    }

    /** Up to {@code limit} values whose text (or one of its words) starts with the prefix. */
    public List<V> suggest(String prefix, int limit) {
        String p = normalise(prefix);
        if (p.isEmpty() || limit <= 0) return Collections.emptyList();
        Node<V> n = root;
        for (char c : p.toCharArray()) {
            n = n.children.get(c);
            if (n == null) return Collections.emptyList();
        }
        Set<V> out = new LinkedHashSet<>();
        collect(n, out, limit);
        return new ArrayList<>(out);
    }

    /** Depth-first walk (recursive) below a node, alphabetical order, stops at the limit. */
    private void collect(Node<V> n, Set<V> out, int limit) {
        for (V v : n.values) {
            if (out.size() >= limit) return;
            out.add(v);
        }
        for (Node<V> child : n.children.values()) {
            if (out.size() >= limit) return;
            collect(child, out, limit);
        }
    }

    public boolean containsPrefix(String prefix) { return !suggest(prefix, 1).isEmpty(); }

    /** Number of entries added. */
    public int size() { return size; }

    static String normalise(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\- ]", " ").replaceAll("\\s+", " ").trim();
    }
}
