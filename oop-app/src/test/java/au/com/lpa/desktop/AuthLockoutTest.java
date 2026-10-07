package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import au.com.lpa.desktop.repo.UserRepository;
import au.com.lpa.desktop.security.Policy;
import au.com.lpa.desktop.service.AuthService;
import au.com.lpa.desktop.service.ServiceException;
import au.com.lpa.desktop.service.Session;
import au.com.lpa.desktop.util.Db;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** Sign-in rules without a database: a fake repository (subclass) and a clock the test controls. */
class AuthLockoutTest {

    /** Test double: overrides the database call (polymorphism). */
    static class FakeUsers extends UserRepository {
        FakeUsers() { super(new Db(AppConfig.of(Map.of()))); }
        @Override public Optional<Credentials> credentials(String username) {
            User u = new User();
            u.setId("U-002"); u.setUsername(username); u.setFirstName("Michael"); u.setLastName("Chang"); u.setStatus(RecordStatus.ACTIVE);
            u.setGroup("aturner".equals(username) ? UserGroup.CUSTOMER : UserGroup.USER);
            return "mchang".equals(username) || "aturner".equals(username) ? Optional.of(new Credentials(u, SecurityCompatibilityTest.NODE_HASH)) : Optional.empty();
        }
    }

    /** A clock that the test moves forward. */
    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-07T00:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId z) { return this; }
        @Override public Instant instant() { return now; }
    }

    static AuthService service(Session s, Clock clock) throws Exception {
        Constructor<AuthService> c = AuthService.class.getDeclaredConstructor(UserRepository.class, Session.class, Clock.class);
        c.setAccessible(true);
        return c.newInstance(new FakeUsers(), s, clock);
    }

    @Test @DisplayName("T-20 Lockout after 5 wrong passwords; the right password is refused until 15 minutes pass")
    void lockout() throws Exception {
        TestClock clock = new TestClock();
        Session s = new Session(Policy.load(null));
        AuthService auth = service(s, clock);
        for (int i = 0; i < 5; i++) {
            ServiceException e = assertThrows(ServiceException.class, () -> auth.login("mchang", "wrong-pass1"));
            assertTrue(e.getMessage().startsWith("Login failed"));
        }
        ServiceException locked = assertThrows(ServiceException.class, () -> auth.login("mchang", "Lpa#2026"));
        assertEquals("Too many failed sign-ins. Try again in 15 minutes.", locked.getMessage());
        clock.now = clock.now.plusSeconds(15 * 60 + 1);
        assertEquals("U-002", auth.login("mchang", "Lpa#2026").getId());
        assertTrue(s.signedIn());
    }

    @Test @DisplayName("T-21 Customers cannot use the desktop app; unknown user = same message as wrong password")
    void customersAndUnknown() throws Exception {
        Session s = new Session(Policy.load(null));
        AuthService auth = service(s, new TestClock());
        ServiceException cust = assertThrows(ServiceException.class, () -> auth.login("aturner", "Lpa#2026"));
        assertTrue(cust.getMessage().contains("Customers use the web store"));
        assertFalse(s.signedIn());
        ServiceException unknown = assertThrows(ServiceException.class, () -> auth.login("nobody", "Lpa#2026"));
        ServiceException wrong = assertThrows(ServiceException.class, () -> auth.login("mchang", "Wrong#2026"));
        assertEquals(wrong.getMessage(), unknown.getMessage());
    }
}
