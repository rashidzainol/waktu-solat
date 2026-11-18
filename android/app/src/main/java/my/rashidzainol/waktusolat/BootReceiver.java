package my.rashidzainol.waktusolat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Jadualkan semula alarm waktu solat selepas peranti dibuka, app dikemas kini,
 * atau masa/zon masa peranti berubah.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            PrayerAlarms.reschedule(ctx);
        }
    }
}
