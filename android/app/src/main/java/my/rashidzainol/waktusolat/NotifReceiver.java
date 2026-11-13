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
    public static final String CHANNEL_ID = "waktu_solat";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;

        String key = intent.getStringExtra("key");
        String label = intent.getStringExtra("label");
        long ms = intent.getLongExtra("ms", 0);
        if (label == null || label.isEmpty()) label = "Waktu Solat";

        notifyPrayer(ctx, label, ms);

        // Jadual semula baki acara (hari esok) supaya berterusan tanpa buka app.
        PrayerAlarms.rescheduleAfter(ctx, ms);
    }

    private void notifyPrayer(Context ctx, String label, long ms) {
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= 26) {
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Waktu Solat", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Notifikasi masuk waktu solat");
            ch.enableLights(true);
            ch.enableVibration(true);
            ch.setSound(sound, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            nm.createNotificationChannel(ch);
        }

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
         .setAutoCancel(true)
         .setContentIntent(pi);

        try {
            nm.notify(1001, b.build());
        } catch (Exception ignored) {
        }
    }
}
