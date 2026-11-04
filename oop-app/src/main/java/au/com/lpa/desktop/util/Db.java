package au.com.lpa.desktop.util;

import au.com.lpa.desktop.config.AppConfig;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

/**
 * A small connection pool for the MySQL / MariaDB database (optimisation: opening a database
 * connection takes much longer than running a query, so up to {@code MAX_IDLE} connections are
 * kept open and reused). Each unit of work borrows a connection and gives it back.
 * Only PreparedStatements are used with these connections (no SQL injection).
 */
public final class Db implements AutoCloseable {

    /** One piece of database work that returns a value. */
    @FunctionalInterface
    public interface Work<T> {
        T run(Connection c) throws SQLException;
    }

    private static final int MAX_IDLE = 4;
    private final BlockingQueue<Connection> idle = new ArrayBlockingQueue<>(MAX_IDLE);
    private final String url;
    private final String user;
    private final String password;
    private volatile int opened;

    public Db(AppConfig config) {
        this.url = config.dbUrl();
        this.user = config.dbUser();
        this.password = config.dbPassword();
    }

    private Connection borrow() throws SQLException {
        Connection c;
        while ((c = idle.poll()) != null) {
            if (c.isValid(2)) return c;
            quietClose(c); // the server closed it (timeout / restart): open a new one
        }
        opened++;
        return DriverManager.getConnection(url, user, password);
    }

    private void giveBack(Connection c) {
        try {
            if (c.isClosed()) return;
            if (!c.getAutoCommit()) { c.rollback(); c.setAutoCommit(true); }
            if (!idle.offer(c)) c.close();
        } catch (SQLException e) {
            quietClose(c);
        }
    }

    /** Runs work with auto-commit (one statement = one transaction). */
    public <T> T run(Work<T> work) throws SQLException {
        Connection c = borrow();
        try {
            return work.run(c);
        } finally {
            giveBack(c);
        }
    }

    /** Runs work as ONE transaction: COMMIT if it finishes, ROLLBACK if it throws. */
    public <T> T transaction(Work<T> work) throws SQLException {
        Connection c = borrow();
        try {
            c.setAutoCommit(false);
            T result = work.run(c);
            c.commit();
            return result;
        } catch (SQLException | RuntimeException e) {
            try { c.rollback(); } catch (SQLException ignored) { /* connection lost */ }
            throw e;
        } finally {
            giveBack(c); // rolls back anything not committed (even after an Error), then auto-commit on

        }
    }

    /** How many physical connections were opened (used by the optimisation test). */
    public int connectionsOpened() { return opened; }

    private static void quietClose(Connection c) {
        try { c.close(); } catch (SQLException ignored) { /* already closed */ }
    }

    @Override
    public void close() {
        Connection c;
        while ((c = idle.poll()) != null) quietClose(c);
    }
}
