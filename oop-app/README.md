# LPA Administration System — desktop app (Java)

The desktop interface of LPA eComms for LPA staff: stock management (with adjustments and audit history), invoices,
new invoice, clients, user management and "my user details". It uses the **same MySQL database, accounts, access policy
and encryption key** as the web app. ICTPRG549 (OOP + GUI + database) and ICTPRG547 (data structures, algorithms,
third-party libraries): Reports and Planning (reorder planner, sales chart, delivery route, algorithm lab), type-ahead, invoice PDF, CSV export.

## Run
1. The web app must be set up first (`npm run db:setup` in the folder above) — the desktop app reads its `.env`.
2. `run-desktop.bat` (Windows) or `java -jar target/lpa-desktop.jar` (Java 17 or newer).
   Sign in with the web app's accounts: `palvim` (administrator) or `mchang` (staff), password `Lpa#2026`. Customers cannot use it.

## Build and test
```
mvnw package          # Windows: mvnw.cmd package   (downloads Maven the first time)
```
Runs 63 tests: unit tests (model, rules, policy, Java <-> Node.js hash/encryption compatibility), database tests against
lpa_ecomms (CRUD, transactions, rollback, two users at once, SQL injection, connection pool) and GUI tests that drive the
real windows and save screenshots to `target/screenshots` (they need a screen and the database; otherwise they are skipped).

## Design (OOP)
- `model` — `Entity<ID>` (abstract) → `Person` (abstract) → `User`, `Client`; `Product`, `Invoice`; records `InvoiceLine`, `LedgerEntry`;
  interfaces `Validatable`, `Searchable`; enums `RecordStatus`, `UserGroup`.
- `repo` — generic `Repository<T, ID>` and abstract `JdbcRepository<T>` (template method, PreparedStatements only);
  `ProductRepository`, `ClientRepository` (encrypted phone), `UserRepository`, `InvoiceRepository`, `LedgerRepository`.
- `service` — business rules + permission checks: `AuthService` (lockout), `StockService`, `InvoiceService` (one transaction with
  `SELECT ... FOR UPDATE`), `ClientService`, `UserService`, `DashboardService`, `Session`, `PasswordRules`.
- `security` — `PasswordHasher` (scrypt, web-compatible), `FieldCrypto` (AES-256-GCM + blind index), `Policy` (config/security-policy.json).
- `ui` — Swing + FlatLaf: `MainFrame` (menus of the LPA reference app), `BasePanel` → `CrudPanel<T>` → `StockPanel`, `ClientPanel`, `UserPanel`;
  `InvoicesPanel`, `NewInvoicePanel`, `HomePanel`, `MyDetailsPanel`, `LoginDialog`; generic `BeanTableModel<T>`; `Async` (SwingWorker).
- `util` — `Db` (small connection pool + transactions), `Clocks`. `Services` wires everything together.

- `algo` (ICTPRG547) — written by hand, generic, tested against Java's own versions: `Trie` (type-ahead), `MinHeap` (+ top-k),
  `LruCache` (hash map + doubly linked list), `Sorts` (merge sort - stable, quick sort - 3-way random pivot, insertion sort),
  `BinarySearch` (lower/upper bound, ranges), `Graph` (adjacency list + Dijkstra), `RoutePlanner` (nearest neighbour + 2-opt),
  `MovingAverage` (sliding window with a deque).
- `report` — `ReorderPlanner` (heap), `SalesReport` (binary search + moving average + merge sort), `DeliveryPlanner`
  (suburb road graph in `delivery-map.json` + Dijkstra + 2-opt), `ReportService`, `ReportRepository`.
- `export` — `InvoicePdf` (OpenPDF), `CsvExport` (Apache Commons CSV); the sales chart uses JFreeChart.
- `service/LookupCache` — LRU caches + tries behind New Invoice lookups and type-ahead (cleared on every change).

Third-party libraries: MySQL Connector/J, Gson, Bouncy Castle, FlatLaf, JFreeChart, OpenPDF, Apache Commons CSV, JUnit 5.
