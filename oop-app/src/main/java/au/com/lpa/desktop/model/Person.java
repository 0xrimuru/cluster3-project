package au.com.lpa.desktop.model;

import java.util.ArrayList;
import java.util.List;

/** A person with a first and last name - shared by {@link User} and {@link Client} (inheritance). */
public abstract class Person extends Entity<String> {

    private String firstName = "";
    private String lastName = "";

    public String getFirstName() { return firstName; }
    public void setFirstName(String v) { this.firstName = v == null ? "" : v.trim(); }
    public String getLastName() { return lastName; }
    public void setLastName(String v) { this.lastName = v == null ? "" : v.trim(); }

    public String fullName() { return (firstName + " " + lastName).trim(); }

    @Override public String displayName() { return fullName(); }

    /** Checks shared by every person; subclasses add their own (super.validate()). */
    @Override
    public List<String> validate() {
        List<String> errors = new ArrayList<>();
        if (firstName.isEmpty()) errors.add("First name is required.");
        if (lastName.isEmpty()) errors.add("Last name is required.");
        if (firstName.length() > 50 || lastName.length() > 50) errors.add("First and last name must be 50 characters or fewer.");
        return errors;
    }
}
