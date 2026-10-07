package au.com.lpa.desktop;

import au.com.lpa.desktop.security.FieldCrypto;
import au.com.lpa.desktop.security.PasswordHasher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** The desktop app must read and write the SAME hashes and ciphertexts as the web app (Node.js). */
class SecurityCompatibilityTest {

    // made by the web app (db/seed.sql): palvim / Lpa#2026
    static final String NODE_HASH = "scrypt$70806fcddee2ee3e1cd7156ec9930438$929687f4f32802ab14ae9b57a85491c2989e9203f058bcbaf9b7fd9329b852786ee061ec1e93a5b13d2cb8737869c01c6915cfbc641c2895e0af4c53854cdcbf";
    // made by app/Security/crypto.js with this test key
    static final String TEST_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    static final String NODE_CIPHERTEXT = "v1.zldVYylPjFdW-Ys_.idtLnyF6To_-yuCMUd66jA.JwZQfUf3qSuROAJANtk";
    static final String NODE_INDEX = "f92e01afa23208fe5a7e3c4ed58d3f1e4ce32ad31c4fc6a41ac916e5a09ede59";

    @Test @DisplayName("T-01 Java verifies a password hash made by the web app")
    void verifiesNodeHash() {
        assertTrue(PasswordHasher.verify("Lpa#2026", NODE_HASH));
        assertFalse(PasswordHasher.verify("lpa#2026", NODE_HASH));
        assertFalse(PasswordHasher.verify("Lpa#2026", "scrypt$broken"));
        assertFalse(PasswordHasher.verify("Lpa#2026", "md5$abc$def"));
    }

    @Test @DisplayName("T-02 Java hashes are salted (different every time) and verify")
    void hashRoundTrip() {
        String a = PasswordHasher.hash("Peripheral#77"), b = PasswordHasher.hash("Peripheral#77");
        assertNotEquals(a, b);
        assertTrue(a.matches("^scrypt\\$[0-9a-f]{32}\\$[0-9a-f]{128}$"));
        assertTrue(PasswordHasher.verify("Peripheral#77", a));
        assertFalse(PasswordHasher.verify("Peripheral#78", a));
    }

    @Test @DisplayName("T-03 Java decrypts a phone number encrypted by the web app")
    void decryptsNodeCiphertext() {
        assertEquals("(07) 3266 7788", new FieldCrypto(TEST_KEY).decrypt(NODE_CIPHERTEXT));
    }

    @Test @DisplayName("T-04 Encrypt/decrypt round trip; same text gives different ciphertext (random IV)")
    void roundTrip() {
        FieldCrypto c = new FieldCrypto(TEST_KEY);
        String a = c.encrypt("0412 345 678"), b = c.encrypt("0412 345 678");
        assertNotEquals(a, b);
        assertTrue(FieldCrypto.isEncrypted(a));
        assertEquals("0412 345 678", c.decrypt(a));
    }

    @Test @DisplayName("T-05 A changed ciphertext or a wrong key is rejected (GCM authentication)")
    void tamperDetected() {
        FieldCrypto c = new FieldCrypto(TEST_KEY);
        String t = c.encrypt("secret");
        String changed = t.substring(0, t.length() - 2) + (t.endsWith("AA") ? "BB" : "AA");
        assertThrows(SecurityException.class, () -> c.decrypt(changed));
        FieldCrypto other = new FieldCrypto("HwEDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=");
        assertThrows(SecurityException.class, () -> other.decrypt(NODE_CIPHERTEXT));
        assertEquals("(cannot decrypt)", other.open(NODE_CIPHERTEXT));
    }

    @Test @DisplayName("T-22 The web app (Node.js) accepts a hash and a ciphertext made by Java")
    void nodeAcceptsJavaOutput() throws Exception {
        java.nio.file.Path cryptoJs = java.nio.file.Path.of("..", "app", "Security", "crypto.js").toAbsolutePath();
        org.junit.jupiter.api.Assumptions.assumeTrue(java.nio.file.Files.exists(cryptoJs), "web app not next to oop-app");
        String hash = PasswordHasher.hash("Desk#Top2026");
        String cipher = new FieldCrypto(TEST_KEY).encrypt("0400 111 222");
        String js = "const c=require('crypto');const [a,s,h]=process.argv[1].split('$');"
                + "const ok=c.timingSafeEqual(Buffer.from(h,'hex'),c.scryptSync('Desk#Top2026',s,64));"
                + "process.env.DATA_KEY=process.argv[3];const f=require(process.argv[2]);"
                + "console.log(ok+' '+f.decrypt(process.argv[4]))";
        ProcessBuilder pb = new ProcessBuilder("node", "-e", js, hash, cryptoJs.toString(), TEST_KEY, cipher);
        pb.environment().put("DATA_KEY", TEST_KEY);
        pb.redirectErrorStream(true);
        Process p;
        try { p = pb.start(); } catch (java.io.IOException e) { org.junit.jupiter.api.Assumptions.assumeTrue(false, "node not installed"); return; }
        String out = new String(p.getInputStream().readAllBytes()).trim();
        p.waitFor();
        assertEquals("true 0400 111 222", out.lines().reduce((x, y) -> y).orElse(""));
    }

    @Test @DisplayName("T-06 Blind index (HKDF + HMAC-SHA256) equals the web app's")
    void blindIndexMatchesNode() {
        assertEquals(NODE_INDEX, new FieldCrypto(TEST_KEY).blindIndex("0732667788"));
        assertEquals("0732667788", FieldCrypto.digits("(07) 3266 7788"));
    }
}
