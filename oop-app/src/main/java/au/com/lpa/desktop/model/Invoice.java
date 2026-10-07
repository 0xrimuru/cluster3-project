package au.com.lpa.desktop.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A sales invoice (lpa_invoices) with its lines. The total is always worked out from the lines. */
public class Invoice extends Entity<String> {

    private LocalDate date = LocalDate.now();
    private String clientId = "";
    private String clientName = "";
    private String clientAddress = "";
    private String payment = "Account";
    private BigDecimal storedAmount;            // lpa_inv_amount, when loaded from the database
    private final List<InvoiceLine> lines = new ArrayList<>();

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate d) { this.date = d; }
    public String getClientId() { return clientId; }
    public void setClientId(String v) { this.clientId = v; }
    public String getClientName() { return clientName; }
    public void setClientName(String v) { this.clientName = v; }
    public String getClientAddress() { return clientAddress; }
    public void setClientAddress(String v) { this.clientAddress = v; }
    public String getPayment() { return payment; }
    public void setPayment(String v) { this.payment = v; }
    public void setStoredAmount(BigDecimal v) { this.storedAmount = v; }

    public List<InvoiceLine> getLines() { return Collections.unmodifiableList(lines); }

    /** Adds a line; the same item twice is merged into one line. */
    public void addLine(InvoiceLine line) {
        for (int i = 0; i < lines.size(); i++) {
            if (lines.get(i).sku().equals(line.sku())) {
                lines.set(i, lines.get(i).withQty(lines.get(i).qty() + line.qty()));
                return;
            }
        }
        lines.add(line);
    }

    public void removeLine(String sku) { lines.removeIf(l -> l.sku().equals(sku)); }

    public int units() { return lines.stream().mapToInt(InvoiceLine::qty).sum(); }

    /** Total of the lines; for a list loaded without lines, the amount stored on the invoice. */
    public BigDecimal total() {
        if (lines.isEmpty() && storedAmount != null) return storedAmount;
        return lines.stream().map(InvoiceLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** GST included in the total (1/11 in Australia). */
    public BigDecimal gst() { return total().divide(BigDecimal.valueOf(11), 2, java.math.RoundingMode.HALF_UP); }

    @Override public String displayName() { return clientName; }

    @Override
    public List<String> validate() {
        List<String> errors = new ArrayList<>();
        if (clientId == null || clientId.isBlank()) errors.add("Search and select a client first.");
        if (lines.isEmpty()) errors.add("Add at least one stock item.");
        if (date == null) errors.add("Date is required.");
        else if (date.isAfter(LocalDate.now())) errors.add("The invoice date cannot be in the future.");
        return errors;
    }

    @Override public String searchText() { return String.join(" ", String.valueOf(getId()), clientId, clientName, clientAddress, String.valueOf(date)).toLowerCase(); }
}
