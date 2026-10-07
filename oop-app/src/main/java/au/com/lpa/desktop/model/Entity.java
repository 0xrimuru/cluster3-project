package au.com.lpa.desktop.model;

import java.util.Objects;

/**
 * Base class of every record (encapsulation: fields are private, changed through methods).
 * @param <ID> type of the primary key (all LPA tables use text IDs such as LPA-001, CL-002, U-003)
 */
public abstract class Entity<ID> implements Validatable, Searchable {

    private ID id;
    private RecordStatus status = RecordStatus.ACTIVE;

    public ID getId() { return id; }
    public void setId(ID id) { this.id = id; }

    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = Objects.requireNonNull(status); }

    public boolean isActive() { return status == RecordStatus.ACTIVE; }
    public boolean isNew() { return id == null; }

    /** The name shown in lists and messages - each subclass decides (polymorphism). */
    public abstract String displayName();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Entity<?> other = (Entity<?>) o;
        return id != null && id.equals(other.id);
    }

    @Override public int hashCode() { return Objects.hashCode(id); }

    @Override public String toString() { return (id == null ? "(new)" : id) + " " + displayName(); }
}
