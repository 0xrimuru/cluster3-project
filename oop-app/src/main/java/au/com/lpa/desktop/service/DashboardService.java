package au.com.lpa.desktop.service;

import au.com.lpa.desktop.util.Db;

import java.math.BigDecimal;
import java.sql.SQLException;

/** The numbers on the home screen - worked out by the database (COUNT / SUM). */
public class DashboardService {

    public record Stats(int items, int lowStock, int outOfStock, int invoices, BigDecimal sales) { }

    private final Db db;

    public DashboardService(Db db) { this.db = db; }

    public Stats stats() throws SQLException {
        return db.run(c -> {
            try (var ps = c.prepareStatement("SELECT (SELECT COUNT(*) FROM lpa_stock WHERE lpa_stock_status <> 'x'), "
                    + "(SELECT COUNT(*) FROM lpa_stock WHERE lpa_stock_status <> 'x' AND lpa_stock_onhand BETWEEN 1 AND 5), "
                    + "(SELECT COUNT(*) FROM lpa_stock WHERE lpa_stock_status <> 'x' AND lpa_stock_onhand = 0), "
                    + "(SELECT COUNT(*) FROM lpa_invoices WHERE lpa_inv_status = 'a'), "
                    + "(SELECT COALESCE(SUM(lpa_inv_amount), 0) FROM lpa_invoices WHERE lpa_inv_status = 'a')");
                 var rs = ps.executeQuery()) {
                rs.next();
                return new Stats(rs.getInt(1), rs.getInt(2), rs.getInt(3), rs.getInt(4), rs.getBigDecimal(5));
            }
        });
    }
}
