package au.com.lpa.desktop.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** A stock item (lpa_stock). Money uses BigDecimal (exact cents, no floating-point rounding). */
public class Product extends Entity<String> {

    public static final Pattern STOCK_ID = Pattern.compile("^[A-Z0-9-]{3,20}$");
    public static final BigDecimal MAX_PRICE = new BigDecimal("99999.99");
    public static final int LOW_STOCK = 5;

    /** In / Low / Out badge, same rule as the web app. */
    public enum Level { IN, LOW, OUT }

    private String name = "";
    private String brand = "";
    private String category = "General";
    private String description = "";
    private String image = "/images/products/placeholder.png";
    private int onHand;
    private BigDecimal price = BigDecimal.ZERO;

    public String getName() { return name; }
    public void setName(String v) { this.name = v == null ? "" : v.trim(); }
    public String getBrand() { return brand; }
    public void setBrand(String v) { this.brand = v == null ? "" : v.trim(); }
    public String getCategory() { return category; }
    public void setCategory(String v) { this.category = v == null || v.isBlank() ? "General" : v.trim(); }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v == null ? "" : v; }
    public String getImage() { return image; }
    public void setImage(String v) { if (v != null && !v.isBlank()) this.image = v.trim(); }
    public int getOnHand() { return onHand; }
    public void setOnHand(int v) { this.onHand = v; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal v) { this.price = v == null ? BigDecimal.ZERO : v; }

    public Level level() { return onHand <= 0 ? Level.OUT : (onHand <= LOW_STOCK ? Level.LOW : Level.IN); }

    @Override public String displayName() { return name; }

    @Override
    public List<String> validate() {
        List<String> errors = new ArrayList<>();
        if (getId() != null && !STOCK_ID.matcher(getId()).matches()) errors.add("Stock ID may only use letters, numbers and dashes (3-20 characters).");
        if (name.isEmpty()) errors.add("Product name is required.");
        if (name.length() > 250) errors.add("Product name must be 250 characters or fewer.");
        if (brand.isEmpty()) errors.add("Brand is required.");
        if (brand.length() > 100) errors.add("Brand must be 100 characters or fewer.");
        if (category.length() > 50) errors.add("Category must be 50 characters or fewer.");
        if (price.signum() < 0 || price.compareTo(MAX_PRICE) > 0) errors.add("Price must be from 0 to " + MAX_PRICE + ".");
        if (price.scale() > 2 && price.stripTrailingZeros().scale() > 2) errors.add("Price can have at most 2 decimal places.");
        if (onHand < 0) errors.add("On-hand quantity must be 0 or more.");
        return errors;
    }

    @Override public String searchText() { return String.join(" ", String.valueOf(getId()), name, brand, category).toLowerCase(); }
}
