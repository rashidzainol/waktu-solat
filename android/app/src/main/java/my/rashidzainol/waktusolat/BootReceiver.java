package my.rashidzainol.waktusolat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Selepas peranti dibuka semula, jadualkan semula alarm waktu solat tersimpan. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            PrayerAlarms.rescheduleFromBoot(ctx);
        }
    }
}
