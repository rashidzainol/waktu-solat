package my.rashidzainol.waktusolat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Notifikasi ringkasan senyap — "widget" kecil dalam panel notifikasi:
 * zon + tarikh Hijri, 6 waktu hari ini, dan kiraan detik ke waktu seterusnya.
 *
 * Ia dikemas kini setiap minit melalui tick yang sama dengan widget homescreen
 * (lihat SolatWidget.ensureTick). Klik notifikasi membuka app; butang
 * "Sembunyi" mematikan ringkasan (boleh dihidupkan semula di Tetapan).
 */
public final class SummaryNotif {

    public static final String CHANNEL = "waktu_solat_summary";
    public static final String ACTION_HIDE = "my.rashidzainol.waktusolat.HIDE_SUMMARY";

    private static final int NOTIF_ID = 1100;
    private static final int REQ_OPEN = 2101;
    private static final int REQ_HIDE = 2102;

    private static final String PREFS = "waktu-solat";
    private static final String KEY_ON = "summaryOn";
    private static final String KEY_WIDGET = "widget_data";

    private static final String[] KEYS = {
            "fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha"
    };
    private static final String[] LABELS = {
            "Subuh", "Syuruk", "Zohor", "Asar", "Maghrib", "Isyak"
    };
    private static final String[] PRAYERS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };

    private static final int C_LABEL = 0xFF8BA39A;
    private static final int C_TIME = 0xFFEAF3EF;
    private static final int C_DIM_LABEL = 0xFF63776F;
    private static final int C_DIM_TIME = 0xFFAFC2BA;
    private static final int C_ACCENT = 0xFF34D399;

    private SummaryNotif() {
    }

    /** Adakah ringkasan dihidupkan? (lalai: ya) */
    static boolean isOn(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getBoolean(KEY_ON, true);
        } catch (Exception e) {
            return false;
        }
    }

    static void setOn(Context ctx, boolean on) {
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ON, on).apply();
        } catch (Exception ignored) {
        }
        if (on) update(ctx);
        else cancel(ctx);
        SolatWidget.ensureTick(ctx);
    }

    static void cancel(Context ctx) {
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.cancel(NOTIF_ID);
        } catch (Exception ignored) {
        }
    }

    /** Saluran senyap (IMPORTANCE_LOW: tiada bunyi, tiada getaran, tiada pop-up). */
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, "Ringkasan waktu solat", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Ringkasan senyap waktu solat hari ini dan kiraan detik");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.enableLights(false);
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Bina/kemas kini notifikasi ringkasan daripada data widget tersimpan. */
    static void update(Context ctx) {
        if (!isOn(ctx)) {
            cancel(ctx);
            return;
        }
        ensureChannel(ctx);

        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        long now = System.currentTimeMillis();
        String zone = "";
        String hijri = "";
        String theme = "dark";
        boolean hasData = false;
        String nextKey = null;
        long nextMs = 0;
        long[] cellMs = new long[KEYS.length];

        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject data = new JSONObject(p.getString(KEY_WIDGET, "{}"));
            zone = data.optString("city", "");
            theme = data.optString("theme", "dark");
            JSONArray days = data.optJSONArray("days");
            if (days != null) {
                String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        .format(new Date(now));
                JSONObject today = null, tomorrow = null;
                for (int i = 0; i < days.length(); i++) {
                    JSONObject d = days.getJSONObject(i);
                    if (todayStr.equals(d.optString("date"))) {
                        today = d;
                    } else if (tomorrow == null) {
                        // Hari pertama yang bukan hari ini (esok).
                        tomorrow = d;
                    }
                }
                if (today != null) {
                    JSONObject t = today.optJSONObject("times");
                    if (t != null) {
                        hasData = true;
                        hijri = today.optString("hijri", "");
                        for (int i = 0; i < KEYS.length; i++) {
                            cellMs[i] = t.optLong(KEYS[i], 0);
                        }
                        long best = 0;
                        for (String key : PRAYERS) {
                            long ms = t.optLong(key, 0);
                            if (ms > now && (best == 0 || ms < best)) {
                                best = ms;
                                nextKey = key;
                            }
                        }
                        if (best == 0 && tomorrow != null) {
                            JSONObject t2 = tomorrow.optJSONObject("times");
                            if (t2 != null) {
                                long ms = t2.optLong("fajr", 0);
                                if (ms > 0) {
                                    best = ms;
                                    nextKey = "fajr";
                                }
                            }
                        }
                        nextMs = best;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // warna ikut tema
        int cLabel, cTime, cDimLabel, cDimTime, cAccent, cZone, cDate;
        if ("light".equals(theme)) {
            cLabel = 0xFF52655C; cTime = 0xFF14211B; cDimLabel = 0xFF9AAEA5;
            cDimTime = 0xFF8A9E95; cAccent = 0xFF0C8F63; cZone = 0xFF0C8F63; cDate = 0xFF52655C;
        } else if ("minimal".equals(theme)) {
            cLabel = 0xFF555552; cTime = 0xFF111111; cDimLabel = 0xFF9A9A96;
            cDimTime = 0xFF8A8A86; cAccent = 0xFF111111; cZone = 0xFF111111; cDate = 0xFF555552;
        } else {
            cLabel = 0xFF8BA39A; cTime = 0xFFEAF3EF; cDimLabel = 0xFF63776F;
            cDimTime = 0xFFAFC2BA; cAccent = 0xFF34D399; cZone = 0xFF34D399; cDate = 0xFF8BA39A;
        }

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.notification_summary);
        rv.setTextViewText(R.id.nZone, zone.isEmpty() ? "Waktu Solat" : zone);
        rv.setTextColor(R.id.nZone, cZone);
        rv.setTextViewText(R.id.nDate, hijri);
        rv.setTextColor(R.id.nDate, cDate);

        int nextIdx = -1;
        for (int i = 0; i < KEYS.length; i++) {
            if (KEYS[i].equals(nextKey)) {
                nextIdx = i;
                break;
            }
        }

        for (int i = 0; i < KEYS.length; i++) {
            int kid = ctx.getResources().getIdentifier("nK" + i, "id", ctx.getPackageName());
            int tid = ctx.getResources().getIdentifier("nT" + i, "id", ctx.getPackageName());
            rv.setTextViewText(kid, LABELS[i]);
            rv.setTextViewText(tid, cellMs[i] > 0 ? hhmm(cellMs[i]) : "—");

            boolean isNext = i == nextIdx;
            boolean isPast = cellMs[i] > 0 && cellMs[i] < now;
            rv.setTextColor(kid, isNext ? cAccent : isPast ? cDimLabel : cLabel);
            rv.setTextColor(tid, isNext ? cAccent : isPast ? cDimTime : cTime);
        }

        String info;
        if (!hasData) {
            info = "Buka app untuk muat waktu solat";
        } else if (nextKey != null) {
            info = "Seterusnya " + labelOf(nextKey) + " · " + hhmm(nextMs)
                    + " · lagi " + shortCd(nextMs - now);
        } else {
            info = "Waktu hari ini telah tamat";
        }
        rv.setTextViewText(R.id.nNext, info);
        rv.setTextColor(R.id.nNext, hasData ? cAccent : cLabel);

        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent hide = new Intent(ctx, SolatWidget.class).setAction(ACTION_HIDE);
        PendingIntent hidePi = PendingIntent.getBroadcast(
                ctx, REQ_HIDE, hide,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(ctx, CHANNEL);
        } else {
            b = new Notification.Builder(ctx);
            b.setPriority(Notification.PRIORITY_LOW);
            b.setSound(null);
        }

        b.setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(zone.isEmpty() ? "Waktu Solat" : "Waktu Solat · " + zone)
                .setContentText(info)
                .setStyle(new Notification.DecoratedCustomViewStyle())
                .setCustomContentView(rv)
                .setCustomBigContentView(rv)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_STATUS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(pi)
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(ctx, R.drawable.ic_notif),
                        "Sembunyi", hidePi).build());

        try {
            nm.notify(NOTIF_ID, b.build());
        } catch (Exception ignored) {
        }
    }

    /* ----------------------------------------------------------- helpers */

    private static String labelOf(String key) {
        if (key == null) return "—";
        switch (key) {
            case "fajr": return "Subuh";
            case "dhuhr": return "Zohor";
            case "asr": return "Asar";
            case "maghrib": return "Maghrib";
            case "isha": return "Isyak";
            case "syuruk": return "Syuruk";
            default: return key;
        }
    }

    private static String hhmm(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.US).format(new Date(ms));
    }

    private static String shortCd(long ms) {
        if (ms < 0) ms = 0;
        long s = ms / 1000;
        long h = s / 3600; s -= h * 3600;
        long m = s / 60;
        if (h > 0) return h + "j " + m + "m";
        if (m > 0) return m + " min";
        return "<1 min";
    }
}
