package my.rashidzainol.waktusolat;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Muat turun APK dari GitHub Releases dan buka pemasang Android.
 * Kemajuan dilaporkan kepada JS melalui window.__updateProgress(pct)
 * dan window.__updateDone(ok).
 */
public class UpdateManager {

    private final Activity activity;
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean busy = false;

    public UpdateManager(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    private void js(final String code) {
        ui.post(() -> {
            try {
                web.evaluateJavascript(code, null);
            } catch (Exception ignored) {
            }
        });
    }

    private void reportProgress(final long done, final long total) {
        int pct = total > 0 ? (int) ((done * 100) / total) : 0;
        js("try{window.__updateProgress(" + pct + ")}catch(e){}");
    }

    private void reportDone(final boolean ok, final String message) {
        js("try{window.__updateDone(" + (ok ? "1" : "0") + ")}catch(e){}");
        if (!ok) {
            js("try{window.__updateError(" + jsonSafe(message) + ")}catch(e){}");
        }
    }

    private static String jsonSafe(String s) {
        if (s == null) return "\"\"";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", " ").replace("\r", " ") + "\"";
    }

    /** Muat turun APK ke getExternalFilesDir("update")/update.apk, kemudian pasang. */
    public void downloadAndInstall(String url) {
        if (busy) {
            reportDone(false, "Muat turun sudah berjalan");
            return;
        }
        busy = true;
        js("try{window.__updateProgress(0)}catch(e){}");

        new Thread(() -> {
            File dest = null;
            try {
                File dir = new File(activity.getExternalFilesDir(null), "update");
                if (!dir.exists()) dir.mkdirs();
                dest = new File(dir, "update.apk");
                if (dest.exists()) dest.delete();

                long total = download(url, dest);
                final File apk = dest;

                // Fail dimuat turun — minta pemasang Android membukanya.
                ui.post(() -> {
                    try {
                        install(apk);
                        reportDone(true, null);
                    } catch (Exception e) {
                        reportDone(false, "Tidak boleh buka pemasang: " + e.getMessage());
                    } finally {
                        busy = false;
                    }
                });
            } catch (Exception e) {
                if (dest != null && dest.exists()) dest.delete();
                reportDone(false, "Muat turun gagal: " + e.getMessage());
                busy = false;
            }
        }, "apk-update").start();
    }

    private long download(String url, File dest) throws Exception {
        HttpURLConnection conn = null;
        InputStream in = null;
        FileOutputStream out = null;
        try {
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "waktu-solat-updater");

            int code = conn.getResponseCode();
            // GitHub asset URLs kadangkala redirect — ikut secara manual jika perlu.
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = conn.getHeaderField("Location");
                if (loc != null) {
                    conn.disconnect();
                    conn = (HttpURLConnection) new URL(loc).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "waktu-solat-updater");
                    code = conn.getResponseCode();
                }
            }
            if (code != 200) throw new Exception("HTTP " + code);

            long total = conn.getContentLengthLong();
            in = conn.getInputStream();
            out = new FileOutputStream(dest);

            byte[] buf = new byte[8192];
            long done = 0;
            long lastReport = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                done += n;
                if (total > 0 && done - lastReport > Math.max(total / 100, 65536)) {
                    lastReport = done;
                    reportProgress(done, total);
                }
            }
            out.flush();

            if (dest.length() < 1024) {
                throw new Exception("Fail terlalu kecil — mungkin bukan APK");
            }
            reportProgress(100, 100);
            return dest.length();
        } finally {
            try { if (in != null) in.close(); } catch (Exception ignored) {}
            try { if (out != null) out.close(); } catch (Exception ignored) {}
            try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}
        }
    }

    private void install(File apk) {
        Context c = activity;
        Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".files", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        c.startActivity(i);
    }

    /** Jambatan JS: window.AndroidUpdate */
    public class Bridge {
        @JavascriptInterface
        public String currentVersion() {
            try {
                return activity.getPackageManager()
                        .getPackageInfo(activity.getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public int currentVersionCode() {
            try {
                return activity.getPackageManager()
                        .getPackageInfo(activity.getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }

        @JavascriptInterface
        public void downloadAndInstall(String url) {
            UpdateManager.this.downloadAndInstall(url);
        }
    }
}
