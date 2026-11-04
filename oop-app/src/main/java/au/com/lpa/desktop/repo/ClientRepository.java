package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.security.FieldCrypto;
import au.com.lpa.desktop.util.Db;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * Clients - table lpa_clients. Phone numbers are stored ENCRYPTED (AES-256-GCM, same format as
 * the web app): decrypted when read, encrypted + blind-indexed when saved, and searched by the
 * blind index (exact number).
 */
public class ClientRepository extends JdbcRepository<Client> {

    private final FieldCrypto crypto;

    public ClientRepository(Db db, FieldCrypto crypto) {
        super(db);
        this.crypto = crypto;
    }

    @Override protected String table() { return "lpa_clients"; }
    @Override protected String idColumn() { return "lpa_client_ID"; }
    @Override protected String statusColumn() { return "lpa_client_status"; }
    @Override protected String deletedCode() { return "d"; } // lpa_clients allows a / d only: "delete" = disable
    @Override protected String selectSql() {
        return "SELECT lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address, lpa_client_phone, lpa_client_status FROM lpa_clients";
    }
    @Override protected String searchExpression() { return "CONCAT_WS(' ', lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address)"; }

    @Override
    protected Client map(ResultSet rs) throws SQLException {
        Client c = new Client();
        c.setId(rs.getString(1));
        c.setFirstName(rs.getString(2));
        c.setLastName(rs.getString(3));
        c.setAddress(rs.getString(4));
        c.setPhone(crypto.open(rs.getString(5)));
        c.setStatus(RecordStatus.fromCode(rs.getString(6)));
        return c;
    }

    // findAll / findById come from JdbcRepository: clients are only ever disabled (d), never 'x', so they all show.

    /** Name / ID / address (LIKE) or exact phone number (blind index). */
    @Override
    public List<Client> search(String text) throws SQLException {
        if (text == null || text.isBlank()) return findAll();
        String digits = FieldCrypto.digits(text);
        String index = digits.length() >= 8 ? crypto.blindIndex(digits) : "-";
        return query(selectSql() + " WHERE " + searchExpression() + " LIKE ? OR lpa_client_phone_idx = ? ORDER BY lpa_client_ID", like(text), index);
    }

    @Override
    public Client save(Client c) throws SQLException {
        String phone = crypto.encrypt(c.getPhone());
        String index = crypto.blindIndex(FieldCrypto.digits(c.getPhone()));
        return db.transaction(conn -> {
            if (c.isNew()) {
                c.setId(nextId(conn, "CL-", 3));
                update(conn, "INSERT INTO lpa_clients (lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address, "
                        + "lpa_client_phone, lpa_client_phone_idx, lpa_client_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        c.getId(), c.getFirstName(), c.getLastName(), c.getAddress(), phone, index, c.getStatus() == RecordStatus.ACTIVE ? "a" : "d");
            } else {
                update(conn, "UPDATE lpa_clients SET lpa_client_firstname = ?, lpa_client_lastname = ?, lpa_client_address = ?, "
                        + "lpa_client_phone = ?, lpa_client_phone_idx = ?, lpa_client_status = ? WHERE lpa_client_ID = ?",
                        c.getFirstName(), c.getLastName(), c.getAddress(), phone, index, c.getStatus() == RecordStatus.ACTIVE ? "a" : "d", c.getId());
            }
            return c;
        });
    }
}
