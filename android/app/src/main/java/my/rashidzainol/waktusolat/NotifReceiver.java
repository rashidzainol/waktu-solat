package my.rashidzainol.waktusolat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/**
 * Menerima alarm dari AlarmManager pada setiap waktu solat
 * dan memaparkan notifikasi dengan bunyi.
 */
public class NotifReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "my.rashidzainol.waktusolat.FIRE";
    public static final String ACTION_MAINTAIN = "my.rashidzainol.waktusolat.MAINTAIN";

    public static final String CHANNEL_ID = "waktu_solat_v2";
    private static final String LEGACY_CHANNEL_ID = "waktu_solat";

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
            b = new Notification.Builder(ctx, CHANNEL_ID);
        } else {
            b = new Notification.Builder(ctx);
            b.setPriority(Notification.PRIORITY_HIGH);
            b.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
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
         .setContentIntent(pi);

        int id = 1001 + Math.abs((key == null ? label : key).hashCode() % 50);
        try {
            nm.notify(id, b.build());
        } catch (Exception ignored) {
        }
    }

    /** Cipta/channel notifikasi dengan keutamaan tinggi & bunyi. */
    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Saluran lama (versi sebelum pembetulan) dibuang supaya tetapan
        // tersekat/senyap tidak diwarisi.
        try { nm.deleteNotificationChannel(LEGACY_CHANNEL_ID); } catch (Exception ignored) {}

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Waktu Solat", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Notifikasi masuk waktu solat");
        ch.enableLights(true);
        ch.setLightColor(0xFF34D399);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 250, 180, 250});
        ch.setShowBadge(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        ch.setSound(sound, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());

        nm.createNotificationChannel(ch);
    }
}
