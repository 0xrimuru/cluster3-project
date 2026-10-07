package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.security.Policy;

/** Who is signed in to this copy of the desktop app, and what they may do. */
public class Session {

    private final Policy policy;
    private User user;

    public Session(Policy policy) { this.policy = policy; }

    /**
     * A COPY of the signed-in user: a screen that edits the object it gets back cannot change
     * who is signed in or their permissions (defensive copy - bug found by test I-10).
     */
    public User user() { return user == null ? null : user.copy(); }
    public boolean signedIn() { return user != null; }
    void start(User u) { this.user = u; }
    public void end() { this.user = null; }

    /** Asks the access policy (deny by default). */
    public boolean can(String permission) { return policy.can(user, permission); }

    /** Throws when the signed-in user does not hold the permission (checked again in every service). */
    public void require(String permission) throws ServiceException {
        if (!can(permission)) throw new ServiceException("Your account does not have permission for this (" + permission + ").");
    }

    public Policy policy() { return policy; }
}
