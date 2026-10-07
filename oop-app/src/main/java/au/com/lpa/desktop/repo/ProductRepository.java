package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.util.Db;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/** Stock items - table lpa_stock. */
public class ProductRepository extends JdbcRepository<Product> {

    public ProductRepository(Db db) { super(db); }

    @Override protected String table() { return "lpa_stock"; }
    @Override protected String idColumn() { return "lpa_stock_ID"; }
    @Override protected String statusColumn() { return "lpa_stock_status"; }
    @Override protected String selectSql() {
        return "SELECT lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category, lpa_stock_desc, lpa_stock_image, "
                + "lpa_stock_onhand, lpa_stock_price, lpa_stock_status FROM lpa_stock";
    }
    @Override protected String searchExpression() { return "CONCAT_WS(' ', lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category)"; }

    @Override
    protected Product map(ResultSet rs) throws SQLException {
        Product p = new Product();
        p.setId(rs.getString(1));
        p.setName(rs.getString(2));
        p.setBrand(rs.getString(3));
        p.setCategory(rs.getString(4));
        p.setDescription(rs.getString(5));
        p.setImage(rs.getString(6));
        p.setOnHand(rs.getInt(7));
        p.setPrice(rs.getBigDecimal(8));
        p.setStatus(RecordStatus.fromCode(rs.getString(9)));
        return p;
    }

    /** INSERT (new item, next LPA-### if no Stock ID given) or UPDATE (existing item). */
    @Override
    public Product save(Product p) throws SQLException {
        return db.run(c -> {
            boolean exists = p.getId() != null && !query(c, selectSql() + " WHERE lpa_stock_ID = ?", p.getId()).isEmpty();
            if (exists) {
                update(c, "UPDATE lpa_stock SET lpa_stock_name = ?, lpa_stock_brand = ?, lpa_stock_category = ?, lpa_stock_desc = ?, "
                        + "lpa_stock_image = ?, lpa_stock_onhand = ?, lpa_stock_price = ?, lpa_stock_status = ? WHERE lpa_stock_ID = ?",
                        p.getName(), p.getBrand(), p.getCategory(), p.getDescription(), p.getImage(), p.getOnHand(), p.getPrice(),
                        p.getStatus().code(), p.getId());
            } else {
                if (p.getId() == null || p.getId().isBlank()) p.setId(nextId(c, "LPA-", 3));
                update(c, "INSERT INTO lpa_stock (lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category, lpa_stock_desc, "
                        + "lpa_stock_image, lpa_stock_onhand, lpa_stock_price, lpa_stock_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        p.getId(), p.getName(), p.getBrand(), p.getCategory(), p.getDescription(), p.getImage(), p.getOnHand(),
                        p.getPrice(), p.getStatus().code());
            }
            return p;
        });
    }

    /** Does a row (even a deleted one) already use this Stock ID? */
    public boolean idTaken(String id) throws SQLException {
        return !query(selectSql() + " WHERE lpa_stock_ID = ?", id).isEmpty();
    }

    /** SELECT ... FOR UPDATE inside a transaction: locks the row so two sales cannot take the same stock. */
    public Optional<Product> lock(Connection c, String sku) throws SQLException {
        return query(c, selectSql() + " WHERE lpa_stock_ID = ? FOR UPDATE", sku).stream().findFirst();
    }

    public void setOnHand(Connection c, String sku, int qty) throws SQLException {
        update(c, "UPDATE lpa_stock SET lpa_stock_onhand = ? WHERE lpa_stock_ID = ?", qty, sku);
    }

    /** Distinct categories (for the form's drop-down). */
    public List<String> categories() throws SQLException {
        return db.run(c -> {
            try (var ps = c.prepareStatement("SELECT DISTINCT lpa_stock_category FROM lpa_stock WHERE lpa_stock_status <> 'x' ORDER BY 1");
                 var rs = ps.executeQuery()) {
                List<String> out = new java.util.ArrayList<>();
                while (rs.next()) out.add(rs.getString(1));
                return out;
            }
        });
    }
}
