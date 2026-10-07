package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import au.com.lpa.desktop.service.ServiceException;
import au.com.lpa.desktop.service.StockService;
import au.com.lpa.desktop.util.Db;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Interactive database program tests against the REAL lpa_ecomms database (MySQL / MariaDB),
 * using the web app's .env. Skipped when the database cannot be reached.
 * Run after `npm run db:setup` for the expected starting data.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DatabaseIntegrationTest {

    static Services app;
    static AppConfig config;
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000_000L, 36).toUpperCase();
    static final String SKU = "T-" + RUN;

    @BeforeAll
    static void connect() {
        Path env = Path.of("..", ".env");
        assumeTrue(Files.exists(env), "no ../.env - database tests skipped");
        System.setProperty("lpa.env", env.toString());
        config = AppConfig.load();
        try {
            app = new Services(config);
            app.db.run(c -> c.isValid(2));
        } catch (Exception e) {
            System.err.println("DB tests skipped: " + e);
            assumeTrue(false, "database not reachable: " + e.getMessage());
        }
    }

    @AfterAll
    static void close() { if (app != null) app.close(); }

    static void as(String user) throws Exception {
        app.auth.logout();
        app.auth.login(user, "Lpa#2026");
    }

    static String raw(String sql, String param) throws Exception {
        return app.db.run(c -> {
            try (var ps = c.prepareStatement(sql)) {
                ps.setString(1, param);
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : null; }
            }
        });
    }

    @Test @Order(1) @DisplayName("I-01 Sign in with the web app's accounts; group decides the menus")
    void signIn() throws Exception {
        as("palvim");
        assertEquals(UserGroup.ADMINISTRATOR, app.session.user().getGroup());
        assertTrue(app.session.can("users.manage"));
        as("mchang");
        assertEquals("Michael Chang", app.session.user().fullName());
        assertFalse(app.session.can("users.manage"));
        assertThrows(ServiceException.class, () -> app.auth.login("aturner", "Lpa#2026"));
    }

    @Test @Order(2) @DisplayName("I-02 Stock: insert, read, update, soft delete (checked in the table)")
    void stockCrud() throws Exception {
        as("palvim");
        Product p = new Product();
        p.setId(SKU); p.setName("Test Hub " + RUN); p.setBrand("Orbit"); p.setCategory("Docks & Hubs"); p.setOnHand(3); p.setPrice(new BigDecimal("49.90"));
        app.stock.save(p, true);
        assertEquals("49.90", raw("SELECT lpa_stock_price FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
        assertEquals(1, app.stock.search("Test Hub " + RUN).size());
        p.setPrice(new BigDecimal("44.50"));
        app.stock.save(p, false);
        assertEquals("44.50", raw("SELECT lpa_stock_price FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
        ServiceException dup = assertThrows(ServiceException.class, () -> app.stock.save(p, true));
        assertTrue(dup.getMessage().contains("already exists"));
        Product bad = new Product(); bad.setName(""); bad.setBrand("x"); bad.setPrice(new BigDecimal("-1"));
        assertEquals(2, assertThrows(ServiceException.class, () -> app.stock.save(bad, true)).messages().size());
    }

    @Test @Order(3) @DisplayName("I-03 Stock adjustment + audit history in one transaction; never below zero")
    void adjust() throws Exception {
        as("mchang"); // staff may adjust
        assertEquals(8, app.stock.adjust(SKU, StockService.Operation.ADD, 5, "Restocked from primary shipment").getOnHand());
        assertEquals(0, app.stock.adjust(SKU, StockService.Operation.REMOVE, 50, "Damaged / write-off").getOnHand());
        assertEquals(3, app.stock.adjust(SKU, StockService.Operation.RECONCILE, 3, "Physical inventory count").getOnHand());
        var history = app.stock.history(SKU);
        assertEquals(3, history.size());
        assertEquals("Michael Chang", history.get(0).user());
        assertEquals("reconcile", history.get(0).operation());
        assertThrows(ServiceException.class, () -> app.stock.save(new Product(), true)); // staff cannot manage items
    }

    @Test @Order(4) @DisplayName("I-04 Clients: phone stored encrypted; search by name and by exact phone")
    void clients() throws Exception {
        as("palvim");
        Client c = new Client();
        c.setFirstName("Test"); c.setLastName("Client " + RUN); c.setAddress("1 Test St, Brisbane QLD 4000"); c.setPhone("(07) 3999 " + String.format("%04d", Math.abs(RUN.hashCode()) % 10000));
        app.clients.save(c);
        String stored = raw("SELECT lpa_client_phone FROM lpa_clients WHERE lpa_client_ID = ?", c.getId());
        assertTrue(stored.startsWith("v1.") && !stored.contains("3999"), stored);
        assertTrue(app.clients.search("Client " + RUN).stream().anyMatch(x -> x.getId().equals(c.getId())));
        List<Client> byPhone = app.clients.search(c.getPhone().replace(" ", ""));
        assertEquals(List.of(c.getId()), byPhone.stream().map(Client::getId).toList());
        assertEquals("(07) 3266 7788", app.clients.search("Northgate").get(0).getPhone()); // decrypts seed data encrypted by the web app
    }

    @Test @Order(5) @DisplayName("I-05 New invoice: catalogue price used, stock reduced, history written")
    void createInvoice() throws Exception {
        as("palvim");
        Invoice draft = new Invoice();
        draft.setClientId("CL-004");
        draft.setDate(LocalDate.now(au.com.lpa.desktop.util.Clocks.LPA));
        draft.addLine(new InvoiceLine(SKU, "fake name", 2, new BigDecimal("0.01"))); // the screen's price is ignored
        Invoice saved = app.invoices.create(draft);
        assertTrue(saved.getId().matches("INV-\\d+"));
        assertEquals(new BigDecimal("89.00"), saved.total()); // 2 x 44.50 from the catalogue
        assertEquals("Test Hub " + RUN, saved.getLines().get(0).name());
        assertEquals("1", raw("SELECT lpa_stock_onhand FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
        assertEquals("Sold - " + saved.getId(), app.stock.history(SKU).get(0).reason());
        assertTrue(app.invoices.search(saved.getId()).size() == 1);
    }

    @Test @Order(6) @DisplayName("I-06 Invoice with too many items is refused and NOTHING is saved (rollback)")
    void rollback() throws Exception {
        as("palvim");
        String before = raw("SELECT COUNT(*) FROM lpa_invoices WHERE lpa_inv_client_ID = ?", "CL-002");
        String webcam = raw("SELECT lpa_stock_onhand FROM lpa_stock WHERE lpa_stock_ID = ?", "LPA-005");
        Invoice draft = new Invoice();
        draft.setClientId("CL-002");
        draft.addLine(new InvoiceLine("LPA-005", "Webcam", 1, BigDecimal.ONE));
        draft.addLine(new InvoiceLine(SKU, "Hub", 99, BigDecimal.ONE));
        ServiceException e = assertThrows(ServiceException.class, () -> app.invoices.create(draft));
        assertTrue(e.getMessage().contains("Only 1 of Test Hub"), e.getMessage());
        assertEquals(before, raw("SELECT COUNT(*) FROM lpa_invoices WHERE lpa_inv_client_ID = ?", "CL-002"));
        assertEquals(webcam, raw("SELECT lpa_stock_onhand FROM lpa_stock WHERE lpa_stock_ID = ?", "LPA-005"));
        Invoice disabled = new Invoice();
        disabled.setClientId("CL-005");
        disabled.addLine(new InvoiceLine("LPA-005", "Webcam", 1, BigDecimal.ONE));
        assertTrue(assertThrows(ServiceException.class, () -> app.invoices.create(disabled)).getMessage().contains("disabled"));
    }

    @Test @Order(7) @DisplayName("I-07 Two invoices at the same moment for the last item: only one succeeds")
    void concurrency() throws Exception {
        as("palvim");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Callable<String>> jobs = new ArrayList<>();
        for (String client : new String[]{"CL-001", "CL-003"}) {
            jobs.add(() -> {
                Invoice d = new Invoice();
                d.setClientId(client);
                d.addLine(new InvoiceLine(SKU, "Hub", 1, BigDecimal.ONE));
                try { return app.invoices.create(d).getId(); } catch (ServiceException e) { return "refused"; }
            });
        }
        List<String> results = new ArrayList<>();
        for (Future<String> f : pool.invokeAll(jobs)) results.add(f.get());
        pool.shutdown();
        assertEquals(1, results.stream().filter(r -> r.startsWith("INV-")).count(), results.toString());
        assertEquals("0", raw("SELECT lpa_stock_onhand FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
    }

    @Test @Order(8) @DisplayName("I-08 Delete an invoice: stock comes back; staff may not delete")
    void deleteInvoice() throws Exception {
        as("palvim");
        String no = app.invoices.search("Test Hub").isEmpty() ? null : null;
        Invoice last = app.invoices.search("CL-004").stream().reduce((a, b) -> b).orElseThrow();
        as("mchang");
        assertThrows(ServiceException.class, () -> app.invoices.delete(last.getId()));
        as("palvim");
        app.invoices.delete(last.getId());
        assertEquals("2", raw("SELECT lpa_stock_onhand FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
        assertTrue(app.invoices.open(last.getId()).isEmpty());
        assertNull(no);
    }

    @Test @Order(9) @DisplayName("I-09 SQL injection in every search box does nothing")
    void injection() throws Exception {
        as("palvim");
        String evil = "' OR '1'='1' -- ";
        assertTrue(app.stock.search(evil).isEmpty());
        assertTrue(app.clients.search(evil).isEmpty());
        assertTrue(app.invoices.search(evil).isEmpty());
        assertTrue(app.users.search(evil).isEmpty());
        assertTrue(app.invoices.findClient("CL-001' OR '1'='1").isEmpty());
        assertEquals("6", app.db.run(c -> { try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'lpa_ecomms'")) { r.next(); return r.getString(1); } }));
    }

    @Test @Order(10) @DisplayName("I-10 User management: add a user in the desktop app, sign in with it; rules enforced")
    void users() throws Exception {
        as("palvim");
        User u = new User();
        String name = ("tst" + RUN).toLowerCase();
        u.setUsername(name); u.setFirstName("Test"); u.setLastName("Staff"); u.setGroup(UserGroup.USER);
        assertTrue(assertThrows(ServiceException.class, () -> app.users.save(u, "Password1", "Password1")).getMessage().contains("too common"));
        app.users.save(u, "Desk#Top2026", "Desk#Top2026");
        assertTrue(raw("SELECT lpa_user_password FROM lpa_users WHERE lpa_user_username = ?", name).startsWith("scrypt$"));
        app.auth.logout();
        assertEquals(name, app.auth.login(name, "Desk#Top2026").getUsername());
        as("palvim");
        User me = app.session.user();
        me.setGroup(UserGroup.USER);
        assertTrue(assertThrows(ServiceException.class, () -> app.users.save(me, "", "")).getMessage().contains("your own administrator"));
        app.users.delete(u.getId());
        app.auth.logout();
        assertThrows(ServiceException.class, () -> app.auth.login(name, "Desk#Top2026"));
    }

    @Test @Order(11) @DisplayName("I-11 Optimisation: pooled connections are reused and much faster than a new connection per query")
    void pooling() throws Exception {
        as("palvim");
        Db db = app.db;
        int openedBefore = db.connectionsOpened();
        long t = System.nanoTime();
        for (int i = 0; i < 200; i++) app.stock.search("keyboard");
        double pooledMs = (System.nanoTime() - t) / 1e6 / 200;
        int opened = db.connectionsOpened() - openedBefore;
        t = System.nanoTime();
        for (int i = 0; i < 50; i++) {
            try (Connection c = DriverManager.getConnection(config.dbUrl(), config.dbUser(), config.dbPassword());
                 var ps = c.prepareStatement("SELECT lpa_stock_ID FROM lpa_stock WHERE lpa_stock_name LIKE ?")) {
                ps.setString(1, "%keyboard%");
                ps.executeQuery().close();
            }
        }
        double unpooledMs = (System.nanoTime() - t) / 1e6 / 50;
        System.out.printf("I-11: pooled %.2f ms/query (%d new connections for 200 queries); new connection each time %.2f ms/query%n", pooledMs, opened, unpooledMs);
        assertTrue(opened <= 1, "connections opened: " + opened);
        assertTrue(pooledMs < unpooledMs, pooledMs + " vs " + unpooledMs);
    }

    @Test @Order(12) @DisplayName("I-12 Disabled records: deleted stock hidden; client 'delete' = disable")
    void softDelete() throws Exception {
        as("palvim");
        app.stock.delete(SKU);
        assertTrue(app.stock.search(SKU).isEmpty());
        assertEquals("x", raw("SELECT lpa_stock_status FROM lpa_stock WHERE lpa_stock_ID = ?", SKU));
        Client c = app.clients.search("Client " + RUN).get(0);
        app.clients.disable(c.getId());
        assertEquals(RecordStatus.DISABLED, app.clients.search("Client " + RUN).get(0).getStatus());
    }

    @Test @Order(13) @DisplayName("I-13 Reports on real data: reorder plan, sales per month, delivery route")
    void reports() throws Exception {
        as("mchang"); // staff may see reports
        var plan = app.reports.reorderPlan(10);
        assertEquals("LPA-008", plan.get(0).product().getId());          // 9 sold in 90 days, only 2 left
        assertEquals("Only 20 days of stock left", plan.get(0).reason());
        assertEquals(1, plan.get(0).suggestedQty());                      // 30 days x 0.1/day = 3, minus 2 on hand
        assertEquals("LPA-003", plan.get(1).product().getId());          // out of stock (no recent sales)
        assertEquals("LPA-004", plan.get(2).product().getId());          // low stock
        var sales = app.reports.sales(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-08-31"));
        assertEquals(new BigDecimal("803.50"), sales.total());
        assertEquals(new BigDecimal("546.50"), sales.months().get(0).total());
        assertEquals(new BigDecimal("257.00"), sales.months().get(1).total());
        var route = app.reports.deliveryRoute(app.reports.invoicesBetween(LocalDate.parse("2026-07-28"), LocalDate.parse("2026-08-04")));
        var suburbs = route.stops().stream().map(au.com.lpa.desktop.report.DeliveryPlanner.Stop::suburb).toList();
        assertEquals("Brisbane City", suburbs.get(0));
        assertTrue(suburbs.containsAll(List.of("Indooroopilly", "Northgate", "South Brisbane")), suburbs.toString());
        assertTrue(route.notOnMap().isEmpty(), route.notOnMap().toString());
        System.out.printf("I-13: route %s = %.1f km (greedy %.1f km)%n", suburbs, route.km(), route.greedyKm());
        app.auth.logout();
        app.auth.login("palvim", "Lpa#2026");
        User me = app.session.user();
        assertNotNull(me);
    }

    @Test @Order(14) @DisplayName("I-14 LRU cache: repeat lookups come from memory; a sale clears the item so the new stock is shown")
    void cache() throws Exception {
        as("palvim");
        app.cache.productCache().clear();
        long misses = app.cache.productCache().misses(), hits = app.cache.productCache().hits();
        int before = app.invoices.findProduct("LPA-007").orElseThrow().getOnHand();
        app.invoices.findProduct("lpa-007");
        assertEquals(misses + 1, app.cache.productCache().misses());
        assertEquals(hits + 1, app.cache.productCache().hits());
        Invoice d = new Invoice();
        d.setClientId("CL-003");
        d.addLine(new InvoiceLine("LPA-007", "Numpad", 1, BigDecimal.ONE));
        app.invoices.create(d);
        assertEquals(before - 1, app.invoices.findProduct("LPA-007").orElseThrow().getOnHand()); // not the stale cached value
        assertEquals(List.of("LPA-001", "LPA-007"), app.invoices.suggestProducts("mechanical", 5).stream().map(Product::getId).toList()); // trie
        assertEquals("CL-004", app.invoices.suggestClients("north", 5).get(0).getId());
    }
}
