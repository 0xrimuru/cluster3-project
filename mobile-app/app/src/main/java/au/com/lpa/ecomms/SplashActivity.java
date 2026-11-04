package au.com.lpa.ecomms;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;

/**
 * SplashActivity — the app's launch screen.
 * It shows the LPA logo for a short time, then loads the main WebView activity.
 * (Required by the spec: "a delay before loading the main activity / WebView page".)
 */
public class SplashActivity extends AppCompatActivity {

    // How long the splash screen stays on screen before the app opens (in milliseconds).
    private static final int SPLASH_DELAY_MS = 2000; // 2 seconds

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Wait SPLASH_DELAY_MS, then open MainActivity and close the splash screen.
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (isFinishing() || isDestroyed()) return; // the user pressed Back during the splash
                startActivity(new Intent(SplashActivity.this, MainActivity.class));
                finish(); // remove the splash so the back button doesn't return to it
            }
        }, SPLASH_DELAY_MS);
    }
}
