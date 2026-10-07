package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.model.User;
import au.com.lpa.desktop.model.UserGroup;
import au.com.lpa.desktop.security.Policy;
import au.com.lpa.desktop.service.PasswordRules;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Access policy, password rules and settings parsing - shared with the web app. */
class PolicyAndRulesTest {

    static User user(UserGroup g) {
        User u = new User(); u.setId("U-9"); u.setUsername("t"); u.setGroup(g); u.setStatus(RecordStatus.ACTIVE);
        return u;
    }

    @Test @DisplayName("T-15 Policy: each group gets exactly its permissions; deny by default")
    void policy() {
        Policy p = Policy.load(null); // copy in the jar
        assertTrue(p.can(user(UserGroup.ADMINISTRATOR), "users.manage"));
        assertFalse(p.can(user(UserGroup.USER), "users.manage"));
        assertTrue(p.can(user(UserGroup.USER), "stock.adjust"));
        assertFalse(p.can(user(UserGroup.USER), "stock.manage"));
        assertFalse(p.can(user(UserGroup.CUSTOMER), "stock.view"));
        assertFalse(p.can(user(UserGroup.ADMINISTRATOR), "unknown.permission"));
        assertFalse(p.can(null, "shop.view"));
        User inactive = user(UserGroup.ADMINISTRATOR); inactive.setStatus(RecordStatus.DISABLED);
        assertFalse(p.can(inactive, "stock.view"));
    }

    @Test @DisplayName("T-16 A broken policy file is refused (allow-by-default, unknown role)")
    void brokenPolicy() {
        String allow = "{\"version\":1,\"defaultDecision\":\"allow\",\"roles\":{\"a\":\"\"},\"permissions\":{}}";
        String unknown = "{\"version\":1,\"defaultDecision\":\"deny\",\"roles\":{\"a\":\"\"},\"permissions\":{\"x.y\":{\"roles\":[\"b\"],\"description\":\"\"}}}";
        assertThrows(IllegalStateException.class, () -> Policy.parse(new StringReader(allow), "t"));
        assertThrows(IllegalStateException.class, () -> Policy.parse(new StringReader(unknown), "t"));
    }

    @Test @DisplayName("T-17 The copy of the policy in the jar is identical to the web app's file")
    void policyInSync() throws Exception {
        Path web = Path.of("..", "config", "security-policy.json");
        assumeTrue(Files.exists(web), "web app folder not next to oop-app");
        try (var in = PolicyAndRulesTest.class.getResourceAsStream("/security-policy.json")) {
            assertEquals(JsonParser.parseString(Files.readString(web)), JsonParser.parseString(new String(in.readAllBytes())));
        }
    }

    @Test @DisplayName("T-18 Password rules match the web app (length, letter+number, common list, user name)")
    void passwordRules() throws Exception {
        assertTrue(PasswordRules.problem("short1", "x").isPresent());
        assertTrue(PasswordRules.problem("onlyletters", "x").isPresent());
        assertEquals("That password is too common - choose another one.", PasswordRules.problem("Password1", "x").orElse(""));
        assertEquals("Password must not contain your user name.", PasswordRules.problem("kimlee2026", "kimlee").orElse(""));
        assertTrue(PasswordRules.problem("Peripheral#77", "aturner").isEmpty());
        Path js = Path.of("..", "app", "Security", "common-passwords.js");
        assumeTrue(Files.exists(js), "web app folder not next to oop-app");
        Set<String> webList = new HashSet<>();
        Matcher m = Pattern.compile("'([^']+)'").matcher(Files.readString(js));
        while (m.find()) webList.add(m.group(1));
        for (String w : webList) assertTrue(PasswordRules.problem(w.length() < 8 ? w + "x1x1x1x1" : w, "zz").isPresent() || w.length() < 8, w);
        assertEquals(webList.size(), webList.stream().filter(w -> w.length() >= 8 && PasswordRules.problem(w, "zz").isPresent()).count()
                + webList.stream().filter(w -> w.length() < 8).count());
    }

    @Test @DisplayName("T-19 Settings file (.env) parsing: quotes, comments, # inside quotes")
    void envParsing() throws Exception {
        Path f = Files.createTempFile("lpa", ".env");
        Files.writeString(f, "# comment\nDB_HOST=127.0.0.1\nDB_PASSWORD=\"Pa#ss w0rd\"\nDB_USER=lpa_app # inline\nDATA_KEY='abc='\n");
        System.setProperty("lpa.env", f.toString());
        try {
            AppConfig c = AppConfig.load();
            assertEquals("Pa#ss w0rd", c.dbPassword());
            assertEquals("lpa_app", c.dbUser());
            assertEquals("abc=", c.dataKey());
            assertTrue(c.dbUrl().startsWith("jdbc:mysql://127.0.0.1:3306/lpa_ecomms"));
        } finally {
            System.clearProperty("lpa.env");
            Files.deleteIfExists(f);
        }
    }
}
