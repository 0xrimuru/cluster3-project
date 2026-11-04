package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.LedgerEntry;
import au.com.lpa.desktop.util.Db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Stock audit history - table lpa_stock_ledger (shared with the web app). */
public class LedgerRepository {

    private final Db db;

    public LedgerRepository(Db db) { this.db = db; }

    public void record(Connection c, String sku, String userId, String operation, String reason, int before, int after, LocalDateTime at) throws SQLException {
        JdbcRepository.update(c, "INSERT INTO lpa_stock_ledger (lpa_ledger_stock_ID, lpa_ledger_user_ID, lpa_ledger_operation, "
                + "lpa_ledger_reason, lpa_ledger_before, lpa_ledger_after, lpa_ledger_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                sku, userId, operation, reason.length() > 100 ? reason.substring(0, 100) : reason, before, after, Timestamp.valueOf(at));
    }

    public List<LedgerEntry> forSku(String sku) throws SQLException {
        return db.run(c -> {
            try (PreparedStatement ps = JdbcRepository.prepare(c, "SELECT l.lpa_ledger_stock_ID, s.lpa_stock_name, "
                    + "CONCAT(u.lpa_user_firstname, ' ', u.lpa_user_lastname, IF(u.lpa_user_group = 'customer', ' (web order)', '')), "
                    + "l.lpa_ledger_operation, l.lpa_ledger_reason, l.lpa_ledger_before, l.lpa_ledger_after, l.lpa_ledger_at "
                    + "FROM lpa_stock_ledger l JOIN lpa_stock s ON s.lpa_stock_ID = l.lpa_ledger_stock_ID "
                    + "JOIN lpa_users u ON u.lpa_user_ID = l.lpa_ledger_user_ID WHERE l.lpa_ledger_stock_ID = ? "
                    + "ORDER BY l.lpa_ledger_at DESC, l.lpa_ledger_ID DESC LIMIT 50", sku)) {
                try (ResultSet rs = ps.executeQuery()) {
                    List<LedgerEntry> out = new ArrayList<>();
                    while (rs.next()) out.add(new LedgerEntry(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                            rs.getInt(6), rs.getInt(7), rs.getTimestamp(8).toLocalDateTime()));
                    return out;
                }
            }
        });
    }
}
