package my.rashidzainol.waktusolat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget homescreen 4x2 — waktu solat hari ini & waktu seterusnya.
 *
 * Data dihantar dari JavaScript melalui jambatan AndroidNotif.updateWidget(json)
 * dan disimpan dalam SharedPreferences. Kira detik dikemas kini setiap minit
 * melalui alarm RTC (tidak mengganggu tidur peranti).
 */
public class SolatWidget extends AppWidgetProvider {

    public static final String ACTION_TICK = "my.rashidzainol.waktusolat.WIDGET_TICK";
    private static final String PREFS = "waktu-solat";
    private static final String KEY_WIDGET = "widget_data";
    private static final int REQ_TICK = 2001;
    private static final int REQ_OPEN = 2002;

    private static final String[] ORDER = {
            "imsak", "fajr", "syuruk", "dhuha", "dhuhr", "asr", "maghrib", "isha"
    };
    private static final String[] LABELS = {
            "Imsak", "Subuh", "Syuruk", "Duha", "Zohor", "Asar", "Maghrib", "Isyak"
    };
    private static final String[] PRAYERS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };

    /** Simpan data baharu dari JS & kemas kini semua widget. */
    public static void saveData(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_WIDGET, json).apply();
        updateAll(ctx);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        updateAll(ctx);
        scheduleTick(ctx);
    }

    @Override
    public void onEnabled(Context ctx) {
        scheduleTick(ctx);
    }

    @Override
    public void onDisabled(Context ctx) {
        cancelTick(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TICK.equals(action)) {
            updateAll(ctx);
            scheduleTick(ctx);
        }
    }

    /* ------------------------------------------------------------ render */

    private static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SolatWidget.class));
        if (ids == null || ids.length == 0) return;

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_solat);
        long now = System.currentTimeMillis();
        boolean hasData = false;
        String nextName = null;
        String nextInfo = null;
        int nextIndex = -1;
        long[] cellMs = new long[8];

        try {
            JSONObject data = new JSONObject(
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .getString(KEY_WIDGET, "{}"));
            JSONArray days = data.optJSONArray("days");
            if (days != null) {
                JSONObject today = null, tomorrow = null;
                String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        .format(new Date(now));
                for (int i = 0; i < days.length(); i++) {
                    JSONObject d = days.getJSONObject(i);
                    if (todayStr.equals(d.optString("date"))) {
                        today = d;
                    } else if (tomorrow == null) {
                        // hari pertama yang bukan hari ini (esok)
                        tomorrow = d;
                    }
                }

                if (today != null) {
                    JSONObject t = today.optJSONObject("times");
                    if (t != null) {
                        hasData = true;
                        for (int i = 0; i < 8; i++) cellMs[i] = t.optLong(ORDER[i], 0);

                        // waktu seterusnya
                        long best = 0; String bestKey = null;
                        for (String p : PRAYERS) {
                            long ms = t.optLong(p, 0);
                            if (ms > now && (best == 0 || ms < best)) { best = ms; bestKey = p; }
                        }
                        if (best == 0 && tomorrow != null) {
                            JSONObject t2 = tomorrow.optJSONObject("times");
                            if (t2 != null) {
                                long ms = t2.optLong("fajr", 0);
                                if (ms > 0) { best = ms; bestKey = "fajr"; }
                            }
                        }
                        if (best > 0) {
                            nextName = labelOf(bestKey) + (t.optLong(bestKey) != best ? " · esok" : "");
                            nextInfo = "pada " + hhmm(best) + " · lagi " + shortCd(best - now);
                        }
                        if (bestKey != null) {
                            for (int i = 0; i < 8; i++) {
                                if (ORDER[i].equals(bestKey)) { nextIndex = i; break; }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        if (hasData) {
            rv.setTextViewText(R.id.wNextName, "Seterusnya: " + nextName);
            rv.setTextViewText(R.id.wNextInfo, nextInfo);
            for (int i = 0; i < 8; i++) {
                int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
                int tid = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
                rv.setTextViewText(kid, LABELS[i]);
                rv.setTextViewText(tid, cellMs[i] > 0 ? hhmm(cellMs[i]) : "—");
                boolean isNext = (i == nextIndex);
                rv.setTextColor(kid, isNext ? 0xFF34D399 : 0xFF8BA39A);
                rv.setTextColor(tid, isNext ? 0xFF34D399 : 0xFFEAF3EF);
            }
        } else {
            rv.setTextViewText(R.id.wNextName, "Buka app untuk muat waktu");
            rv.setTextViewText(R.id.wNextInfo, "");
            for (int i = 0; i < 8; i++) {
                int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
                int tid = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
                rv.setTextViewText(kid, LABELS[i]);
                rv.setTextViewText(tid, "—");
                rv.setTextColor(kid, 0xFF8BA39A);
                rv.setTextColor(tid, 0xFFEAF3EF);
            }
        }

        rv.setTextViewText(R.id.wTitle, "Waktu Solat");
        rv.setTextViewText(R.id.wDate, new SimpleDateFormat("EEE, d MMM", new Locale("ms"))
                .format(new Date(now)).replace(".", ""));

        // Klik widget → buka app
        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rv.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(ids, rv);
    }

    /* ----------------------------------------------------------- helpers */

    private static String labelOf(String key) {
        for (int i = 0; i < ORDER.length; i++) {
            if (ORDER[i].equals(key)) return LABELS[i];
        }
        return key;
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

    /* ------------------------------------------------------------ minute tick */

    private static void scheduleTick(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent it = new Intent(ctx, SolatWidget.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(
                ctx, REQ_TICK, it,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        long now = System.currentTimeMillis();
        long next = now + (60000 - (now % 60000)) + 50; // awal minit seterusnya
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC, next, pi);
            else am.setWindow(AlarmManager.RTC, next, 60000, pi);
        } catch (Exception ignored) {
        }
    }

    private static void cancelTick(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent it = new Intent(ctx, SolatWidget.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(
                ctx, REQ_TICK, it,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) am.cancel(pi);
    }
}
