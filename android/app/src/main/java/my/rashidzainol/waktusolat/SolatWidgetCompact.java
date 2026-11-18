package my.rashidzainol.waktusolat;

import android.content.Context;

/**
 * Widget homescreen varian "Ringkas" — 5 waktu utama: Subuh, Zohor, Asar,
 * Maghrib, Isyak. Lebih padat, satu baris.
 */
public class SolatWidgetCompact extends SolatWidgetBase {

    private static final String[] KEYS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };
    private static final String[] LABELS = { "Subuh", "Zohor", "Asar", "Maghrib", "Isyak" };

    public SolatWidgetCompact() {
    }

    public static void updateAll(Context ctx) {
        renderVariant(ctx, SolatWidgetCompact.class, R.layout.widget_solat_compact, KEYS, LABELS, false);
    }
}
