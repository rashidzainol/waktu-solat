package my.rashidzainol.waktusolat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Jadual & simpan alarm waktu solat.
 *
 * JavaScript (ui.js) menghantar senarai acara 120 hari
 * ([{"key":"fajr","label":"Subuh","ms":1763...}]) melalui jambatan AndroidNotif.
 * Senarai penuh disimpan dalam SharedPreferences, dan Java menjadualkan
 * 64 alarm terdekat. Selepas setiap notifikasi, reboot, perubahan masa atau
 * kemas kini app, Java menjadualkan semula sendiri — jadi notifikasi tidak
 * putus walaupun app tidak dibuka.
 */
public final class PrayerAlarms {

    private static final String PREFS = "waktu-solat";
    private static final String KEY_EVENTS = "events";
    private static final int MAX_ALARMS = 64;
    private static final int MAINT_ID = 9999;
    private static final long KEEP_PAST_MS = 2L * 24 * 60 * 60 * 1000;

    private PrayerAlarms() {}

    /** Simpan senarai acara & jadualkan alarm. json = "[]" untuk membatalkan semua. */
    public static void apply(Context ctx, String json) {
        String clean = normalize(json);
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putString(KEY_EVENTS, clean).apply();

        NotifReceiver.ensureChannel(ctx);
        if (scheduleNearest(ctx)) scheduleMaintenance(ctx);
    }

    /** Jadualkan semula daripada senarai tersimpan (reboot / tukar masa / app dikemas kini). */
    public static void reschedule(Context ctx) {
        if (scheduleNearest(ctx)) scheduleMaintenance(ctx);
    }

    /** @return true jika ada alarm dijadualkan. */
    private static boolean scheduleNearest(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;

        cancelPending(ctx);

        long now = System.currentTimeMillis();
        List<JSONObject> events = loadEvents(ctx);
        if (events.isEmpty()) return false;

        int n = 0;
        for (int i = 0; i < events.size() && n < MAX_ALARMS; i++) {
            JSONObject e = events.get(i);
            long ms = e.optLong("ms", 0);
            if (ms <= now + 500) continue;

            Intent it = new Intent(ctx, NotifReceiver.class);
            it.setAction(NotifReceiver.ACTION_FIRE);
            it.putExtra("key", e.optString("key", "waktu"));
            it.putExtra("label", e.optString("label", "Waktu Solat"));
            it.putExtra("ms", ms);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi;
            try {
                pi = PendingIntent.getBroadcast(ctx, n, it, flags);
            } catch (Exception ex) {
                continue;
            }

            boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            try {
                if (exact) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                }
            } catch (SecurityException se) {
                try {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                } catch (Exception ignored) {
                }
            } catch (Exception ignored) {
            }
            n++;
        }

        // Buang acara lama supaya storan tidak membesar.
        prune(ctx, now - KEEP_PAST_MS);

        return n > 0;
    }

    /**
     * Alarm penyelenggaraan harian: pastikan jadual diisi semula walaupun
     * semua 64 alarm tertunda sudah habis atau peranti tidur lama.
     */
    public static void scheduleMaintenance(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent it = new Intent(ctx, NotifReceiver.class);
        it.setAction(NotifReceiver.ACTION_MAINTAIN);
        PendingIntent pi = PendingIntent.getBroadcast(
                ctx, MAINT_ID, it,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 10);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);

        try {
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(),
                    AlarmManager.INTERVAL_DAY, pi);
        } catch (Exception ignored) {
        }
    }

    /** Batalkan semua alarm notifikasi tertunda. */
    public static void cancelPending(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < MAX_ALARMS; i++) {
            Intent it = new Intent(ctx, NotifReceiver.class);
            it.setAction(NotifReceiver.ACTION_FIRE);
            int flags = PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, i, it, flags);
            if (pi != null) am.cancel(pi);
        }
        try {
            Intent it = new Intent(ctx, NotifReceiver.class);
            it.setAction(NotifReceiver.ACTION_MAINTAIN);
            PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, MAINT_ID, it,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) am.cancel(pi);
        } catch (Exception ignored) {
        }
    }

    /* ------------------------------------------------------------- dalaman */

    private static List<JSONObject> loadEvents(Context ctx) {
        List<JSONObject> out = new ArrayList<>();
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray arr = new JSONArray(p.getString(KEY_EVENTS, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject e = arr.optJSONObject(i);
                if (e != null && e.optLong("ms", 0) > 0) out.add(e);
            }
        } catch (Exception ignored) {
        }
        Collections.sort(out, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return Long.compare(a.optLong("ms", 0), b.optLong("ms", 0));
            }
        });
        return out;
    }

    private static String normalize(String json) {
        if (json == null) return "[]";
        try {
            JSONArray in = new JSONArray(json);
            List<JSONObject> list = new ArrayList<>();
            long now = System.currentTimeMillis();
            for (int i = 0; i < in.length(); i++) {
                JSONObject e = in.optJSONObject(i);
                if (e == null) continue;
                if (e.optLong("ms", 0) > now - KEEP_PAST_MS) list.add(e);
            }
            Collections.sort(list, new Comparator<JSONObject>() {
                @Override
                public int compare(JSONObject a, JSONObject b) {
                    return Long.compare(a.optLong("ms", 0), b.optLong("ms", 0));
                }
            });
            JSONArray out = new JSONArray();
            for (JSONObject e : list) out.put(e);
            return out.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    private static void prune(Context ctx, long before) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray in = new JSONArray(p.getString(KEY_EVENTS, "[]"));
            JSONArray out = new JSONArray();
            for (int i = 0; i < in.length(); i++) {
                JSONObject e = in.optJSONObject(i);
                if (e != null && e.optLong("ms", 0) >= before) out.put(e);
            }
            if (out.length() != in.length()) {
                p.edit().putString(KEY_EVENTS, out.toString()).apply();
            }
        } catch (Exception ignored) {
        }
    }
}
