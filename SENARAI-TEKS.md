# Senarai teks / butang app (untuk semakan & ubah suai)

Ubah ayat yang diingini. Yang tidak diubah = kekal seperti sedia ada.
Perubahan boleh diberitahu semula (contoh: "tukar X kepada Y").

## Topbar
- Brand tajuk: "Waktu Solat"
- Lencana kemas kini: "Baharu" (muncul bila ada versi baharu)
- Butang loceng: "Status notifikasi"
- Butang Mod Jam: "Mod Jam (paparan TV)"
- Label lokasi: "Waktu Solat" (default)

## Tab navigasi
- "Waktu"
- "Jam"
- "Kiblat"
- "Tetapan"

## View: Waktu solat
- Hero eyebrow: "Seterusnya"
- Hero nama waktu: "-"
- Hero masa: "--:--"
- "Lagi" + kiraan
- Tarikh (hari), Hijri
- Chip zon: (kod zon)
- Daybar kiri: "Selepas ..." / "Sebelum ..."
- Daybar kanan: "MYT"
- Nota kiraan: (kosong / teks dinamik)

## View: Mod Jam (TV)
- Masa besar: "--:--"
- Tarikh
- "Seterusnya" + nama waktu + "esok"
- "pada" + masa
- Kiraan
- Grid waktu
- Nota jam
- Butang: "Kembali ke Waktu Solat"

## View: Kiblat
- Tajuk besar: "-" (darjah)
- "Arah kiblat dari lokasi anda"
- Status kompas: "Menyemak sensor kompas."
- Butang: "Aktifkan kompas"
- "Jarak ke Kaabah" / nilai
- "Beza dengan telefon" / nilai
- Segmen: "Auto" / "Manual"
- Butang: "Guna GPS"
- Input darjah/minit + unit ° / '
- Hint: "Contoh: 292° 30'"
- Nota kiblat

## View: Tetapan
### Zon JAKIM
- "Ikut lokasi GPS" / "Zon dipilih automatik daripada lokasi peranti"
- "Zon waktu solat" / "Ikut zon rasmi e-Solat JAKIM"
- Butang: "Kemas kini lokasi"
- Nota zon: "Zon dipilih sendiri: ..." / "Menunggu lokasi GPS..." / "Ikut GPS: zon ..."

### Notifikasi (telefon sahaja)
- "Notifikasi waktu solat" / "Notifikasi & bunyi pada setiap waktu (APK Android)"
- Status: "Menyemak kebenaran notifikasi…"
- "Waktu yang berbunyi" / "Pilih waktu yang anda mahu dimaklumkan"
- Cip waktu: Subuh, Zohor, Asar, Maghrib, Isyak
- "Bunyi notifikasi" / "Nada penggera peranti, atau loceng lembut bawaan app"
- Cip bunyi: "Nada penggera" / "Loceng"
- Butang: "Tetapan bunyi/kelantangan Android"
- "Ringkasan di notifikasi" / "Notifikasi senyap: waktu hari ini & kiraan detik (boleh ditutup)"
- Butang: "Uji notifikasi" / "Benarkan"
- Panduan pop-up (details): "Notis tidak muncul di skrin? Benarkan pop-up"

### Data & Kemas kini
- "Kemas kini data" / "Muat turun data terkini untuk zon ini"
- Butang: "Kemas kini sekarang"
- "Versi app" / "Menyemak versi terkini…"
- Butang: "Semak kemas kini" / "Kemas kini sekarang"
- Hint: "Jika pemasang Android berkata “package conflict”, nyahpasang app lama sekali, kemudian pasang APK ini."

### Kiblat
- "Mod bearing" / "Auto = GPS · Manual = nilai bearing di atas"
- Pilihan: "Auto" / "Manual"
- "Bearing manual" / "Guna nilai ini apabila mod Manual"
- "Offset" / "Betulkan jika anak panah tersasar"

### Paparan
- "Tema" / "Terang · Minimalis · Gelap"
- Butang tema: "Terang" / "Minimalis" / "Gelap"
- "Gaya jam" / "Paparan Mod Jam di TV"
- Pilihan: "Lengkap" / "Minimalis"
- "Buka Mod Jam terus" / "Paparan jam dulu semasa app dibuka (sesuai untuk TV)"
- Pilihan: "Ya" / "Tidak"

### Lain-lain
- Butang: "Pasang di Android"
- Butang: "Set semula semua tetapan"
- Kredit: "© 2026 Rashid Zainol" + link GitHub

## Toast / mesej (pilih contoh)
- "Notifikasi waktu solat dihidupkan" / "Notifikasi dimatikan"
- "Notifikasi hanya tersedia dalam app Android (APK)."
- "Notifikasi aktif untuk X waktu sehari."
- "Kebenaran notifikasi belum dibenarkan — notifikasi tidak akan keluar."
- "Notifikasi disekat dalam tetapan Android."
- "Bunyi dimatikan dalam tetapan Android — notis keluar senyap."
- "Nada penggera dipilih" / "Loceng dipilih"
- "Ringkasan notifikasi dihidupkan" / "dimatikan"
- "Ringkasan notifikasi hanya tersedia dalam app Android"
- "Versi baharu vX tersedia" / "App sudah terkini"
- "Gagal semak kemas kini"
- "Zon ikut lokasi: ..." / "Zon dipilih sendiri"
- "GPS hanya berfungsi pada https:// atau localhost"
- "Peranti ini tiada sokongan GPS"
- "Data JAKIM dikemas kini" / "Gagal kemas kini: ..."
- "Data terkini dimuat (X hari)."
- "Zon: ..." / "Zon akan ikut lokasi GPS"

## Status notifikasi (dalam UI)
- "Menyemak kebenaran notifikasi…"
- "Notifikasi dimatikan."
- "Tiada waktu dipilih — notifikasi tidak akan berbunyi."
- "Notifikasi aktif untuk X waktu · masa mungkin lewat sedikit pada peranti ini."
- "Notifikasi aktif untuk X waktu sehari."

## Notifikasi Android (Java)
- Tajuk saluran bunyi: "Waktu Solat (nada penggera)" / "Waktu Solat (loceng)"
- Tajuk saluran ringkasan: "Ringkasan waktu solat"
- Tindakan: "Sembunyi"
- Notifikasi azan: (nama waktu) + "Waktu ... telah masuk · HH:MM"
- Ringkasan notifikasi: "Seterusnya X · HH:MM · lagi Y"

## Widget homescreen
- Tajuk: "Waktu Solat"
- "Seterusnya: ..." / "pada HH:MM · lagi X"
- "Buka app untuk muat waktu"
- "Waktu hari ini tamat"

## Mod Jam (nota)
- "Data rasmi JAKIM e-Solat ..." (dibuang; kekal kosong)

---
Beritahu ayat mana nak tukar (contoh: "tukar 'Uji notifikasi' kepada 'Test notif'"). Yang tak disebut kekal.
