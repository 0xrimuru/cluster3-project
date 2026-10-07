package au.com.lpa.desktop.model;

import java.time.LocalDateTime;

/** One row of the stock audit history (lpa_stock_ledger) as shown on screen. */
public record LedgerEntry(String sku, String title, String user, String operation, String reason, int before, int after, LocalDateTime at) { }
