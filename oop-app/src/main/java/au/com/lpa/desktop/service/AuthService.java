package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.repo.UserRepository;
import au.com.lpa.desktop.security.PasswordHasher;

import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Signing in to the desktop app.
 * - Passwords are checked against the same scrypt hashes the web app uses.
 * - Brute force: 5 wrong passwords for a user name in 15 minutes lock that name for the rest of
 *   the 15 minutes (same rule as the web app).
 * - A wrong user name costs the same time as a wrong password (dummy hash), so user names
 *   cannot be discovered by timing.
 * - Only groups with the "stock.view" permission (staff, administrators) may use the desktop app.
 */
public class AuthService {

    public static final int MAX_FAILURES = 5;
    public static final Duration WINDOW = Duration.ofMinutes(15);
    private static final String DUMMY_HASH = PasswordHasher.hash("not-a-real-password-" + System.nanoTime());

    private final UserRepository users;
    private final Session session;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new HashMap<>();

    public AuthService(UserRepository users, Session session) { this(users, session, Clock.systemUTC()); }

    AuthService(UserRepository users, Session session, Clock clock) {
        this.users = users;
        this.session = session;
        this.clock = clock;
    }

    public User login(String username, String password) throws ServiceException, SQLException {
        String name = username == null ? "" : username.trim().toLowerCase();
        if (name.isEmpty() || password == null || password.isEmpty()) throw new ServiceException("Please enter a username and password.");
        long minutes = lockedMinutes(name);
        if (minutes > 0) throw new ServiceException("Too many failed sign-ins. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");

        Optional<UserRepository.Credentials> found = users.credentials(name);
        boolean ok = PasswordHasher.verify(password, found.map(UserRepository.Credentials::passwordHash).orElse(DUMMY_HASH));
        if (found.isEmpty() || !ok) {
            fail(name);
            throw new ServiceException("Login failed: wrong username or password, or the account is inactive.");
        }
        failures.remove(name);
        User user = found.get().user();
        session.start(user);
        if (!session.can("stock.view")) {
            session.end();
            throw new ServiceException("The desktop app is for LPA staff. Customers use the web store.");
        }
        return user;
    }

    public void logout() { session.end(); }

    private synchronized void fail(String name) {
        failures.computeIfAbsent(name, k -> new ArrayDeque<>()).addLast(clock.instant());
    }

    /** Minutes until the user name may try again (0 = not locked). */
    synchronized long lockedMinutes(String name) {
        Deque<Instant> list = failures.get(name);
        if (list == null) return 0;
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!list.isEmpty() && list.peekFirst().isBefore(cutoff)) list.pollFirst(); // forget old failures
        if (list.size() < MAX_FAILURES) return 0;
        Instant freeAt = list.peekLast().plus(WINDOW);
        return Math.max(1, (Duration.between(clock.instant(), freeAt).toSeconds() + 59) / 60);
    }
}
