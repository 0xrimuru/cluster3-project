package au.com.lpa.desktop.model;

import java.util.List;
import java.util.regex.Pattern;

/** A client of LPA (lpa_clients). The phone number is decrypted by the repository. */
public class Client extends Person {

    public static final Pattern PHONE = Pattern.compile("^[0-9 ()+-]{8,20}$");

    private String address = "";
    private String phone = "";

    public String getAddress() { return address; }
    public void setAddress(String v) { this.address = v == null ? "" : v.trim(); }
    public String getPhone() { return phone; }
    public void setPhone(String v) { this.phone = v == null ? "" : v.trim(); }

    @Override
    public List<String> validate() {
        List<String> errors = super.validate();
        if (address.isEmpty()) errors.add("Address is required.");
        if (address.length() > 250) errors.add("Address must be 250 characters or fewer.");
        if (!PHONE.matcher(phone).matches()) errors.add("Enter a valid phone number (8-20 digits, spaces, brackets, + or -).");
        return errors;
    }

    @Override public String searchText() { return String.join(" ", String.valueOf(getId()), fullName(), address, phone).toLowerCase(); }
}
