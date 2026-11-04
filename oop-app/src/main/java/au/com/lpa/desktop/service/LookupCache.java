package au.com.lpa.desktop.service;

import au.com.lpa.desktop.algo.LruCache;
import au.com.lpa.desktop.algo.Trie;
import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Product;

import java.util.List;
import java.util.Optional;

/**
 * Speeds up the lookups the New Invoice screen does again and again:
 *  - LRU caches (50 products, 50 clients) for "Search Item" / "Search Client" by ID
 *  - tries (prefix trees) for type-ahead suggestions by name, ID, brand or category
 * Any change to stock or clients clears the affected entries, so nothing out of date is shown.
 */
public class LookupCache {

    final LruCache<String, Optional<Product>> products = new LruCache<>(50);
    final LruCache<String, Optional<Client>> clients = new LruCache<>(50);
    private volatile Trie<Product> productIndex;
    private volatile Trie<Client> clientIndex;

    public void productChanged(String sku) {
        if (sku != null) products.invalidate(sku.toUpperCase());
        productIndex = null;
    }

    public void clientChanged(String code) {
        if (code != null) clients.invalidate(code.toUpperCase());
        clientIndex = null;
    }

    Trie<Product> productIndex() { return productIndex; }
    Trie<Client> clientIndex() { return clientIndex; }

    Trie<Product> productIndex(List<Product> all) {
        Trie<Product> t = new Trie<>();
        for (Product p : all) t.add(p.getId() + " " + p.getName() + " " + p.getBrand() + " " + p.getCategory(), p);
        return productIndex = t;
    }

    Trie<Client> clientIndex(List<Client> all) {
        Trie<Client> t = new Trie<>();
        for (Client c : all) t.add(c.getId() + " " + c.fullName(), c);
        return clientIndex = t;
    }

    public LruCache<String, Optional<Product>> productCache() { return products; }
    public LruCache<String, Optional<Client>> clientCache() { return clients; }
}
