package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.service.ServiceException;

import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import java.awt.Component;
import java.awt.Cursor;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.function.Consumer;

/**
 * Runs database work OFF the Swing event thread (SwingWorker), so the window never freezes while
 * MySQL answers (optimisation / responsiveness), then shows the result back on the event thread.
 * Errors become friendly messages: rule problems are listed; database problems never show SQL.
 */
public final class Async {

    @FunctionalInterface
    public interface Task<T> { T call() throws Exception; }

    private Async() { }

    public static <T> void run(Component owner, Task<T> task, Consumer<T> onDone) {
        run(owner, task, onDone, null);
    }

    public static <T> void run(Component owner, Task<T> task, Consumer<T> onDone, Runnable onFail) {
        Component root = owner == null ? null : SwingUtilities.getRoot(owner);
        if (root != null) root.setCursor(Cursor.getPredefinedCursor(Cursor.WAIT_CURSOR));
        new SwingWorker<T, Void>() {
            @Override protected T doInBackground() throws Exception { return task.call(); }

            @Override protected void done() {
                if (root != null) root.setCursor(Cursor.getDefaultCursor());
                try {
                    T value = get();
                    if (onDone != null) onDone.accept(value);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (ExecutionException e) {
                    showError(owner, e.getCause());
                    if (onFail != null) onFail.run();
                }
            }
        }.execute();
    }

    public static void showError(Component owner, Throwable t) {
        if (t instanceof ServiceException se) {
            Ui.errors(owner, "Please check", se.messages());
        } else if (t instanceof SQLException sql) {
            System.err.println("Database error " + sql.getSQLState() + " " + sql.getErrorCode() + ": " + sql.getMessage());
            String msg = isDown(sql) ? "The LPA database is not available at the moment. Check that MySQL is running and try again."
                    : sql.getErrorCode() == 1451 ? "This record is used by other records (invoices / history) and cannot be changed that way."
                    : "The database could not complete this request. Please try again.";
            Ui.errors(owner, "Database", List.of(msg));
        } else {
            t.printStackTrace();
            Ui.errors(owner, "Something went wrong", List.of("Sorry, something went wrong. Please try again."));
        }
    }

    static boolean isDown(SQLException e) {
        String state = e.getSQLState();
        return state != null && (state.startsWith("08") || "28000".equals(state) || "42000".equals(state) && e.getErrorCode() == 1049);
    }
}
