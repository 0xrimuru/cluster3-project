package au.com.lpa.desktop;

import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Entity;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Classes, inheritance, encapsulation and validation rules of the domain model. */
class ModelTest {

    static Product product(String id, String price, int qty) {
        Product p = new Product();
        p.setId(id); p.setName("Item " + id); p.setBrand("Vertex"); p.setPrice(new BigDecimal(price)); p.setOnHand(qty);
        return p;
    }

    @Test @DisplayName("T-07 Product validation: name, brand, price range, Stock ID format")
    void productRules() {
        assertTrue(product("LPA-050", "19.95", 3).isValid());
        Product bad = product("LPA 0;1", "-5", -1);
        bad.setName(""); bad.setBrand("");
        List<String> e = bad.validate();
        assertEquals(5, e.size(), e.toString()); // Stock ID, name, brand, price, on hand
        assertTrue(product("LPA-051", "100000", 1).validate().get(0).startsWith("Price"));
    }

    @Test @DisplayName("T-08 Stock level badge: out (0), low (1-5), in (6+)")
    void stockLevel() {
        assertEquals(Product.Level.OUT, product("A-1", "1", 0).level());
        assertEquals(Product.Level.LOW, product("A-1", "1", 5).level());
        assertEquals(Product.Level.IN, product("A-1", "1", 6).level());
    }

    @Test @DisplayName("T-09 Person rules are inherited by Client and User (+ their own rules)")
    void inheritance() {
        Client c = new Client();
        c.setFirstName(""); c.setLastName("Turner"); c.setAddress(""); c.setPhone("12");
        assertEquals(List.of("First name is required.", "Address is required.", "Enter a valid phone number (8-20 digits, spaces, brackets, + or -)."), c.validate());
        User u = new User();
        u.setUsername("Bad Name!"); u.setFirstName("Alex"); u.setLastName("");
        List<String> ue = u.validate();
        assertTrue(ue.get(0).startsWith("User name must be"));
        assertTrue(ue.contains("Last name is required."));
        u.setUsername("  ATurner ");
        assertEquals("aturner", u.getUsername()); // encapsulation: the setter cleans the value
    }

    @Test @DisplayName("T-10 Polymorphism: every Entity answers displayName() its own way")
    void polymorphism() {
        Client c = new Client(); c.setFirstName("DevWorks"); c.setLastName("Pty Ltd");
        Invoice i = new Invoice(); i.setClientName("Northgate High School");
        List<Entity<String>> all = List.of(product("LPA-001", "89", 1), c, i);
        assertEquals(List.of("Item LPA-001", "DevWorks Pty Ltd", "Northgate High School"), all.stream().map(Entity::displayName).toList());
    }

    @Test @DisplayName("T-11 Invoice lines: amounts in exact cents, same item merged, GST = total / 11")
    void invoiceMaths() {
        Invoice inv = new Invoice();
        inv.addLine(new InvoiceLine("LPA-002", "Mouse", 3, new BigDecimal("39.5")));
        inv.addLine(new InvoiceLine("LPA-002", "Mouse", 1, new BigDecimal("39.5")));
        inv.addLine(new InvoiceLine("LPA-008", "Cable", 3, new BigDecimal("0.1")));
        assertEquals(2, inv.getLines().size());
        assertEquals(4, inv.getLines().get(0).qty());
        assertEquals(new BigDecimal("158.30"), inv.total()); // 0.1 x 3 is exactly 0.30 (no floating-point error)
        assertEquals(new BigDecimal("14.39"), inv.gst());
        assertEquals(7, inv.units());
        assertThrows(IllegalArgumentException.class, () -> new InvoiceLine("X", "X", 0, BigDecimal.ONE));
        assertThrows(UnsupportedOperationException.class, () -> inv.getLines().clear()); // encapsulation
    }

    @Test @DisplayName("T-12 Invoice validation: client, at least one line, no future date")
    void invoiceRules() {
        Invoice inv = new Invoice();
        inv.setDate(LocalDate.now().plusDays(2));
        assertEquals(3, inv.validate().size());
    }

    @Test @DisplayName("T-13 Searchable: every word must match")
    void search() {
        Product p = product("LPA-001", "89", 1);
        p.setName("Mechanical Keyboard MK-87"); p.setCategory("Keyboards");
        assertTrue(p.matches("keyboard vertex"));
        assertFalse(p.matches("keyboard orbit"));
        assertTrue(p.matches(""));
    }

    @Test @DisplayName("T-14 Status codes and user groups map to the database values")
    void enums() {
        assertEquals(RecordStatus.DELETED, RecordStatus.fromCode("x"));
        assertEquals("d", RecordStatus.DISABLED.code());
        assertEquals(UserGroup.USER, UserGroup.fromDb("user"));
        assertEquals("Staff", UserGroup.USER.label());
    }
}
