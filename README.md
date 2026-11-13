# Waktu Solat & Kiblat

Apl web (PWA) untuk waktu solat dan arah kiblat — untuk kegunaan peribadi.

- **Waktu solat diambil bulat-bulat daripada data rasmi JAKIM (e-Solat)** —
  tiada pengiraan, tiada pelarasan, tiada tetapan kaedah. Papar seperti diterbitkan.
- **60 zon rasmi JAKIM** seluruh Malaysia dibenamkan dalam app (setahun penuh),
  jadi berfungsi **tanpa internet**. Data boleh dikemas kini dalam talian.
- Masa sentiasa **MYT (UTC+8)** seperti terbitan JAKIM.
- **Kiblat auto** daripada GPS, dan **kiblat manual** — taip bearing sendiri
  (contoh `292° 30′`). Kompas dengan pembetulan offset.
- **3 tema**: Gelap, Terang, Minimalis.
- **APK Android** (WebView offline) untuk telefon, tablet & Android TV melalui
  GitHub Actions, atau dipasang sebagai PWA.

---

## Logo & ikon

Logo diambil daripada `logo` asal (seni masjid "Waktu Solat") dan diproses melalui
`make-icons.ps1` menjadi:

- `icon-192.png` / `icon-512.png` — ikon PWA & favicon (penjuru bulat).
- `icon-maskable-512.png` — varian maskable untuk launcher Android (kandungan 78%).
- `android/.../mipmap-*/ic_launcher.png` — ikon launcher pada semua kepadatan (mdpi–xxxhdpi).

Untuk menukar logo pada masa depan, simpan logo baharu dan jalankan:

```
powershell -ExecutionPolicy Bypass -File make-icons.ps1 C:\path\ke\logo.jpg
```

---

## Struktur fail

```
waktu-solat/
├─ index.html            # markup
├─ app.css               # gaya + 3 tema
├─ js/jakim-data.js      # data rasmi JAKIM 2026 (60 zon × 365 hari)
├─ js/core.js            # zon JAKIM, carian data, bearing kiblat, takwim
├─ js/compass.js         # bacaan sensor → heading
├─ js/ui.js              # paparan, navigasi, tetapan, tema
├─ manifest.webmanifest  # metadata PWA
├─ sw.js                 # cache offline
├─ gen-jakim-data.ps1    # jana jakim-data.js dari API e-Solat
├─ icon-192.png
├─ icon-512.png
├─ icon-maskable-512.png
├─ make-icons.ps1        # jana semua ikon drpd logo (PWA + launcher Android)
├─ dev-server.ps1        # server ujian untuk PC
├─ android/              # projek APK (WebView, aset offline)
├─ .github/workflows/    # bina APK automatik di GitHub
└─ README.md
```

---

## Data JAKIM (e-Solat)

Waktu solat **bukan hasil pengiraan**. Ia dibaca terus dari jadual rasmi
JAKIM (e-Solat) dan dipaparkan **bulat-bulat** seperti diterbitkan:

- **60 zon rasmi** (WLY01, SGR01, JHR02, …) — pilih di **Tetapan → Zon JAKIM**.
- **Setahun penuh** dibenamkan dalam app (`js/jakim-data.js`, jana dari API
  e-Solat dengan `gen-jakim-data.ps1`), jadi app berfungsi **100% luar talian**.
- Apabila JAKIM menerbitkan tahun baharu, tekan **Tetapan → Data JAKIM →
  Kemas kini sekarang** (perlu internet sekali; data disimpan pada peranti).
- Semua masa dipaparkan dalam **MYT (UTC+8)** mengikut konvensyen JAKIM.

---

## Takwim Hijri

Kalendar Hijri dalam apl ini **bukan** anggaran Umm al-Qura. Ia menggunakan
**takwim rasmi JAKIM (Imkanur Rukyah)** — kriteria hilal MABIMS (tinggi ≥ 3°,
elongasi ≥ 6.4°).

Jadual tarikh 1hb setiap bulan (1446H–1451H) dibina daripada data e-Solat JAKIM
dan **dibenamkan dalam apl**, jadi semakan tarikh tetap berfungsi tanpa internet.
Julat yang dilindungi ialah **7 Julai 2024 hingga 31 Disember 2029**.
(Takwim rasmi JAKIM diterbitkan hingga 2028; bulan-bulan 2029 ialah sambungan
anggaran mengikut kitaran takwim yang sama.)

