package au.com.lpa.desktop.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** One line of an invoice (lpa_invoice_items) - an immutable value object (Java record). */
public record InvoiceLine(String sku, String name, int qty, BigDecimal price) {

    public InvoiceLine {
        if (qty < 1) throw new IllegalArgumentException("Quantity must be at least 1");
        price = price.setScale(2, RoundingMode.HALF_UP);
    }

    /** qty x price, rounded to cents. */
    public BigDecimal amount() { return price.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP); }

    public InvoiceLine withQty(int newQty) { return new InvoiceLine(sku, name, newQty, price); }
}
