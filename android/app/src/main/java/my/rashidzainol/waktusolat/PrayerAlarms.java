package my.rashidzainol.waktusolat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Jadual & simpan alarm waktu solat.
 *
 * JavaScript (ui.js) mengira waktu solat dan menghantar senarai
 * [{"key":"fajr","label":"Subuh","ms":1763...}] melalui jambatan AndroidNotif.
 * Senarai itu disimpan dalam SharedPreferences supaya boleh dijadualkan
 * semula selepas reboot (BootReceiver) atau selepas notifikasi ditembak.
 */
public final class PrayerAlarms {

    private static final String PREFS = "waktu-solat";
    private static final String KEY_EVENTS = "events";
    private static final int MAX_ALARMS = 64;

    private PrayerAlarms() {}

    /** Simpan senarai acara & jadualkan alarm. json = "[]" untuk membatalkan semua. */
    public static void apply(Context ctx, String json) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putString(KEY_EVENTS, json == null ? "[]" : json).apply();
        scheduleAll(ctx, json == null ? "[]" : json);
    }

    /** Baca senarai tersimpan dan buang yang sudah lepas, kemudian jadual semula. */
    public static void rescheduleAfter(Context ctx, long firedAt) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray in = new JSONArray(p.getString(KEY_EVENTS, "[]"));
            JSONArray out = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < in.length(); i++) {
                JSONObject e = in.getJSONObject(i);
                if (e.optLong("ms", 0) > now) out.put(e);
            }
            String json = out.toString();
            p.edit().putString(KEY_EVENTS, json).apply();
            scheduleAll(ctx, json);
        } catch (Exception ignored) {
        }
    }

    /** Reschedule selepas reboot: simpan acara masa hadapan sahaja. */
    public static void rescheduleFromBoot(Context ctx) {
        rescheduleAfter(ctx, 0);
    }

    private static void scheduleAll(Context ctx, String json) {
        cancelPending(ctx);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length() && i < MAX_ALARMS; i++) {
                JSONObject e = arr.getJSONObject(i);
                long ms = e.optLong("ms", 0);
                String key = e.optString("key", "waktu");
                String label = e.optString("label", "Waktu Solat");
                if (ms <= System.currentTimeMillis()) continue;

                Intent it = new Intent(ctx, NotifReceiver.class);
                it.setAction(NotifReceiver.ACTION_FIRE);
                it.putExtra("key", key);
                it.putExtra("label", label);
                it.putExtra("ms", ms);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
                PendingIntent pi = PendingIntent.getBroadcast(ctx, i, it, flags);

                boolean exact;
                if (Build.VERSION.SDK_INT >= 31) {
                    exact = am.canScheduleExactAlarms();
                } else {
                    exact = true;
                }
                if (exact) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                }
            }
        } catch (Exception ignored) {
        }
    }

    /** Batalkan semua alarm tertunda (dipanggil dengan Context). */
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
    }
}
