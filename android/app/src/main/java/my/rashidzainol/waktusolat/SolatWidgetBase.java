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
 * Kelas asas untuk semua varian widget homescreen Waktu Solat.
 *
 * Varian (Full / Ringkas / Simpel) melanjutkan kelas ini dan hanya
 * mendefinisikan susun atur (layout) serta senarai waktu yang dipapar.
 * Logik data, tick setiap minit, dan notifikasi ringkasan dikongsi.
 */
public abstract class SolatWidgetBase extends AppWidgetProvider {

    public static final String ACTION_TICK = "my.rashidzainol.waktusolat.WIDGET_TICK";

    protected static final String PREFS = "waktu-solat";
    protected static final String KEY_WIDGET = "widget_data";
    protected static final int REQ_TICK = 2001;
    protected static final int REQ_OPEN = 2002;

    protected static final String[] PRAYERS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };

    protected static final int C_LABEL = 0xFF8BA39A;
    protected static final int C_TIME = 0xFFEAF3EF;
    protected static final int C_DIM_LABEL = 0xFF63776F;
    protected static final int C_DIM_TIME = 0xFFAFC2BA;
    protected static final int C_ACCENT = 0xFF34D399;

    /* ------------------------------ data ------------------------------ */

    public static final class Data {
        public String zone = "";
        public String hijri = "";
        public boolean hasData = false;
        public String nextKey = null;
        public long nextMs = 0;
        public boolean nextTomorrow = false;
        public java.util.Map<String, Long> times = new java.util.HashMap<>();
    }

    protected static Data loadData(Context ctx) {
        Data d = new Data();
        long now = System.currentTimeMillis();
        try {
            JSONObject data = new JSONObject(
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .getString(KEY_WIDGET, "{}"));
            d.zone = data.optString("city", "");
            JSONArray days = data.optJSONArray("days");
            if (days != null) {
                String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        .format(new Date(now));
                JSONObject today = null, tomorrow = null;
                for (int i = 0; i < days.length(); i++) {
                    JSONObject dd = days.getJSONObject(i);
                    if (todayStr.equals(dd.optString("date"))) {
                        today = dd;
                    } else if (tomorrow == null) {
                        tomorrow = dd;
                    }
                }
                if (today != null) {
                    JSONObject t = today.optJSONObject("times");
                    if (t != null) {
                        d.hasData = true;
                        d.hijri = today.optString("hijri", "");
                        java.util.Iterator<String> it = t.keys();
                        while (it.hasNext()) {
                            String k = it.next();
                            d.times.put(k, t.optLong(k, 0));
                        }
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
                                    d.nextTomorrow = true;
                                }
                            }
                        } else {
                            d.nextTomorrow = false;
                        }
                        d.nextKey = bestKey;
                        d.nextMs = best;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return d;
    }

    /* --------------------------- render helper --------------------------- */

    protected static void applyCell(RemoteViews rv, Context ctx, int i,
                                   String[] keys, String[] labels, Data d, long now) {
        int cid = ctx.getResources().getIdentifier("wC" + i, "id", ctx.getPackageName());
        int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
        int tid = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
        String key = keys[i];
        long ms = d.times.containsKey(key) ? d.times.get(key) : 0;
        rv.setTextViewText(kid, labels[i]);
        rv.setTextViewText(tid, (d.hasData && ms > 0) ? hhmm(ms) : "—");

        boolean isNext = key.equals(d.nextKey) && !d.nextTomorrow;
        boolean isPast = d.hasData && ms > 0 && ms <= now;
        rv.setInt(cid, "setBackgroundResource",
                isNext ? R.drawable.widget_cell_next : R.drawable.widget_cell);
        rv.setTextColor(kid, isNext ? C_ACCENT : isPast ? C_DIM_LABEL : C_LABEL);
        rv.setTextColor(tid, isNext ? C_ACCENT : isPast ? C_DIM_TIME : C_TIME);
    }

    protected static void finishRender(RemoteViews rv, Context ctx, Data d, long now) {
        rv.setTextViewText(R.id.wZone, d.zone);
        int zv = (d.zone == null || d.zone.isEmpty()) ? View.GONE : View.VISIBLE;
        rv.setViewVisibility(R.id.wZone, zv);

        if (d.hasData) {
            String nextName = d.nextKey != null
                    ? labelOf(d.nextKey) + (d.nextTomorrow ? " · esok" : "")
                    : null;
            String nextInfo = d.nextMs > 0
                    ? "pada " + hhmm(d.nextMs) + " · lagi " + shortCd(d.nextMs - now)
                    : "";
            rv.setTextViewText(R.id.wNextName,
                    nextName != null ? "Seterusnya: " + nextName : "Waktu hari ini tamat");
            rv.setTextViewText(R.id.wNextInfo, nextInfo);
            rv.setTextViewText(R.id.wDate, d.hijri);
        } else {
            rv.setTextViewText(R.id.wNextName, "Buka app untuk muat waktu");
            rv.setTextViewText(R.id.wNextInfo, "");
            rv.setTextViewText(R.id.wDate, "");
        }

        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rv.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    protected static void renderVariant(Context ctx, Class<? extends AppWidgetProvider> providerClass,
                                       int layoutRes, String[] keys, String[] labels,
                                       boolean simpleMode) {
        SummaryNotif.update(ctx);

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, providerClass));
        if (ids == null || ids.length == 0) return;

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layoutRes);
        long now = System.currentTimeMillis();
        Data d = loadData(ctx);

        if (simpleMode) {
            rv.setTextViewText(R.id.wZone, d.zone);
            rv.setViewVisibility(R.id.wZone,
                    (d.zone == null || d.zone.isEmpty()) ? View.GONE : View.VISIBLE);
            // waktu sekarang
            String curLabel = "—";
            String curTime = "—";
            long curMs = 0;
            if (d.hasData) {
                // cari waktu solat terakhir yang telah masuk
                long best = 0; String bestKey = null;
                for (String k : PRAYERS) {
                    long ms = d.times.containsKey(k) ? d.times.get(k) : 0;
                    if (ms > 0 && ms <= now && ms >= best) {
                        best = ms; bestKey = k;
                    }
                }
                if (bestKey != null) {
                    curLabel = labelOf(bestKey);
                    curMs = best;
                    curTime = hhmm(best);
                }
            }
            rv.setTextViewText(R.id.wCurLabel, "Sekarang: " + curLabel);
            rv.setTextViewText(R.id.wCurTime, curTime);
            if (d.hasData) {
                String nextName = d.nextKey != null
                        ? labelOf(d.nextKey) + (d.nextTomorrow ? " · esok" : "")
                        : "—";
                rv.setTextViewText(R.id.wNextName, "Seterusnya: " + nextName);
                rv.setTextViewText(R.id.wNextInfo,
                        d.nextMs > 0 ? "pada " + hhmm(d.nextMs) + " · lagi " + shortCd(d.nextMs - now) : "");
                rv.setTextViewText(R.id.wDate, d.hijri);
            } else {
                rv.setTextViewText(R.id.wNextName, "Buka app untuk muat waktu");
                rv.setTextViewText(R.id.wNextInfo, "");
                rv.setTextViewText(R.id.wDate, "");
            }
        } else {
            if (d.hasData) {
                for (int i = 0; i < keys.length; i++) {
                    applyCell(rv, ctx, i, keys, labels, d, now);
                }
            } else {
                for (int i = 0; i < keys.length; i++) {
                    int cid = ctx.getResources().getIdentifier("wC" + i, "id", ctx.getPackageName());
                    int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
                    int tid = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
                    rv.setTextViewText(kid, labels[i]);
                    rv.setTextViewText(tid, "—");
                    rv.setInt(cid, "setBackgroundResource", R.drawable.widget_cell);
                    rv.setTextColor(kid, C_LABEL);
                    rv.setTextColor(tid, C_TIME);
                }
            }
            finishRender(rv, ctx, d, now);
        }

        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rv.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(ids, rv);
    }

    /* ------------------------------ tick ------------------------------ */

    public static void saveData(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_WIDGET, json).apply();
        tick(ctx);
    }

    public static void tick(Context ctx) {
        SolatWidget.updateAll(ctx);
        try { SolatWidgetCompact.updateAll(ctx); } catch (Exception ignored) {}
        try { SolatWidgetSimple.updateAll(ctx); } catch (Exception ignored) {}
        try { SummaryNotif.update(ctx); } catch (Exception ignored) {}
        ensureTick(ctx);
    }

    public static void ensureTick(Context ctx) {
        boolean hasWidget = false;
        try {
            for (Class<?> c : new Class<?>[]{ SolatWidget.class, SolatWidgetCompact.class, SolatWidgetSimple.class }) {
                AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
                int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, c));
                if (ids != null && ids.length > 0) { hasWidget = true; break; }
            }
        } catch (Exception ignored) {
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
        long next = now + (60000 - (now % 60000)) + 50;
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

    /* ----------------------- instance callbacks ----------------------- */

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
        ensureTick(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TICK.equals(action)) {
            tick(ctx);
        } else if (SummaryNotif.ACTION_HIDE.equals(action)) {
            SummaryNotif.setOn(ctx, false);
        }
    }

    /* --------------------------- helpers --------------------------- */

    public static void updateAll(Context ctx) {
        // subclasses override
    }

    protected static String labelOf(String key) {
        String[] allKeys = { "imsak", "fajr", "syuruk", "dhuha", "dhuhr", "asr", "maghrib", "isha" };
        String[] allLabels = { "Imsak", "Subuh", "Syuruk", "Duha", "Zohor", "Asar", "Maghrib", "Isyak" };
        for (int i = 0; i < allKeys.length; i++) {
            if (allKeys[i].equals(key)) return allLabels[i];
        }
        return key;
    }

    protected static String hhmm(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.US).format(new Date(ms));
    }

    protected static String shortCd(long ms) {
        if (ms < 0) ms = 0;
        long s = ms / 1000;
        long h = s / 3600; s -= h * 3600;
        long m = s / 60;
        if (h > 0) return h + "j " + m + "m";
        if (m > 0) return m + " min";
        return "<1 min";
    }
}
