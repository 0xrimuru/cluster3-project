package au.com.lpa.desktop.repo;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Generic data access for one kind of record (the "M" of MVC talks to the database only here).
 * @param <T>  record type
 * @param <ID> primary key type
 */
public interface Repository<T, ID> {
    List<T> findAll() throws SQLException;
    Optional<T> findById(ID id) throws SQLException;
    List<T> search(String text) throws SQLException;
    T save(T item) throws SQLException;
    boolean delete(ID id) throws SQLException;
}
