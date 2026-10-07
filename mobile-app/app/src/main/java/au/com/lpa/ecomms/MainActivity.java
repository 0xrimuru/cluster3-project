package au.com.lpa.ecomms;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity - the WebView shell for the LPA mobile interface.
 * It loads the LPA eComms web app inside a native Android app
 * ("Using the Android WebView library, build an interface shell for the mobile web").
 *
 * Security (ICTPRG537) - the WebView is locked down:
 *  - only pages from the LPA server open inside the app; any other web link opens in the
 *    phone's browser, and other link types (file:, intent:, javascript:) are blocked
 *  - no access to the phone's files or content providers, no mixed (HTTP-in-HTTPS) content
 *  - certificate errors are never accepted (the page load is cancelled)
 *  - no JavaScript bridge to Java code (no addJavascriptInterface)
 *  - Safe Browsing on; remote debugging only in debug builds
 *  - release builds block screenshots / the recent-apps preview (FLAG_SECURE)
 */
public class MainActivity extends AppCompatActivity {

    /*
     * The address of the LPA web app comes from the build (app/build.gradle, buildConfigField):
     *  - debug:   http://10.0.2.2:3000/  (10.0.2.2 = your PC as seen from the Android EMULATOR)
     *  - release: https://10.0.2.2:3000/ (HTTPS; change to the real server address for production)
     * On a real phone, use your PC's network address (e.g. http://192.168.1.20:3000/) and add it
     * to res/xml/network_security_config.xml if it is plain HTTP.
     */
    private static final String APP_URL = BuildConfig.APP_URL;
    private static final Uri APP = Uri.parse(APP_URL);

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!BuildConfig.DEBUG) {
            // No screenshots or task-switcher preview of customer / sales data in release builds.
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
        setContentView(R.layout.activity_main);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView = findViewById(R.id.webview);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);                     // the LPA pages use JavaScript
        s.setDomStorageEnabled(true);                     // theme / accent preferences
        s.setAllowFileAccess(false);                      // no reading files on the phone
        s.setAllowContentAccess(false);                   // no reading other apps' content
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSupportMultipleWindows(false);               // no pop-up windows
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new LpaWebViewClient());
        webView.loadUrl(APP_URL);
    }

    /** Is this address on the LPA server (same scheme, host and port)? */
    static boolean isLpaUrl(Uri u) {
        return u != null
                && APP.getScheme().equalsIgnoreCase(u.getScheme())
                && APP.getHost().equalsIgnoreCase(u.getHost())
                && APP.getPort() == u.getPort();
    }

    private class LpaWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (isLpaUrl(u)) return false;                  // LPA page: open inside the app
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(java.util.Locale.ROOT);
            if (scheme.equals("http") || scheme.equals("https") || scheme.equals("mailto") || scheme.equals("tel")) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));   // other sites: phone's browser
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                }
            }
            return true;                                    // file:, intent:, javascript: ... blocked
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();                               // never accept a bad certificate
            Toast.makeText(MainActivity.this, "Secure connection failed - the page was not loaded.", Toast.LENGTH_LONG).show();
        }
    }

    /** Make the phone's Back button go back a page inside the app. */
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /** Signed-out state is not kept when the app is closed: clear the WebView cache. */
    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.clearCache(true);
            webView.destroy();
        }
        super.onDestroy();
    }
}
