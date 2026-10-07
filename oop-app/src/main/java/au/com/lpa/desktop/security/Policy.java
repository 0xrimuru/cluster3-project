package au.com.lpa.desktop.security;

import au.com.lpa.desktop.model.User;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Policy-based access control - the SAME policy file as the web app (config/security-policy.json):
 * permission -> user groups, deny by default. The desktop app reads the web app's live file when
 * it can find it, otherwise the copy packed inside the jar. Uses the Gson library (third party).
 */
public final class Policy {

    /** One rule from the file. */
    public record Rule(String name, String description, Set<String> groups) { }

    private final Map<String, Rule> rules;
    private final String source;
    private final int version;

    private Policy(Map<String, Rule> rules, String source, int version) {
        this.rules = Collections.unmodifiableMap(rules);
        this.source = source;
        this.version = version;
    }

    /** Loads web-app-folder/config/security-policy.json, or the copy in the jar. */
    public static Policy load(Path projectRoot) {
        if (projectRoot != null) {
            Path file = projectRoot.resolve("config").resolve("security-policy.json");
            if (Files.isRegularFile(file)) {
                try (Reader r = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                    return parse(r, file.toString());
                } catch (IOException e) {
                    throw new IllegalStateException("Cannot read " + file, e);
                }
            }
        }
        try (InputStream in = Policy.class.getResourceAsStream("/security-policy.json")) {
            if (in == null) throw new IllegalStateException("security-policy.json missing from the jar");
            return parse(new InputStreamReader(in, StandardCharsets.UTF_8), "built-in copy");
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Parses and CHECKS the policy - a broken policy stops the app instead of letting people in. */
    public static Policy parse(Reader reader, String source) {
        JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
        if (!"deny".equals(root.get("defaultDecision").getAsString())) throw new IllegalStateException("Policy defaultDecision must be \"deny\"");
        Set<String> roles = root.getAsJsonObject("roles").keySet();
        Map<String, Rule> rules = new LinkedHashMap<>();
        Gson gson = new Gson();
        for (Map.Entry<String, com.google.gson.JsonElement> e : root.getAsJsonObject("permissions").entrySet()) {
            JsonObject o = e.getValue().getAsJsonObject();
            @SuppressWarnings("unchecked")
            List<String> groups = gson.fromJson(o.get("roles"), List.class);
            if (groups == null || groups.isEmpty()) throw new IllegalStateException(e.getKey() + " has no roles");
            for (String g : groups) if (!roles.contains(g)) throw new IllegalStateException(e.getKey() + " names unknown role " + g);
            rules.put(e.getKey(), new Rule(e.getKey(), o.get("description").getAsString(), Set.copyOf(groups)));
        }
        return new Policy(rules, source, root.get("version").getAsInt());
    }

    /** Deny by default: unknown permission, no user or inactive user = false. */
    public boolean can(User user, String permission) {
        Rule r = rules.get(permission);
        return user != null && user.isActive() && r != null && r.groups().contains(user.getGroup().dbValue());
    }

    public Map<String, Rule> rules() { return rules; }
    public String source() { return source; }
    public int version() { return version; }
}
