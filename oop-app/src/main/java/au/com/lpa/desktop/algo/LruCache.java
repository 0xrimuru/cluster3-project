package au.com.lpa.desktop.algo;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Least-recently-used cache: a hash map (O(1) lookup) + a doubly linked list (O(1) "move to front"
 * and "remove oldest"). When it is full, the entry used longest ago is removed.
 * Used for product / client lookups in the New Invoice screen (fewer database round trips).
 */
public class LruCache<K, V> {

    private final class Entry {
        final K key;
        V value;
        Entry prev, next;
        Entry(K key, V value) { this.key = key; this.value = value; }
    }

    private final int capacity;
    private final Map<K, Entry> map = new HashMap<>();
    private final Entry head = new Entry(null, null); // most recently used after head
    private final Entry tail = new Entry(null, null); // least recently used before tail
    private long hits, misses, evictions;

    public LruCache(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be at least 1");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public synchronized Optional<V> get(K key) {
        Entry e = map.get(key);
        if (e == null) { misses++; return Optional.empty(); }
        hits++;
        moveToFront(e);
        return Optional.ofNullable(e.value);
    }

    public synchronized void put(K key, V value) {
        Entry e = map.get(key);
        if (e != null) {
            e.value = value;
            moveToFront(e);
            return;
        }
        e = new Entry(key, value);
        map.put(key, e);
        linkFirst(e);
        if (map.size() > capacity) {
            Entry oldest = tail.prev;
            unlink(oldest);
            map.remove(oldest.key);
            evictions++;
        }
    }

    /** Value from the cache, or loaded (and cached) when missing. */
    public V computeIfAbsent(K key, Function<K, V> loader) {
        Optional<V> v = get(key);
        if (v.isPresent()) return v.get();
        V loaded = loader.apply(key);
        if (loaded != null) put(key, loaded);
        return loaded;
    }

    public synchronized void invalidate(K key) {
        Entry e = map.remove(key);
        if (e != null) unlink(e);
    }

    public synchronized void clear() {
        map.clear();
        head.next = tail;
        tail.prev = head;
    }

    public synchronized int size() { return map.size(); }
    public synchronized long hits() { return hits; }
    public synchronized long misses() { return misses; }
    public synchronized long evictions() { return evictions; }
    public synchronized double hitRate() { return hits + misses == 0 ? 0 : (double) hits / (hits + misses); }

    /** Keys from most to least recently used (for tests and the Algorithm lab). */
    public synchronized java.util.List<K> keysByRecency() {
        java.util.List<K> out = new java.util.ArrayList<>();
        for (Entry e = head.next; e != tail; e = e.next) out.add(e.key);
        return out;
    }

    private void moveToFront(Entry e) { unlink(e); linkFirst(e); }
    private void linkFirst(Entry e) { e.next = head.next; e.prev = head; head.next.prev = e; head.next = e; }
    private void unlink(Entry e) { e.prev.next = e.next; e.next.prev = e.prev; }
}
