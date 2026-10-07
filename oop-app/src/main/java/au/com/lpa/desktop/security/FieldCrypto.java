package au.com.lpa.desktop.security;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Field encryption compatible with the web app (app/Security/crypto.js):
 *  - AES-256-GCM, random 12-byte IV, 16-byte authentication tag, text format
 *    "v1.&lt;iv&gt;.&lt;tag&gt;.&lt;ciphertext&gt;" (base64url parts). Used for client phone numbers.
 *  - blind index: HMAC-SHA256 with a key derived from the same DATA_KEY by HKDF-SHA256
 *    (info "lpa-blind-index-v1"), so the desktop app can search phone numbers too.
 * Only Java's built-in javax.crypto is used here.
 */
public final class FieldCrypto {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();
    private final SecretKeySpec key;
    private final byte[] indexKey;

    public FieldCrypto(String base64Key) {
        byte[] raw = Base64.getDecoder().decode(base64Key);
        if (raw.length != 32) throw new IllegalArgumentException("DATA_KEY must be 32 bytes (base64)");
        this.key = new SecretKeySpec(raw, "AES");
        this.indexKey = hkdfSha256(raw, "lpa-blind-index-v1".getBytes(StandardCharsets.UTF_8));
    }

    public static boolean isEncrypted(String v) {
        return v != null && v.matches("^v1\\.[\\w-]+\\.[\\w-]+\\.[\\w-]+$");
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isEmpty()) return null;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] out = c.doFinal(plain.getBytes(StandardCharsets.UTF_8)); // ciphertext + tag
            byte[] ct = Arrays.copyOfRange(out, 0, out.length - 16);
            byte[] tag = Arrays.copyOfRange(out, out.length - 16, out.length);
            return "v1." + B64.encodeToString(iv) + "." + B64.encodeToString(tag) + "." + B64.encodeToString(ct);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    /** Decrypts; throws if the value was changed (GCM tag check) or the key is wrong. */
    public String decrypt(String token) {
        if (token == null || token.isEmpty()) return null;
        String[] p = token.split("\\.");
        if (p.length != 4 || !"v1".equals(p[0])) throw new IllegalArgumentException("Not an encrypted value");
        try {
            byte[] iv = D64.decode(p[1]), tag = D64.decode(p[2]), ct = D64.decode(p[3]);
            byte[] in = new byte[ct.length + tag.length];
            System.arraycopy(ct, 0, in, 0, ct.length);
            System.arraycopy(tag, 0, in, ct.length, tag.length);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(c.doFinal(in), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new SecurityException("Value cannot be decrypted (changed or wrong key)", e);
        }
    }

    /** Shows a stored phone value: decrypted, or as-is if it was never encrypted. */
    public String open(String stored) {
        if (!isEncrypted(stored)) return stored;
        try {
            return decrypt(stored);
        } catch (RuntimeException e) {
            return "(cannot decrypt)";
        }
    }

    /** Exact-match search key for an encrypted column (same result as the web app). */
    public String blindIndex(String value) {
        if (value == null || value.isEmpty()) return null;
        return HexFormat.of().formatHex(hmac(indexKey, value.getBytes(StandardCharsets.UTF_8)));
    }

    public static String digits(String s) { return s == null ? "" : s.replaceAll("\\D", ""); }

    // RFC 5869 HKDF with an empty salt and a 32-byte output (one expand block).
    static byte[] hkdfSha256(byte[] ikm, byte[] info) {
        byte[] prk = hmac(new byte[32], ikm);
        byte[] in = Arrays.copyOf(info, info.length + 1);
        in[info.length] = 1;
        return hmac(prk, in);
    }

    private static byte[] hmac(byte[] k, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(k.length == 0 ? new byte[32] : k, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
