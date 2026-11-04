package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.Entity;
import au.com.lpa.desktop.util.Db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The shared JDBC code for every repository (template method pattern): subclasses only say
 * which table and columns they use and how to turn a row into an object.
 * Every statement is a PreparedStatement with ? placeholders - typed text can never change the SQL
 * (the original LPA desktop sample built SQL by joining strings, which allowed SQL injection).
 */
public abstract class JdbcRepository<T extends Entity<String>> implements Repository<T, String> {

    protected final Db db;

    protected JdbcRepository(Db db) { this.db = db; }

    // ---- what each subclass provides ----
    protected abstract String table();
    protected abstract String idColumn();
    protected abstract String statusColumn();
    /** SELECT ... FROM ... (no WHERE) */
    protected abstract String selectSql();
    /** SQL expression searched with LIKE ? */
    protected abstract String searchExpression();
    protected abstract T map(ResultSet rs) throws SQLException;
    /** Status code used for a (soft) delete: 'x', or 'd' where the table has no 'x'. */
    protected String deletedCode() { return "x"; }
    protected String orderBy() { return idColumn(); }

    @Override
    public List<T> findAll() throws SQLException {
        return query(selectSql() + " WHERE " + statusColumn() + " <> 'x' ORDER BY " + orderBy());
    }

    @Override
    public Optional<T> findById(String id) throws SQLException {
        if (id == null || id.isBlank()) return Optional.empty();
        List<T> rows = query(selectSql() + " WHERE " + idColumn() + " = ? AND " + statusColumn() + " <> 'x'", id.trim().toUpperCase());
        return rows.stream().findFirst();
    }

    @Override
    public List<T> search(String text) throws SQLException {
        if (text == null || text.isBlank()) return findAll();
        return query(selectSql() + " WHERE " + statusColumn() + " <> 'x' AND " + searchExpression() + " LIKE ? ORDER BY " + orderBy(), like(text));
    }

    /** Soft delete: the row stays (invoices and the audit history still point to it). */
    @Override
    public boolean delete(String id) throws SQLException {
        return update("UPDATE " + table() + " SET " + statusColumn() + " = ? WHERE " + idColumn() + " = ? AND " + statusColumn() + " <> ?",
                deletedCode(), id, deletedCode()) == 1;
    }

    // ---- helpers for subclasses ----
    protected List<T> query(String sql, Object... params) throws SQLException {
        return db.run(c -> query(c, sql, params));
    }

    protected List<T> query(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = prepare(c, sql, params); ResultSet rs = ps.executeQuery()) {
            List<T> out = new ArrayList<>();
            while (rs.next()) out.add(map(rs));
            return out;
        }
    }

    protected int update(String sql, Object... params) throws SQLException {
        return db.run(c -> update(c, sql, params));
    }

    protected static int update(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = prepare(c, sql, params)) {
            return ps.executeUpdate();
        }
    }

    protected static PreparedStatement prepare(Connection c, String sql, Object... params) throws SQLException {
        PreparedStatement ps = c.prepareStatement(sql);
        for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
        return ps;
    }

    /** Next text ID such as LPA-009 / CL-007 / U-004 (largest number + 1). */
    protected String nextId(Connection c, String prefix, int width) throws SQLException {
        String sql = "SELECT COALESCE(MAX(CAST(SUBSTRING(" + idColumn() + ", ?) AS UNSIGNED)), 0) + 1 FROM " + table()
                + " WHERE " + idColumn() + " REGEXP ? FOR UPDATE"; // lock: two saves at once never get the same ID
        try (PreparedStatement ps = prepare(c, sql, prefix.length() + 1, "^" + prefix + "[0-9]+$"); ResultSet rs = ps.executeQuery()) {
            rs.next();
            return prefix + String.format("%0" + width + "d", rs.getLong(1));
        }
    }

    /** Search text for LIKE, with % and _ treated as normal characters. */
    protected static String like(String text) {
        return "%" + text.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
