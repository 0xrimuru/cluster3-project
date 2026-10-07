# Phase 11 — ICTPRG547 Apply advanced programming skills in another language (Java)

Built into the desktop app (`oop-app/`): **Reports and Planning** menu, type-ahead in New Invoice, invoice **Save as PDF**, CSV exports.

| Data structure / algorithm (written by hand, `oop-app/.../algo`) | Used for |
|---|---|
| Trie (prefix tree), recursive depth-first collection | Type-ahead suggestions for items and clients (New Invoice) |
| Binary min-heap + top-k | Reorder planner (most urgent items); Dijkstra's priority queue |
| LRU cache (hash map + doubly linked list) | Stock / client lookups in New Invoice (cleared on every change) |
| Merge sort (stable), quick sort (3-way, random pivot), insertion sort | Best-selling items report; Algorithm lab timings |
| Binary search (lower / upper bound) | Cutting a date range out of invoices sorted by date |
| Weighted graph (adjacency list) + Dijkstra | Road distances between Brisbane suburbs (`delivery-map.json`) |
| Nearest neighbour + 2-opt (travelling-salesman heuristic) | Delivery route for the chosen invoices |
| Sliding-window moving average (deque) | 3-month sales trend line |

Third-party libraries: JFreeChart (sales chart), OpenPDF (invoice PDF), Apache Commons CSV (exports), Gson (policy file + delivery map),
Bouncy Castle (scrypt), FlatLaf (look and feel), MySQL Connector/J, JUnit 5 (tests).

| File | What it is |
|---|---|
| `desktop-test-results.json` | All 63 desktop tests (A-01..A-12 algorithms, R-01..R-05 reports/exports, I-13..I-14 on the database, G-08..G-10 GUI, plus Phase 10's): 63 / 63 PASS |
| `shots/` | Type-ahead, reorder planner, sales report chart, delivery route, algorithm lab |
| `samples/` | Outputs made by the tests: `INV-1001.pdf`, `reorder-plan.csv`, `sales-chart.png` |

Measured (test output): trie 0.007 ms vs list scan 1.19 ms per lookup (100,000 entries); 20,000 items — merge sort 15.6 ms,
quick sort 14.5 ms, insertion sort 545 ms; pooled query 0.8 ms vs 3.6 ms with a new connection.

Debugging notes: (1) the first expected route length in R-03 was a guess - recalculated by hand (45 km) and the algorithm was right;
(2) the reorder screen showed out-of-stock items last - urgency changed to tiers (selling+out, under 30 days, out, low, rest);
(3) a GUI test read the CSV before it was fully written - it now waits for the content; (4) one timing test was unreliable before
the JIT warmed up - it now warms up and takes the best of three rounds.
