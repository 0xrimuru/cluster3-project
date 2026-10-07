package au.com.lpa.desktop.model;

import java.util.List;

/** Anything that can check its own data before it is saved. */
public interface Validatable {
    /** @return the problems found (empty when the object is valid) */
    List<String> validate();

    default boolean isValid() { return validate().isEmpty(); }
}
