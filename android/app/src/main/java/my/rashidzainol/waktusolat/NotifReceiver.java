package my.rashidzainol.waktusolat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/**
 * Menerima alarm dari AlarmManager pada setiap waktu solat
 * dan memaparkan notifikasi dengan bunyi.
 *
 * Dua saluran notifikasi disediakan kerana tetapan saluran tidak boleh
 * diubah selepas dicipta:
 *   - CHANNEL_ALARM: nada penggera peranti (lalai, paling kuat)
 *   - CHANNEL_CHIME: loceng lembut bawaan app
 * Kedua-duanya guna strim ALARM supaya tetap berbunyi walaupun telefon
 * dalam mod senyap/getar, dan dibenarkan semasa "Jangan ganggu".
 */
public class NotifReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "my.rashidzainol.waktusolat.FIRE";
    public static final String ACTION_MAINTAIN = "my.rashidzainol.waktusolat.MAINTAIN";

    /** Saluran v3 — loceng lembut bawaan app. */
    public static final String CHANNEL_CHIME = "waktu_solat_v3";
    /** Saluran v3 — bunyi penggera peranti. */
    public static final String CHANNEL_ALARM = "waktu_solat_v3_alarm";

    /** Saluran versi lama: dibuang supaya tetapan senyap lama tidak diwarisi. */
    private static final String[] LEGACY_CHANNELS = {"waktu_solat", "waktu_solat_v2"};

    public static final String SOUND_CHIME = "chime";
    public static final String SOUND_ALARM = "alarm";

    private static final String PREFS = "waktu-solat";
    private static final String KEY_SOUND = "notifSound";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_FIRE.equals(action)) {
            String key = intent.getStringExtra("key");
            String label = intent.getStringExtra("label");
            long ms = intent.getLongExtra("ms", 0);
            if (label == null || label.isEmpty()) label = "Waktu Solat";

            show(ctx, label, ms, key);
            PrayerAlarms.reschedule(ctx);
            // Waktu seterusnya berubah → kemas kini ringkasan notifikasi.
            try { SummaryNotif.update(ctx); } catch (Exception ignored) {}
        } else if (ACTION_MAINTAIN.equals(action)) {
            // Penyelenggaraan harian: isi semula jadual & alarm seterusnya.
            PrayerAlarms.reschedule(ctx);
        }
    }

    /** Ujian dari UI: papar notifikasi serta-merta. */
    public static void showNow(Context ctx, String label) {
        if (label == null || label.isEmpty()) label = "Subuh";
        show(ctx, label, System.currentTimeMillis(), "test");
    }

    /* ------------------------------------------------------- pilihan bunyi */

    public static String soundKind(Context ctx) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            return SOUND_CHIME.equals(p.getString(KEY_SOUND, SOUND_ALARM))
                    ? SOUND_CHIME : SOUND_ALARM;
        } catch (Exception e) {
            return SOUND_ALARM;
        }
    }

    public static void setSoundKind(Context ctx, String kind) {
        String v = SOUND_ALARM.equals(kind) ? SOUND_ALARM : SOUND_CHIME;
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putString(KEY_SOUND, v).apply();
        } catch (Exception ignored) {
        }
        ensureChannel(ctx);
    }

    /** Saluran yang sedang digunakan untuk notifikasi. */
    public static String channelId(Context ctx) {
        return SOUND_ALARM.equals(soundKind(ctx)) ? CHANNEL_ALARM : CHANNEL_CHIME;
    }

    /**
     * @return true jika saluran aktif tidak disekat dan mempunyai bunyi.
     *         false bermaksud notifikasi akan keluar senyap (dimatikan pengguna).
     */
    public static boolean audible(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return true;
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        NotificationChannel ch = nm.getNotificationChannel(channelId(ctx));
        return ch != null
                && ch.getImportance() != NotificationManager.IMPORTANCE_NONE
                && ch.getSound() != null;
    }

    /* ---------------------------------------------------------- paparkan */

    private static void show(Context ctx, String label, long ms, String key) {
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        ensureChannel(ctx);

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                ctx, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String text = "Waktu " + label + " telah masuk";
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(ctx, channelId(ctx));
        } else {
            b = new Notification.Builder(ctx);
            b.setPriority(Notification.PRIORITY_MAX);
            Uri s = SOUND_ALARM.equals(soundKind(ctx)) ? alarmUri() : chimeUri(ctx);
            if (s != null) b.setSound(s, alarmAttributes());
            b.setVibrate(new long[]{0, 400, 250, 400});
        }

        b.setSmallIcon(R.drawable.ic_notif)
         .setContentTitle(label)
         .setContentText(text)
         .setStyle(new Notification.BigTextStyle().bigText(text))
         .setCategory(Notification.CATEGORY_ALARM)
         .setVisibility(Notification.VISIBILITY_PUBLIC)
         .setShowWhen(true)
         .setWhen(ms > 0 ? ms : System.currentTimeMillis())
         .setAutoCancel(true)
         .setOnlyAlertOnce(false)
         .setContentIntent(pi);

        int id = 1001 + Math.abs((key == null ? label : key).hashCode() % 50);
        try {
            nm.notify(id, b.build());
        } catch (Exception ignored) {
        }
    }

    /* ------------------------------------------------------------ saluran */

    /** Cipta/kemas kini saluran notifikasi (keutamaan tinggi + bunyi). */
    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Saluran lama (versi sebelum pembetulan) dibuang supaya tetapan
        // tersekat/senyap tidak diwarisi.
        for (String old : LEGACY_CHANNELS) {
            try { nm.deleteNotificationChannel(old); } catch (Exception ignored) {}
        }

        NotificationChannel chime = new NotificationChannel(
                CHANNEL_CHIME, "Waktu Solat (loceng)", NotificationManager.IMPORTANCE_HIGH);
        chime.setDescription("Notifikasi masuk waktu solat dengan loceng lembut");
        applyStyle(chime);
        chime.setSound(chimeUri(ctx), alarmAttributes());
        nm.createNotificationChannel(chime);

        NotificationChannel alarm = new NotificationChannel(
                CHANNEL_ALARM, "Waktu Solat (nada penggera)", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Notifikasi masuk waktu solat dengan nada penggera peranti");
        applyStyle(alarm);
        Uri alarmSound = alarmUri();
        if (alarmSound != null) alarm.setSound(alarmSound, alarmAttributes());
        nm.createNotificationChannel(alarm);

        // Saluran senyap untuk ringkasan waktu solat.
        try { SummaryNotif.ensureChannel(ctx); } catch (Exception ignored) {}
    }

    private static void applyStyle(NotificationChannel ch) {
        ch.enableLights(true);
        ch.setLightColor(0xFF34D399);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 400, 250, 400});
        ch.setShowBadge(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    }

    private static Uri chimeUri(Context ctx) {
        return Uri.parse("android.resource://" + ctx.getPackageName()
                + "/" + R.raw.notif_chime);
    }

    private static Uri alarmUri() {
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        return u;
    }

    /**
     * USAGE_ALARM menjadikan bunyi ikut kelantangan penggera dan tetap
     * berbunyi walaupun telefon dalam mod senyap/getar.
     */
    private static AudioAttributes alarmAttributes() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }
}
