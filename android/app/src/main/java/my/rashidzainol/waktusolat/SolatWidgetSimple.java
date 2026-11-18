package my.rashidzainol.waktusolat;

import android.content.Context;

/**
 * Widget homescreen varian "Simpel" — hanya waktu sekarang dan waktu seterusnya
 * dengan kiraan detik. Paling minimal.
 */
public class SolatWidgetSimple extends SolatWidgetBase {

    public SolatWidgetSimple() {
    }

    public static void updateAll(Context ctx) {
        renderVariant(ctx, SolatWidgetSimple.class, R.layout.widget_solat_simple, null, null, true);
    }
}
