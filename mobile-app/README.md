# LPA eComms — Android app (WebView shell)

Opens the LPA eComms web app inside a native Android app (splash screen → WebView).

**Build:** open this folder in Android Studio (or `gradlew assembleDebug`). Debug builds load `http://10.0.2.2:3000/` (your PC from the emulator) — start the web app with `npm start` first.

**Security (ICTPRG537):**
- `res/xml/network_security_config.xml` — HTTPS only; plain HTTP allowed only to the development PC (10.0.2.2 / localhost); system certificate authorities only (user-installed ones in debug builds).
- `AndroidManifest.xml` — `allowBackup="false"` + backup / data-extraction rules (the session cookie is never backed up); only the launcher activity is exported; INTERNET is the only permission.
- `MainActivity.java` — locked-down WebView: LPA pages only (other sites open in the browser, `file:` / `intent:` / `javascript:` links blocked), no file or content access, no mixed content, no pop-ups, Safe Browsing, certificate errors always cancelled, no JavaScript bridge, remote debugging only in debug builds, `FLAG_SECURE` (no screenshots) in release builds, cache cleared on exit.
- `app/build.gradle` — release builds: HTTPS address, R8 shrinking/obfuscation, not debuggable.
- Android lint: 0 security issues.