Contoh yang disemak:

| Tarikh | Hijri |
|--------|-------|
| 17 Jun 2026 | 1 Muharam 1448 (Awal Muharam) |
| 25 Ogos 2026 | 12 Rabiulawal 1448 (Maulidur Rasul) |
| 6 Nov 2026 | 26 Jamadilawal 1448 |
| 8 Feb 2027 | 1 Ramadan 1448 |
| 10 Mac 2027 | 1 Syawal 1448 |
| 28 Jan 2028 | 1 Ramadan 1449 |
| 25 Mei 2028 | 1 Muharam 1450 |

Di luar julat itu apl kembali kepada anggaran Umm al-Qura. Jika takwim tempatan
anda berbeza sehari, gunakan **Tetapan → Hijri** (−1 / +1 hari).

---

## Tema

Tiga tema boleh dipilih di **Tetapan → Paparan → Tema**:

- **Gelap** — lalai, latar hijau-hitam seperti asal.
- **Terang** — latar cerah dengan aksen hijau.
- **Minimalis** — putih/kelabu rata, aksen hitam, tanpa gradien atau glow.

Pilihan disimpan dalam peranti, dan dalam versi APK warna status/navigation bar
turut bertukar mengikut tema.

---

## Kiblat

**Auto** — bearing bulatan besar dari koordinat GPS anda ke Kaabah
(21.4225° N, 39.8262° E). Untuk Kuala Lumpur hasilnya **292° 32′**.

**Manual** — masukkan sendiri nilai bearing yang anda mahu (contoh dari
ukuran bangunan). Apl akan menggunakan nilai itu sebagai sasaran kompas,
dan memaparkan beza dengan kiraan GPS supaya anda boleh semak.

```
Bearing manual: 293° 15′
Kiraan GPS untuk lokasi ini ialah 292° 32′ (beza 0.7°)
```

### Nota kompas

- Pegang telefon **mendatar** (skrin ke atas) dan jauhkan dari besi/elektronik.
- Kalibrasi dengan gerakan angka-8 jika arah nampak tersasar.
- Android merujuk **utara magnetik**. Deklinasi magnet di Malaysia < 1°, tetapi
  jika masih tersasar gunakan **Tetapan → Offset** (−20° … +20°).
- Kompas perlukan sambungan **https://** (atau `localhost`) dan kebenaran sensor.

---

## Jalankan di PC

```powershell
cd waktu-solat
powershell -ExecutionPolicy Bypass -File .\dev-server.ps1 -Port 8080
```

Buka `http://localhost:8080`.

> GPS dan kompas tidak akan berfungsi di PC (tiada sensor), tetapi waktu solat
> dan semua tetapan boleh diuji.

---

## Pasang di telefon

GPS dan kompas memerlukan **https://**. Paling mudah guna hosting statik percuma.

### GitHub Pages

1. Cipta akaun GitHub (jika belum ada) dan repo baru, contoh `waktu-solat` (public).
2. Muat naik **semua fail** dalam folder ini ke repo tersebut (kekalkan struktur folder).
3. Repo → **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)` → Save**.
4. Tunggu ~1 minit, buka `https://<nama-anda>.github.io/waktu-solat/`.

### Netlify Drop

1. Buka <https://app.netlify.com/drop>.
2. Seret **folder** `waktu-solat` ke halaman itu.
3. Dapat URL https serta-merta.

### Selepas dibuka di telefon

- Chrome Android: menu **⋮ → Add to Home screen / Install app**.
- Safari iOS: **Share → Add to Home Screen**.
- Benarkan **lokasi** dan **kompas** apabila diminta.

Selepas dipasang, apl berfungsi **offline** (service worker menyimpan semua fail).

---

## Bina APK Android

Projek APK sudah siap dalam folder `android/`. Ia membungkus app web ini dalam
WebView dan membaca fail dari dalam APK, jadi berfungsi **tanpa internet**.
GPS dan kompas tetap berfungsi (dengan kebenaran pengguna).

