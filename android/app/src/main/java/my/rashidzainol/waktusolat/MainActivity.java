package my.rashidzainol.waktusolat;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationManager;
import android.app.UiModeManager;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Bekas WebView untuk app waktu solat.
 * Aset web dimuatkan dari APK (folder assets/www) melalui WebViewAssetLoader,
 * jadi app berfungsi sepenuhnya tanpa internet dan tanpa server.
 *
 * Menyokong Android TV / Google TV (landskap + launcher leanback) dan
 * notifikasi waktu solat melalui jambatan AndroidNotif.
 */
public class MainActivity extends Activity {

    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int REQ_LOCATION = 10;
    private static final int REQ_NOTIF = 11;

    private WebView web;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private boolean isTv;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        isTv = detectTv();
        if (isTv) {
            // TV: paparan sentiasa landskap.
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        }

        Window win = getWindow();
        win.setStatusBarColor(Color.parseColor("#070d0b"));
        win.setNavigationBarColor(Color.parseColor("#070d0b"));

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.addJavascriptInterface(new ThemeBridge(), "AndroidTheme");
        web.addJavascriptInterface(new NotifBridge(), "AndroidNotif");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u.getHost() != null && u.getHost().equals("appassets.androidplatform.net")) {
                    return false;
                }
                // Pautan luar (contoh GitHub) dibuka dalam pelayar.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                           GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                } else {
                    geoCallback = callback;
                    geoOrigin = origin;
                    requestLocationPermission();
                }
            }
        });

        if (!hasLocationPermission()) {
            requestLocationPermission();
        }

        requestNotificationPermissionIfNeeded();

        if (savedInstanceState == null) {
            web.loadUrl(START_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    private boolean detectTv() {
        try {
            UiModeManager um = (UiModeManager) getSystemService(android.content.Context.UI_MODE_SERVICE);
            if (um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
                return true;
            }
        } catch (Exception ignored) {}
        // Fallback: kebanyakan TV melaporkan ciri leanback.
        return getPackageManager().hasSystemFeature("android.software.leanback");
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            boolean enabled = nm != null && nm.areNotificationsEnabled();
            if (enabled &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
            }
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocationPermission() {
        if (Build.VERSION.SDK_INT >= 23 && !hasLocationPermission()) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQ_LOCATION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_LOCATION && hasLocationPermission()
                && geoCallback != null && geoOrigin != null) {
            geoCallback.invoke(geoOrigin, true, false);
            geoCallback = null;
            geoOrigin = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /** Jambatan kecil supaya warna status/navigation bar ikut tema app. */
    public class ThemeBridge {
        @JavascriptInterface
        public void setBars(final String color, final boolean light) {
            runOnUiThread(() -> {
                try {
                    int c = Color.parseColor(color);
                    Window win = getWindow();
                    win.setStatusBarColor(c);
                    win.setNavigationBarColor(c);

                    if (Build.VERSION.SDK_INT >= 23) {
                        View decor = win.getDecorView();
                        int flags = decor.getSystemUiVisibility();
                        if (light) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        } else {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                        if (Build.VERSION.SDK_INT >= 26) {
                            if (light) {
                                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                            } else {
                                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                            }
                        }
                        decor.setSystemUiVisibility(flags);
                    }
                } catch (Exception ignored) {
                }
            });
        }
    }

    /**
     * Jambatan notifikasi & TV. Dalam app web (pelayar/PWA) objek ini
     * tidak wujud, jadi ui.js akan lompat semua panggilan dengan selamat.
     */
    public class NotifBridge {
        @JavascriptInterface
        public boolean isTv() {
            return isTv;
        }

        /** json = senarai acara dari ui.js: [{key,label,ms}] */
        @JavascriptInterface
        public void schedule(String json) {
            try {
                PrayerAlarms.apply(MainActivity.this, json);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void cancel() {
            try {
                PrayerAlarms.apply(MainActivity.this, "[]");
            } catch (Exception ignored) {
            }
        }

        /** Mod Jam: halang skrin TV tertidur. */
        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(() -> {
                if (on) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }
    }
}
