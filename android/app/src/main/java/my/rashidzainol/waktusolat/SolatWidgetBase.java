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

public abstract class SolatWidgetBase extends AppWidgetProvider {

    public static final String ACTION_TICK = "my.rashidzainol.waktusolat.WIDGET_TICK";

    protected static final String PREFS = "waktu-solat";
    protected static final String KEY_WIDGET = "widget_data";
    protected static final int REQ_TICK = 2001;
    protected static final int REQ_OPEN = 2002;

    protected static final String[] PRAYERS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };

    public static final class Data {
        public String zone = "";
        public String hijri = "";
        public String theme = "dark";
        public boolean hasData = false;
        public String nextKey = null;
        public long nextMs = 0;
        public boolean nextTomorrow = false;
        public java.util.Map<String, Long> times = new java.util.HashMap<>();
    }

    public static final class Palette {
        public final int bgRes;
        public final int title;
        public final int zone;
        public final int date;
        public final int nextName;
        public final int nextInfo;
        public final int cellLabel;
        public final int cellTime;
        public final int dimLabel;
        public final int dimTime;
        public final int accent;
        public final int chipBg;
        public Palette(int bgRes, int title, int zone, int date, int nextName, int nextInfo,
                      int cellLabel, int cellTime, int dimLabel, int dimTime, int accent, int chipBg) {
            this.bgRes = bgRes; this.title = title; this.zone = zone; this.date = date;
            this.nextName = nextName; this.nextInfo = nextInfo; this.cellLabel = cellLabel;
            this.cellTime = cellTime; this.dimLabel = dimLabel; this.dimTime = dimTime;
            this.accent = accent; this.chipBg = chipBg;
        }
    }

    protected static Palette palette(String theme) {
        if ("light".equals(theme)) {
            return new Palette(R.drawable.widget_bg_light,
                    0xFF0C8F63, 0xFF52655C, 0xFF52655C, 0xFF14211B, 0xFF0C8F63,
                    0xFF52655C, 0xFF14211B, 0xFF9AAEA5, 0xFF8A9E95, 0xFF0C8F63, 0xFFE3EBE6);
        }
        if ("minimal".equals(theme)) {
            return new Palette(R.drawable.widget_bg_minimal,
                    0xFF111111, 0xFF555552, 0xFF555552, 0xFF111111, 0xFF111111,
                    0xFF555552, 0xFF111111, 0xFF9A9A96, 0xFF8A8A86, 0xFF111111, 0xFFE6E6E4);
        }
        return new Palette(R.drawable.widget_bg,
                0xFF34D399, 0xFF8BA39A, 0xFF8BA39A, 0xFFEAF3EF, 0xFF34D399,
                0xFF8BA39A, 0xFFEAF3EF, 0xFF63776F, 0xFFAFC2BA, 0xFF34D399, 0x14FFFFFF);
    }

    protected static Data loadData(Context ctx) {
        Data d = new Data();
        long now = System.currentTimeMillis();
        try {
            JSONObject data = new JSONObject(
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .getString(KEY_WIDGET, "{}"));
            d.zone = data.optString("city", "");
            d.theme = data.optString("theme", "dark");
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

    protected static void applyCell(RemoteViews rv, Context ctx, int i,
                                   String[] keys, String[] labels, Data d, Palette p, long now) {
        int cid = ctx.getResources().getIdentifier("wC" + i, "id", ctx.getPackageName());
        int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
        int tid = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
        String key = keys[i];
        long ms = d.times.containsKey(key) ? d.times.get(key) : 0;
        rv.setTextViewText(kid, labels[i]);
        rv.setTextViewText(tid, (d.hasData && ms > 0) ? hhmm(ms) : "—");

        boolean isNext = key.equals(d.nextKey) && !d.nextTomorrow;
        boolean isPast = d.hasData && ms > 0 && ms <= now;
        int nextRes = R.drawable.widget_cell_next;
        if ("light".equals(d.theme)) nextRes = R.drawable.widget_cell_next_light;
        else if ("minimal".equals(d.theme)) nextRes = R.drawable.widget_cell_next_minimal;
        rv.setInt(cid, "setBackgroundResource",
                isNext ? nextRes : R.drawable.widget_cell);
        rv.setTextColor(kid, isNext ? p.accent : isPast ? p.dimLabel : p.cellLabel);
        rv.setTextColor(tid, isNext ? p.accent : isPast ? p.dimTime : p.cellTime);
    }

    protected static void finishRender(RemoteViews rv, Context ctx, Data d, Palette p, long now) {
        int zid = ctx.getResources().getIdentifier("wZone", "id", ctx.getPackageName());
        int did = ctx.getResources().getIdentifier("wDate", "id", ctx.getPackageName());
        int nid = ctx.getResources().getIdentifier("wNextName", "id", ctx.getPackageName());
        int iid = ctx.getResources().getIdentifier("wNextInfo", "id", ctx.getPackageName());
        int tid = ctx.getResources().getIdentifier("wTitle", "id", ctx.getPackageName());
        if (tid != 0) rv.setTextColor(tid, p.title);
        if (zid != 0) {
            rv.setTextViewText(zid, d.zone);
            rv.setViewVisibility(zid, (d.zone == null || d.zone.isEmpty()) ? View.GONE : View.VISIBLE);
            rv.setTextColor(zid, p.zone);
            rv.setInt(zid, "setBackgroundColor", p.chipBg);
        }
        if (did != 0) {
            rv.setTextViewText(did, d.hasData ? d.hijri : "");
            rv.setTextColor(did, p.date);
        }
        if (d.hasData) {
            String nextName = d.nextKey != null
                    ? labelOf(d.nextKey) + (d.nextTomorrow ? " · esok" : "")
                    : null;
            if (nid != 0) {
                rv.setTextViewText(nid,
                        nextName != null ? "Seterusnya: " + nextName : "Waktu hari ini tamat");
                rv.setTextColor(nid, p.nextName);
            }
            if (iid != 0) {
                rv.setTextViewText(iid, d.nextMs > 0 ? "pada " + hhmm(d.nextMs) + " · lagi " + shortCd(d.nextMs - now) : "");
                rv.setTextColor(iid, p.nextInfo);
            }
        } else {
            if (nid != 0) {
                rv.setTextViewText(nid, "Buka app untuk muat waktu");
                rv.setTextColor(nid, p.nextName);
            }
            if (iid != 0) rv.setTextViewText(iid, "");
        }
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
        Palette p = palette(d.theme);

        rv.setInt(R.id.widgetRoot, "setBackgroundResource", p.bgRes);

        if (simpleMode) {
            int zid = ctx.getResources().getIdentifier("wZone", "id", ctx.getPackageName());
            int did = ctx.getResources().getIdentifier("wDate", "id", ctx.getPackageName());
            int clid = ctx.getResources().getIdentifier("wCurLabel", "id", ctx.getPackageName());
            int ctid = ctx.getResources().getIdentifier("wCurTime", "id", ctx.getPackageName());
            int nid = ctx.getResources().getIdentifier("wNextName", "id", ctx.getPackageName());
            int iid = ctx.getResources().getIdentifier("wNextInfo", "id", ctx.getPackageName());
            int tid = ctx.getResources().getIdentifier("wTitle", "id", ctx.getPackageName());
            if (tid != 0) rv.setTextColor(tid, p.title);
            if (zid != 0) {
                rv.setTextViewText(zid, d.zone);
                rv.setViewVisibility(zid, (d.zone == null || d.zone.isEmpty()) ? View.GONE : View.VISIBLE);
                rv.setTextColor(zid, p.zone);
                rv.setInt(zid, "setBackgroundColor", p.chipBg);
            }
            String curLabel = "—";
            String curTime = "—";
            if (d.hasData) {
                long best = 0; String bestKey = null;
                for (String k : PRAYERS) {
                    long ms = d.times.containsKey(k) ? d.times.get(k) : 0;
                    if (ms > 0 && ms <= now && ms >= best) {
                        best = ms; bestKey = k;
                    }
                }
                if (bestKey != null) {
                    curLabel = labelOf(bestKey);
                    curTime = hhmm(best);
                }
            }
            if (clid != 0) {
                rv.setTextViewText(clid, "Sekarang: " + curLabel);
                rv.setTextColor(clid, p.nextName);
            }
            if (ctid != 0) {
                rv.setTextViewText(ctid, curTime);
                rv.setTextColor(ctid, p.accent);
            }
            if (d.hasData) {
                String nextName = d.nextKey != null
                        ? labelOf(d.nextKey) + (d.nextTomorrow ? " · esok" : "")
                        : "—";
                if (nid != 0) {
                    rv.setTextViewText(nid, "Seterusnya: " + nextName);
                    rv.setTextColor(nid, p.nextName);
                }
                if (iid != 0) {
                    rv.setTextViewText(iid, d.nextMs > 0 ? "pada " + hhmm(d.nextMs) + " · lagi " + shortCd(d.nextMs - now) : "");
                    rv.setTextColor(iid, p.nextInfo);
                }
                if (did != 0) {
                    rv.setTextViewText(did, d.hijri);
                    rv.setTextColor(did, p.date);
                }
            } else {
                if (nid != 0) rv.setTextViewText(nid, "Buka app untuk muat waktu");
                if (iid != 0) rv.setTextViewText(iid, "");
                if (did != 0) rv.setTextViewText(did, "");
            }
        } else {
            if (d.hasData) {
                for (int i = 0; i < keys.length; i++) {
                    applyCell(rv, ctx, i, keys, labels, d, p, now);
                }
            } else {
                for (int i = 0; i < keys.length; i++) {
                    int cid = ctx.getResources().getIdentifier("wC" + i, "id", ctx.getPackageName());
                    int kid = ctx.getResources().getIdentifier("wK" + i, "id", ctx.getPackageName());
                    int tid2 = ctx.getResources().getIdentifier("wT" + i, "id", ctx.getPackageName());
                    rv.setTextViewText(kid, labels[i]);
                    rv.setTextViewText(tid2, "—");
                    rv.setInt(cid, "setBackgroundResource", R.drawable.widget_cell);
                    rv.setTextColor(kid, p.cellLabel);
                    rv.setTextColor(tid2, p.cellTime);
                }
            }
            finishRender(rv, ctx, d, p, now);
        }

        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rv.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(
                ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(ids, rv);
    }

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

    public static void updateAll(Context ctx) {
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
