package au.com.lpa.desktop.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Application settings. The desktop app shares the web app's settings file (.env), so both
 * apps use the same database account and the same encryption key - and no password is ever
 * written in the Java code.
 *
 * Where the .env file is looked for (first one found wins):
 *   1. -Dlpa.env=path   2. LPA_ENV environment variable   3. ./.env   4. ../.env
 *   5. ./cluster3-project/.env   (when the jar is started from the "CTI Project" folder)
 */
public final class AppConfig {

    private final Map<String, String> values;
    private final Path file;

    private AppConfig(Map<String, String> values, Path file) {
        this.values = values;
        this.file = file;
    }

    /** Loads the first .env found (see the class comment). */
    public static AppConfig load() {
        for (Path p : candidates()) {
            if (p != null && Files.isRegularFile(p)) {
                try {
                    return new AppConfig(parse(Files.readAllLines(p, StandardCharsets.UTF_8)), p.toAbsolutePath().normalize());
                } catch (IOException e) {
                    throw new IllegalStateException("Cannot read settings file " + p + ": " + e.getMessage(), e);
                }
            }
        }
        throw new IllegalStateException("Settings file .env not found. Run 'npm run db:setup' in the web app folder first, "
                + "or start with -Dlpa.env=<path to .env>.");
    }

    /** For tests: settings from a map. */
    public static AppConfig of(Map<String, String> values) {
        return new AppConfig(new LinkedHashMap<>(values), null);
    }

    private static List<Path> candidates() {
        List<Path> list = new java.util.ArrayList<>();
        String prop = System.getProperty("lpa.env");
        String env = System.getenv("LPA_ENV");
        if (prop != null && !prop.isBlank()) list.add(Path.of(prop));
        if (env != null && !env.isBlank()) list.add(Path.of(env));
        list.add(Path.of(".env"));
        list.add(Path.of("..", ".env"));
        list.add(Path.of("cluster3-project", ".env"));
        return list;
    }

    /** Reads KEY=VALUE lines; ignores comments and blank lines; removes surrounding quotes. */
    static Map<String, String> parse(List<String> lines) {
        Map<String, String> map = new LinkedHashMap<>();
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) continue;
            int eq = line.indexOf('=');
            String key = line.substring(0, eq).trim();
            String value = line.substring(eq + 1).trim();
            if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length() - 1);
            } else {
                int hash = value.indexOf(" #"); // inline comment
                if (hash >= 0) value = value.substring(0, hash).trim();
            }
            map.put(key, value);
        }
        return map;
    }

    public String get(String key, String fallback) {
        String v = values.get(key);
        return v == null || v.isEmpty() ? fallback : v;
    }

    public String require(String key) {
        return Optional.ofNullable(values.get(key)).filter(v -> !v.isEmpty())
                .orElseThrow(() -> new IllegalStateException(key + " is missing in " + (file == null ? "the settings" : file)));
    }

    /** The web app's folder (where .env lives) - used to find config/security-policy.json. */
    public Optional<Path> projectRoot() {
        return file == null ? Optional.empty() : Optional.ofNullable(file.getParent());
    }

    public Path file() { return file; }

    // ---- typed settings ----
    public String dbUrl() {
        return "jdbc:mysql://" + get("DB_HOST", "127.0.0.1") + ":" + get("DB_PORT", "3306") + "/" + get("DB_NAME", "lpa_ecomms")
                + "?useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8&connectTimeout=4000";
    }
    public String dbUser() { return get("DB_USER", "lpa_app"); }
    public String dbPassword() { return get("DB_PASSWORD", ""); }
    public String dataKey() { return require("DATA_KEY"); }
}
