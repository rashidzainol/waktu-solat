package my.rashidzainol.waktusolat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget homescreen 4x2 — 8 waktu solat hari ini & waktu seterusnya.
 *
 * Data dihantar dari JavaScript melalui jambatan AndroidNotif.updateWidget(json)
 * dan disimpan dalam SharedPreferences. Tick setiap minit mengemas kini widget,
 * notifikasi ringkasan senyap, dan kiraan detik.
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

    private static final int C_LABEL = 0xFF8BA39A;
    private static final int C_TIME = 0xFFEAF3EF;
    private static final int C_DIM_LABEL = 0xFF63776F;
    private static final int C_DIM_TIME = 0xFFAFC2BA;
    private static final int C_ACCENT = 0xFF34D399;

    /** Simpan data baharu dari JS & kemas kini semua widget. */
    public static void saveData(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_WIDGET, json).apply();
        updateAll(ctx);
        ensureTick(ctx);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        updateAll(ctx);
        ensureTick(ctx);
    }

    @Override
    public void onEnabled(Context ctx) {
        ensureTick(ctx);
    }

    @Override
    public void onDisabled(Context ctx) {
        // Kekalkan tick jika notifikasi ringkasan masih dihidupkan.
        ensureTick(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_TICK.equals(action)) {
            updateAll(ctx);
            ensureTick(ctx);
        } else if (SummaryNotif.ACTION_HIDE.equals(action)) {
            SummaryNotif.setOn(ctx, false);
        }
    }

    /* ------------------------------------------------------------ render */

    private static void updateAll(Context ctx) {
        // Notifikasi ringkasan dikemas kini walaupun tiada widget di homescreen.
        SummaryNotif.update(ctx);

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SolatWidget.class));
        if (ids == null || ids.length == 0) return;

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_solat);
        long now = System.currentTimeMillis();
        boolean hasData = false;
        String nextName = null;
        String nextInfo = null;
        int nextIndex = -1;
        String zone = "";
        String hijri = "";
        long[] cellMs = new long[8];

        try {
            JSONObject data = new JSONObject(
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .getString(KEY_WIDGET, "{}"));
            zone = data.optString("city", "");
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
                        // Hari pertama yang bukan hari ini (esok)
                        tomorrow = d;
                    }
                }

                if (today != null) {
                    JSONObject t = today.optJSONObject("times");
                    if (t != null) {
                        hasData = true;
                        hijri = today.optString("hijri", "");
                        for (int i = 0; i < 8; i++) cellMs[i] = t.optLong(ORDER[i], 0);

                        // waktu seterusnya
                        long best = 0;
                        String bestKey = null;
                        for (String p : PRAYERS) {
                            long ms = t.optLong(p, 0);
                            if (ms > now && (best == 0 || ms < best)) {
                                best = ms;
                                bestKey = p;
                            }
                        }
                        if (best == 0 && tomorrow != null) {
                            JSONObject t2 = tomorrow.optJSONObject("times");
                            if (t2 != null) {
                                long ms = t2.optLong("fajr", 0);
                                if (ms > 0) {
                                    best = ms;
                                    bestKey = "fajr";
                                }
                            }
                        }
                        if (bestKey != null) {
                            boolean esok = t.optLong(bestKey, 0) != best;
                            nextName = labelOf(bestKey) + (esok ? " · esok" : "");
                            nextInfo = "pada " + hhmm(best) + " · lagi " + shortCd(best - now);
                            for (int i = 0; i < 8; i++) {
                                if (ORDER[i].equals(bestKey)) {
                                    nextIndex = i;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        rv.setTextViewText(R.id.wZone, zone);
        rv.setViewVisibility(R.id.wZone, zone.isEmpty() ? View.GONE : View.VISIBLE);

        if (hasData) {
            rv.setTextViewText(R.id.wNextName,
                    nextName != null ? "Seterusnya: " + nextName : "Waktu hari ini tamat");
            rv.setTextViewText(R.id.wNextInfo, nextInfo != null ? nextInfo : "");
            rv.setTextViewText(R.id.wDate, hijri);
        } else {
            rv.setTextViewText(R.id.wNextName, "Buka app untuk muat waktu");
            rv.setTextViewText(R.id.wNextInfo, "");
            rv.setTextViewText(R.id.wDate, "");
        }

        for (int i = 0; i < 8; i++) {
            int cid = rid(ctx, "wC" + i);
            int kid = rid(ctx, "wK" + i);
            int tid = rid(ctx, "wT" + i);

            rv.setTextViewText(kid, LABELS[i]);
            rv.setTextViewText(tid, hasData && cellMs[i] > 0 ? hhmm(cellMs[i]) : "—");

            boolean isNext = i == nextIndex;
            boolean isPast = hasData && cellMs[i] > 0 && cellMs[i] <= now;

            rv.setInt(cid, "setBackgroundResource",
                    isNext ? R.drawable.widget_cell_next : R.drawable.widget_cell);
            rv.setTextColor(kid, isNext ? C_ACCENT : isPast ? C_DIM_LABEL : C_LABEL);
            rv.setTextColor(tid, isNext ? C_ACCENT : isPast ? C_DIM_TIME : C_TIME);
        }

        // Klik widget → buka app
        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rv.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(ids, rv);
    }

    /* ----------------------------------------------------------- helpers */

    private static int rid(Context ctx, String name) {
        return ctx.getResources().getIdentifier(name, "id", ctx.getPackageName());
    }

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

    /** Pastikan tick setiap minit aktif selagi ada widget atau ringkasan notifikasi. */
    public static void ensureTick(Context ctx) {
        boolean hasWidget;
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SolatWidget.class));
            hasWidget = ids != null && ids.length > 0;
        } catch (Exception e) {
            hasWidget = false;
        }
        if (hasWidget || SummaryNotif.isOn(ctx)) {
            scheduleTick(ctx);
        } else {
            cancelTick(ctx);
        }
    }

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