### Cara paling mudah: GitHub Actions

Mesin ini tiada Android SDK, jadi APK dibina di GitHub (percuma):

1. Cipta repo GitHub (contoh `waktu-solat`) dan muat naik **seluruh folder** ini.
2. Buka tab **Actions** → workflow **Build Android APK** → **Run workflow**.
3. Selepas ~3–5 minit, buka run yang selesai → **Artifacts** → muat turun
   `waktu-solat-apk.zip`.
4. Extract → `app-debug.apk` → pindahkan ke telefon → buka → benarkan
   **Install unknown apps** → Install.

Setiap kali `index.html`, `js/`, `app.css` atau `android/` di-push, APK baru
dibina automatik. Fail web disalin ke dalam APK semasa build, jadi tiada
penduaan fail yang perlu dijaga.

### Bina sendiri (jika ada Android Studio)

Buka folder `android/` dalam Android Studio, tunggu Gradle sync, kemudian
**Build → Build Bundle(s)/APK(s) → Build APK(s)**. Fail keluar di
`android/app/build/outputs/apk/debug/app-debug.apk`.

> APK ini menggunakan debug signing — sesuai untuk kegunaan peribadi. Untuk
> diedarkan di Play Store, perlu keystore release sendiri.

---

## Android TV / Google TV

> **Pra-tonton:** buka [demo-tv.html](https://rashidzainol.github.io/waktu-solat/demo-tv.html)
> untuk melihat mock paparan Mod Jam di TV — jam hidup, togol gaya, dan
> simulasi notifikasi azan.

APK yang sama boleh dipasang terus pada Android TV & Google TV:

1. Bina/muat turun APK seperti di atas (`app-debug.apk`).
2. Pindahkan ke TV — gunakan **Send Files to TV**, **Downloader**, atau USB.
3. Buka fail APK dengan pelayar fail TV → benarkan *Install unknown apps* → Install.
4. App muncul di launcher TV (tiada sentuhan diperlukan; guna remote).

Ciri untuk TV:

- **Mod Jam** — paparan jam besar + waktu solat seterusnya + kira detik,
  sesuai dibiarkan hidup sepanjang hari (skrin tidak akan tidur).
  Dua gaya: **Lengkap** dan **Minimalis** (Tetapan → Paparan → Gaya jam).
- **Notifikasi waktu solat** — notifikasi + bunyi pada setiap waktu
  (Tetapan → TV & Notifikasi). Berterusan selepas reboot.
- **Navigasi remote** — anak panah untuk gerak fokus, OK untuk pilih,
  butang Back keluar dari Mod Jam.
- TV tidak ada GPS — tetapkan lokasi di **Tetapan → Lokasi** (pilih bandar
  atau masukkan koordinat sendiri). Kompas tidak berfungsi di TV.

---

## Widget homescreen (telefon & tablet)

> **Pra-tonton:** buka [demo-widget.html](https://rashidzainol.github.io/waktu-solat/demo-widget.html)
> untuk melihat mock widget 4×2 di homescreen telefon — kira detik hidup dan
> simulasi notifikasi azan.

Satu APK untuk semua peranti — Android TV, Google TV, telefon dan tablet.

Pada telefon/tablet, **tekan lama pada homescreen → Widgets → Waktu Solat**
untuk menambah widget 4×2 yang menunjukkan:

- Waktu seterusnya dengan kira detik (dikemas kini setiap minit)
- Grid 8 waktu hari ini: Imsak, Subuh, Syuruk, Duha, Zohor, Asar, Maghrib, Isyak
- Klik widget untuk buka app

Widget dikemas kini oleh app; buka app sekali selepas pasang untuk memuatkan
waktu pertama. Tablet menggunakan paparan landskap/potret mengikut cara
peranti dipegang.

---

## Kredit

© 2026 **Rashid Zainol** · <https://github.com/rashidzainol>

---

## Privasi

Waktu solat dibaca dari data rasmi JAKIM yang dibenam dalam app — tiada data
dihantar ke mana-mana pelayan semasa kegunaan biasa. Kemas kini data (pilihan)
memuat turun jadual dari e-Solat JAKIM sahaja. Tetapan disimpan dalam
`localStorage` peranti.
