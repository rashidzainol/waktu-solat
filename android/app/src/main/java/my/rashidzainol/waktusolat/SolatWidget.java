package my.rashidzainol.waktusolat;

import android.content.Context;

/**
 * Widget homescreen varian "Penuh" — 6 waktu: Subuh, Syuruk, Zohor, Asar,
 * Maghrib, Isyak. Menunjukkan zon, tarikh Hijri, waktu seterusnya + kiraan detik.
 */
public class SolatWidget extends SolatWidgetBase {

    private static final String[] KEYS = { "fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha" };
    private static final String[] LABELS = { "Subuh", "Syuruk", "Zohor", "Asar", "Maghrib", "Isyak" };

    public SolatWidget() {
    }

    public static void updateAll(Context ctx) {
        renderVariant(ctx, SolatWidget.class, R.layout.widget_solat, KEYS, LABELS, false);
    }
}
