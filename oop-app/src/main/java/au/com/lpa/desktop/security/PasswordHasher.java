package au.com.lpa.desktop.security;

import org.bouncycastle.crypto.generators.SCrypt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * scrypt password hashing in the SAME format as the web app (app/Models/User.js):
 *   scrypt$&lt;salt as 32 hex characters&gt;$&lt;64-byte hash as hex&gt;   (N=16384, r=8, p=1)
 * so a user can sign in to either app with the same password, and the desktop app can change
 * a password that the web app will accept. Uses the Bouncy Castle library (third party).
 */
public final class PasswordHasher {

    private static final int N = 16384, R = 8, P = 1, KEY_LENGTH = 64;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    private PasswordHasher() { }

    public static String hash(String plain) {
        byte[] saltBytes = new byte[16];
        RANDOM.nextBytes(saltBytes);
        String salt = HEX.formatHex(saltBytes);
        return "scrypt$" + salt + "$" + HEX.formatHex(derive(plain, salt));
    }

    /** true when the password matches the stored hash (constant-time comparison). */
    public static boolean verify(String plain, String stored) {
        if (plain == null || stored == null) return false;
        String[] parts = stored.split("\\$");
        if (parts.length != 3 || !"scrypt".equals(parts[0]) || parts[1].isEmpty() || parts[2].isEmpty()) return false;
        byte[] known;
        try {
            known = HEX.parseHex(parts[2]);
        } catch (IllegalArgumentException e) {
            return false;
        }
        byte[] test = derive(plain, parts[1]);
        return MessageDigest.isEqual(known, test);
    }

    // Node's crypto.scryptSync(password, salt) uses the salt TEXT (the hex string) as its bytes.
    private static byte[] derive(String plain, String saltText) {
        return SCrypt.generate(plain.getBytes(StandardCharsets.UTF_8), saltText.getBytes(StandardCharsets.UTF_8), N, R, P, KEY_LENGTH);
    }
}
