/* ==========================================================================
   core.js — zon JAKIM, data waktu solat rasmi, kiblat, takwim
   ========================================================================== */
(function (global) {
  'use strict';

  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;

  var KAABA = { lat: 21.4225, lon: 39.8262 };

  // Waktu JAKIM diterbitkan dalam masa Malaysia (UTC+8), sentiasa.
  var MYT_MINUTES = 8 * 60;

  /* ---------------------------------------------------------------- utils */

  function wrap360(a) { return ((a % 360) + 360) % 360; }
  function wrap180(a) { a = wrap360(a); return a > 180 ? a - 360 : a; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* --------------------------------------------------------- zon JAKIM */

  /*
   * `pts` = titik rujukan [lat, lon] bagi setiap zon. Zon yang luas diberi
   * beberapa titik (contoh JHR02: Johor Bahru, Kota Tinggi, Mersing, Kulai)
   * supaya zon terdekat lebih tepat. `isl` = jejari maksimum (km) bagi zon
   * pulau — jika lebih jauh, zon darat berdekatan yang dipilih. `auto:false`
   * = zon kecil/khas (puncak gunung, kampung khas) yang tidak dipilih
   * secara automatik.
   */
  var ZONES = [
    { code: 'WLY01', state: 'Wilayah Persekutuan', name: 'Kuala Lumpur, Putrajaya',
      pts: [[3.139, 101.687], [2.926, 101.696]] },
    { code: 'WLY02', state: 'Wilayah Persekutuan', name: 'Labuan',
      pts: [[5.283, 115.231]], isl: 12 },
    { code: 'JHR01', state: 'Johor', name: 'Pulau Aur dan Pulau Pemanggil',
      pts: [[2.450, 104.520], [2.420, 104.560]], isl: 16 },
    { code: 'JHR02', state: 'Johor', name: 'Johor Bahru, Kota Tinggi, Mersing, Kulai',
      pts: [[1.493, 103.741], [1.738, 103.900], [2.430, 103.840], [1.663, 103.600]] },
    { code: 'JHR03', state: 'Johor', name: 'Kluang, Pontian',
      pts: [[2.030, 103.318], [1.490, 103.390]] },
    { code: 'JHR04', state: 'Johor', name: 'Batu Pahat, Muar, Segamat, Gemas Johor, Tangkak',
      pts: [[1.850, 102.930], [2.045, 102.570], [2.510, 102.810], [2.270, 102.540]] },
    { code: 'KDH01', state: 'Kedah', name: 'Kota Setar, Kubang Pasu, Pokok Sena',
      pts: [[6.118, 100.367], [6.350, 100.420], [6.170, 100.520]] },
    { code: 'KDH02', state: 'Kedah', name: 'Kuala Muda, Yan, Pendang',
      pts: [[5.647, 100.488], [5.800, 100.370], [5.990, 100.480]] },
    { code: 'KDH03', state: 'Kedah', name: 'Padang Terap, Sik',
      pts: [[6.250, 100.650], [5.830, 100.750]] },
    { code: 'KDH04', state: 'Kedah', name: 'Baling',
      pts: [[5.676, 100.917]] },
    { code: 'KDH05', state: 'Kedah', name: 'Bandar Baharu, Kulim',
      pts: [[5.365, 100.560], [5.130, 100.560]] },
    { code: 'KDH06', state: 'Kedah', name: 'Langkawi',
      pts: [[6.350, 99.800]], isl: 16 },
    { code: 'KDH07', state: 'Kedah', name: 'Puncak Gunung Jerai',
      pts: [[5.788, 100.433]], auto: false },
    { code: 'KTN01', state: 'Kelantan', name: 'Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai',
      pts: [[6.125, 102.238], [5.530, 102.200], [5.830, 102.400], [6.200, 102.170]] },
    { code: 'KTN02', state: 'Kelantan', name: 'Gua Musang (Galas, Bertam), Jeli, Lojing',
      pts: [[4.884, 101.969], [5.700, 101.840], [4.700, 101.600]] },
    { code: 'MLK01', state: 'Melaka', name: 'Seluruh Negeri Melaka',
      pts: [[2.190, 102.250], [2.380, 102.210], [2.310, 102.430]] },
    { code: 'NGS01', state: 'Negeri Sembilan', name: 'Tampin, Jempol',
      pts: [[2.470, 102.230], [2.820, 102.400]] },
    { code: 'NGS02', state: 'Negeri Sembilan', name: 'Jelebu, Kuala Pilah, Rembau',
      pts: [[2.740, 102.250], [2.940, 102.070], [2.590, 102.100]] },
    { code: 'NGS03', state: 'Negeri Sembilan', name: 'Port Dickson, Seremban',
      pts: [[2.726, 101.942], [2.520, 101.800], [2.800, 101.800]] },
    { code: 'PHG01', state: 'Pahang', name: 'Pulau Tioman',
      pts: [[2.790, 104.170]], isl: 16 },
    { code: 'PHG02', state: 'Pahang', name: 'Kuantan, Pekan, Muadzam Shah',
      pts: [[3.808, 103.326], [3.490, 103.400], [3.050, 103.080]] },
    { code: 'PHG03', state: 'Pahang', name: 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka',
      pts: [[3.940, 102.360], [3.450, 102.420], [3.580, 102.770], [3.270, 102.450]] },
    { code: 'PHG04', state: 'Pahang', name: 'Bentong, Lipis, Raub',
      pts: [[3.522, 101.910], [3.790, 101.860], [4.180, 102.050]] },
    { code: 'PHG05', state: 'Pahang', name: 'Genting Sempah, Janda Baik, Bukit Tinggi',
      pts: [[3.350, 101.790], [3.320, 101.860], [3.400, 101.820]] },
    { code: 'PHG06', state: 'Pahang', name: 'Cameron Highlands, Genting Highlands, Bukit Fraser',
      pts: [[4.470, 101.380], [3.420, 101.790], [3.710, 101.740]] },
    { code: 'PHG07', state: 'Pahang', name: 'Rompin (Rompin, Endau, Pontian)',
      pts: [[2.800, 103.480], [2.650, 103.630]] },
    { code: 'PLS01', state: 'Perlis', name: 'Kangar, Padang Besar, Arau',
      pts: [[6.441, 100.199], [6.660, 100.320], [6.430, 100.270]] },
    { code: 'PNG01', state: 'Pulau Pinang', name: 'Seluruh Negeri Pulau Pinang',
      pts: [[5.414, 100.329], [5.400, 100.370], [5.290, 100.270], [5.170, 100.480]] },
    { code: 'PRK01', state: 'Perak', name: 'Tapah, Slim River, Tanjung Malim',
      pts: [[4.200, 101.260], [3.830, 101.400], [3.680, 101.520]] },
    { code: 'PRK02', state: 'Perak', name: 'Kuala Kangsar, Sg. Siput, Ipoh, Batu Gajah, Kampar',
      pts: [[4.598, 101.090], [4.770, 100.940], [4.300, 101.150], [4.470, 101.040]] },
    { code: 'PRK03', state: 'Perak', name: 'Lenggong, Pengkalan Hulu, Grik',
      pts: [[5.420, 101.130], [5.100, 100.970], [5.700, 100.990]] },
    { code: 'PRK04', state: 'Perak', name: 'Temengor, Belum',
      pts: [[5.550, 101.350]], auto: false },
    { code: 'PRK05', state: 'Perak', name: 'Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pangkor',
      pts: [[4.026, 101.021], [4.230, 100.630], [4.220, 100.700], [3.990, 100.790], [4.360, 100.980]] },
    { code: 'PRK06', state: 'Perak', name: 'Selama, Taiping, Bagan Serai, Parit Buntar',
      pts: [[4.850, 100.740], [5.130, 100.490], [5.010, 100.540], [5.220, 100.690]] },
    { code: 'PRK07', state: 'Perak', name: 'Bukit Larut',
      pts: [[4.862, 100.790]], auto: false },
    { code: 'SBH01', state: 'Sabah', name: 'Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Sukau',
      pts: [[5.550, 118.250], [5.450, 117.850]] },
    { code: 'SBH02', state: 'Sabah', name: 'Beluran, Telupid, Pinangah, Terusan, Kuamut, Sandakan (Barat)',
      pts: [[5.820, 117.950], [5.600, 117.150], [5.900, 117.550]] },
    { code: 'SBH03', state: 'Sabah', name: 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Tawau (Timur)',
      pts: [[5.030, 118.330], [4.480, 118.610]] },
    { code: 'SBH04', state: 'Sabah', name: 'Bandar Tawau, Balong, Merotai, Kalabakan, Tawau (Barat)',
      pts: [[4.245, 117.891]] },
    { code: 'SBH05', state: 'Sabah', name: 'Kudat, Kota Marudu, Pitas, Pulau Banggi',
      pts: [[6.884, 116.843], [6.500, 116.750], [6.600, 117.050]] },
    { code: 'SBH06', state: 'Sabah', name: 'Gunung Kinabalu',
      pts: [[6.075, 116.558]], auto: false },
    { code: 'SBH07', state: 'Sabah', name: 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan',
      pts: [[5.980, 116.074], [5.950, 116.660], [6.350, 116.430], [6.130, 116.230]] },
    { code: 'SBH08', state: 'Sabah', name: 'Pensiangan, Keningau, Tambunan, Nabawan',
      pts: [[5.337, 116.160], [5.050, 116.450]] },
    { code: 'SBH09', state: 'Sabah', name: 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston',
      pts: [[5.350, 115.750], [5.080, 115.550], [5.120, 115.950], [5.570, 115.600]] },
    { code: 'SGR01', state: 'Selangor', name: 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam',
      pts: [[3.073, 101.519], [3.110, 101.610], [3.260, 101.730], [2.690, 101.750], [3.000, 101.790], [3.560, 101.660]] },
    { code: 'SGR02', state: 'Selangor', name: 'Kuala Selangor, Sabak Bernam',
      pts: [[3.340, 101.250], [3.770, 100.990]] },
    { code: 'SGR03', state: 'Selangor', name: 'Klang, Kuala Langat',
      pts: [[3.045, 101.446], [2.810, 101.500]] },
    { code: 'SWK01', state: 'Sarawak', name: 'Limbang, Lawas, Sundar, Trusan',
      pts: [[4.750, 115.010], [4.860, 115.410]] },
    { code: 'SWK02', state: 'Sarawak', name: 'Miri, Niah, Bekenu, Sibuti, Marudi',
      pts: [[4.400, 113.991], [4.180, 114.320], [3.860, 113.720]] },
    { code: 'SWK03', state: 'Sarawak', name: 'Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu',
      pts: [[3.171, 113.042], [2.700, 113.780], [2.880, 112.850]] },
    { code: 'SWK04', state: 'Sarawak', name: 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit',
      pts: [[2.288, 111.831], [2.890, 112.090], [2.010, 112.930], [1.990, 112.100]] },
    { code: 'SWK05', state: 'Sarawak', name: 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai',
      pts: [[2.130, 111.520], [2.170, 111.640], [2.510, 111.420], [2.020, 111.920]] },
    { code: 'SWK06', state: 'Sarawak', name: 'Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok',
      pts: [[1.240, 111.460], [1.410, 111.530], [1.740, 111.330], [1.040, 111.830]] },
    { code: 'SWK07', state: 'Sarawak', name: 'Serian, Simunjan, Samarahan, Sebuyau, Meludam',
      pts: [[1.170, 110.570], [1.460, 110.470], [1.380, 110.750]] },
    { code: 'SWK08', state: 'Sarawak', name: 'Kuching, Bau, Lundu, Sematan',
      pts: [[1.553, 110.359], [1.420, 110.150], [1.680, 109.850], [1.800, 109.770]] },
    { code: 'SWK09', state: 'Sarawak', name: 'Zon Khas (Kampung Patarikan)',
      pts: [[4.700, 115.000]], auto: false },
    { code: 'TRG01', state: 'Terengganu', name: 'Kuala Terengganu, Marang, Kuala Nerus',
      pts: [[5.330, 103.141], [5.210, 103.210], [5.380, 103.020]] },
    { code: 'TRG02', state: 'Terengganu', name: 'Besut, Setiu',
      pts: [[5.740, 102.550], [5.600, 102.750]] },
    { code: 'TRG03', state: 'Terengganu', name: 'Hulu Terengganu',
      pts: [[5.080, 103.000], [5.020, 102.850]] },
    { code: 'TRG04', state: 'Terengganu', name: 'Dungun, Kemaman',
      pts: [[4.780, 103.420], [4.230, 103.420], [4.510, 103.450]] }
  ];

  /* -------------------------------------------------------------- state */

  var DEFAULTS = {
    zone: 'WLY01',
    zoneMode: 'auto',         // 'auto' = ikut GPS, 'manual' = pilihan sendiri
    theme: 'dark',
    qiblaMode: 'auto',
    qiblaBearing: 292.5,      // manual bearing from a qibla certificate
    compassOffset: 0,
    gpsLat: null,             // koordinat GPS terakhir (untuk kiblat)
    gpsLon: null,
    notify: true,
    notifyKeys: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
    autoClock: false,
    clockStyle: 'full',
    timeFormat: '24'   // '24' atau '12' (AM/PM)
  };

  var STORE_KEY = 'waktu-solat/v2';
  var OLD_KEY = 'waktu-solat/v1';
  var state = null;

  function loadState() {
    var base = JSON.parse(JSON.stringify(DEFAULTS));
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_KEY); } catch (e) {}
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        Object.keys(base).forEach(function (k) {
          if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k];
        });
        // zon luar senarai → lalai
        var ok = ZONES.some(function (z) { return z.code === base.zone; });
        if (!ok) base.zone = DEFAULTS.zone;
        // mod zon: hanya 'manual' yang diterima, selain itu auto ikut GPS
        if (base.zoneMode !== 'manual') base.zoneMode = 'auto';
        // senarai waktu notifikasi mesti array sah
        if (!Array.isArray(base.notifyKeys)) {
          base.notifyKeys = DEFAULTS.notifyKeys.slice();
        } else {
          base.notifyKeys = base.notifyKeys.filter(function (k) {
            return DEFAULTS.notifyKeys.indexOf(k) >= 0;
          });
        }
      } catch (e) { /* ignore corrupt storage */ }
    }
    state = base;
    return state;
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function resetState() {
    state = JSON.parse(JSON.stringify(DEFAULTS));
    saveState();
    return state;
  }

  /* ---------------------------------------------------- data JAKIM */

  var EMBED = (typeof window !== 'undefined' && window.JAKIM_DATA) ? window.JAKIM_DATA : null;
  var DATA_YEAR = EMBED ? EMBED.year : null;

  function cacheKey(zone, year) { return 'jakim-cache/' + year + ':' + zone; }

  // Baris masa bagi (zon, tahun) — array rentetan 'HHMM...' 32 digit, atau null.
  function zoneRows(zone, year) {
    if (EMBED && year === EMBED.year && EMBED.zones[zone]) return EMBED.zones[zone];
    try {
      var raw = localStorage.getItem(cacheKey(zone, year));
      if (raw) {
        var arr = JSON.parse(raw);
        if (arr && arr.length) return arr;
      }
    } catch (e) {}
    return null;
  }

  function parseHHMM(s) {
    if (typeof s !== 'string') return null;
    var out = [];
    for (var i = 0; i + 4 <= s.length; i += 4) {
      out.push(parseInt(s.substr(i, 4), 10));
    }
    return out.length === 8 ? out : null;
  }

  // Tarikh kalendar Malaysia bagi satu saat (masa MYT, UTC+8).
  function myParts(date) {
    var d = new Date(date.getTime() + MYT_MINUTES * 60000);
    return {
      y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(),
      doy: Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
            Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1
    };
  }

  // Sumber data yang dipakai untuk zon semasa (untuk nota UI).
  function dataSource() {
    if (EMBED && EMBED.zones[state.zone]) return { year: EMBED.year, source: 'benam' };
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('jakim-cache/') === 0) {
          var parts = k.slice('jakim-cache/'.length).split(':');
          if (parts[1] === state.zone) {
            var y = parseInt(parts[0], 10);
            if (y) return { year: y, source: 'kemas kini' };
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Waktu solat rasmi JAKIM bagi hari yang mengandungi `date`.
   * Pulangkan {imsak..isha: Date, missing:true} jika tiada data.
   */
  function computeTimes(date) {
    var no = { missing: true, imsak: null, fajr: null, syuruk: null, dhuha: null,
               dhuhr: null, asr: null, maghrib: null, isha: null };
    var mp = myParts(date);
    var rows = zoneRows(state.zone, mp.y);
    if (!rows || mp.doy < 1 || mp.doy > rows.length) return no;
    var t = parseHHMM(rows[mp.doy - 1]);
    if (!t) return no;
    var dayStart = Date.UTC(mp.y, mp.mo, mp.d) - MYT_MINUTES * 60000;
    function at(min) {
      return new Date(dayStart + Math.floor(min / 100) * 3600000 + (min % 100) * 60000);
    }
    return {
      imsak: at(t[0]), fajr: at(t[1]), syuruk: at(t[2]), dhuha: at(t[3]),
      dhuhr: at(t[4]), asr: at(t[5]), maghrib: at(t[6]), isha: at(t[7]),
      missing: false
    };
  }

  /** Muat turun data setahun dari e-Solat & simpan dalam cache peranti. */
  function refreshZone(zone, year, cb) {
    var url = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat' +
              '&period=year&zone=' + encodeURIComponent(zone);
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var pt = j && j.prayerTime;
        if (!pt || !pt.length) throw new Error('Tiada data dari JAKIM');
        var first = new Date(pt[0].date + 'T00:00:00Z');
        if (isNaN(first.getTime()) || first.getUTCMonth() !== 0 || first.getUTCDate() !== 1) {
          throw new Error('Data tidak bermula 1 Januari');
        }
        var out = [];
        for (var i = 0; i < pt.length; i++) {
          var d = pt[i];
          var s = d.imsak.slice(0, 5) + d.fajr.slice(0, 5) + d.syuruk.slice(0, 5) +
                  d.dhuha.slice(0, 5) + d.dhuhr.slice(0, 5) + d.asr.slice(0, 5) +
                  d.maghrib.slice(0, 5) + d.isha.slice(0, 5);
          out.push(s.replace(/:/g, ''));
        }
        localStorage.setItem(cacheKey(zone, year || DATA_YEAR), JSON.stringify(out));
        cb(null, out.length);
      })
      .catch(function (err) { cb(err); });
  }

  /* -------------------------------------------------------- takwim hijri */

  var HIJRI_MONTHS = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir',
                      'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban',
                      'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'];

  // Tarikh 1hb setiap bulan Hijri mengikut takwim JAKIM (Imkanur Rukyah),
  // diambil daripada data rasmi e-Solat. Dibenamkan dalam app.
  var HIJRI_STARTS = [
    '2024-07-07', '2024-08-06', '2024-09-05', '2024-10-04', '2024-11-03', '2024-12-03',
    '2025-01-01', '2025-01-31', '2025-03-02', '2025-03-31', '2025-04-29', '2025-05-29',
    '2025-06-27', '2025-07-26', '2025-08-25', '2025-09-23', '2025-10-23', '2025-11-22',
    '2025-12-22', '2026-01-20', '2026-02-19', '2026-03-21', '2026-04-19', '2026-05-18',
    '2026-06-17', '2026-07-16', '2026-08-14', '2026-09-13', '2026-10-12', '2026-11-11',
    '2026-12-11', '2027-01-10', '2027-02-08', '2027-03-10', '2027-04-09', '2027-05-08',
    '2027-06-06', '2027-07-06', '2027-08-04', '2027-09-02', '2027-10-02', '2027-10-31',
    '2027-11-30', '2027-12-29', '2028-01-28', '2028-02-27', '2028-03-28', '2028-04-26',
    '2028-05-25', '2028-06-24', '2028-07-24', '2028-08-22', '2028-09-20', '2028-10-19',
    '2028-11-18', '2028-12-17', '2029-01-16', '2029-02-15', '2029-03-17', '2029-04-15',
    '2029-05-15', '2029-06-14', '2029-07-13', '2029-08-11', '2029-09-10', '2029-10-09',
    '2029-11-08', '2029-12-07'
  ];

  var HIJRI_BASE_YEAR = 1446;
  var HIJRI_START_MS = HIJRI_STARTS.map(function (s) {
    return Date.parse(s + 'T00:00:00Z');
  });
  var HIJRI_END_MS = Date.parse('2029-12-31T00:00:00Z');

  function hijriOf(date) {
    var ms = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    if (ms < HIJRI_START_MS[0] || ms > HIJRI_END_MS) return null;
    var lo = 0, hi = HIJRI_START_MS.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (HIJRI_START_MS[mid] <= ms) lo = mid; else hi = mid - 1;
    }
    var day = Math.floor((ms - HIJRI_START_MS[lo]) / 86400000) + 1;
    if (day > 30) return null;
    return {
      y: HIJRI_BASE_YEAR + Math.floor(lo / 12),
      m: (lo % 12) + 1,
      d: day
    };
  }

  /* ------------------------------------------------------------- kiblat */

  function qiblaBearing(lat, lon) {
    var p1 = lat * D2R, p2 = KAABA.lat * D2R;
    var dl = (KAABA.lon - lon) * D2R;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return wrap360(Math.atan2(y, x) * R2D);
  }

  function distanceToKaaba(lat, lon) {
    var R = 6371.0088;
    var p1 = lat * D2R, p2 = KAABA.lat * D2R;
    var dp = p2 - p1, dl = (KAABA.lon - lon) * D2R;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Bearing yang digunakan: manual atau GPS terakhir.
  function activeQiblaBearing() {
    if (state.qiblaMode === 'manual') return wrap360(state.qiblaBearing);
    if (state.gpsLat == null || state.gpsLon == null) return null;
    return qiblaBearing(state.gpsLat, state.gpsLon);
  }

  /* ----------------------------------------------------------- formatting */

  function partsOf(date) {
    // Waktu solat sentiasa dalam masa Malaysia (UTC+8).
    var d = new Date(date.getTime() + MYT_MINUTES * 60000);
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(),
             y: d.getUTCFullYear(), mo: d.getUTCMonth(), da: d.getUTCDate(),
             wd: d.getUTCDay() };
  }

  // Masa paparan dibundarkan ke minit terdekat (mengikut cara JAKIM terbitkan).
  function fmtTime(date) {
    if (!date) return '—';
    var p = partsOf(date);
    var t = p.h * 60 + p.m + (p.s >= 30 ? 1 : 0);
    t = ((t % 1440) + 1440) % 1440;
    var hh = Math.floor(t / 60);
    var mm = t % 60;
    if (state && state.timeFormat === '12') {
      var ampm = hh >= 12 ? 'PM' : 'AM';
      var h12 = hh % 12; if (h12 === 0) h12 = 12;
      return h12 + ':' + pad2(mm) + ' ' + ampm;
    }
    return pad2(hh) + ':' + pad2(mm);
  }

  function fmtDegMin(deg) {
    if (deg == null) return '—';
    deg = wrap360(deg);
    var d = Math.floor(deg);
    var m = Math.round((deg - d) * 60);
    if (m === 60) { m = 0; d = (d + 1) % 360; }
    return d + '° ' + pad2(m) + '′';
  }

  function zoneOf(code) {
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].code === code) return ZONES[i];
    }
    return null;
  }

  /** Jarak great-circle antara dua koordinat, dalam km. */
  function distKm(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * D2R, p2 = lat2 * D2R;
    var dp = (lat2 - lat1) * D2R, dl = (lon2 - lon1) * D2R;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /**
   * Zon JAKIM terdekat bagi satu koordinat GPS.
   * - Zon dengan `auto:false` (puncak gunung / kampung khas) tidak dipilih.
   * - Zon pulau (`isl`) hanya dipilih jika dalam jejarinya.
   * Pulangan: { code, zone, distance } atau null jika tiada koordinat sah.
   */
  function zoneFromCoords(lat, lon) {
    if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null;
    var best = null, bestD = Infinity;
    for (var i = 0; i < ZONES.length; i++) {
      var z = ZONES[i];
      if (z.auto === false || !z.pts) continue;
      var d = Infinity;
      for (var j = 0; j < z.pts.length; j++) {
        var dz = distKm(lat, lon, z.pts[j][0], z.pts[j][1]);
        if (dz < d) d = dz;
      }
      if (z.isl && d > z.isl) continue;
      if (d < bestD) { bestD = d; best = z; }
    }
    return best ? { code: best.code, zone: best, distance: bestD } : null;
  }

  /* ------------------------------------------------------------- export */

  global.Core = {
    KAABA: KAABA,
    ZONES: ZONES,
    META_LABELS: {
      imsak: 'Imsak', fajr: 'Subuh', syuruk: 'Syuruk', dhuha: 'Duha',
      dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak'
    },
    META_ICONS: {
      imsak: '🌙', fajr: '🌅', syuruk: '🌄', dhuha: '☀️',
      dhuhr: '🌞', asr: '🌤', maghrib: '🌇', isha: '🌙'
    },
    ORDER: ['imsak', 'fajr', 'syuruk', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha'],
    PRAYER_KEYS: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
    HIJRI_MONTHS: HIJRI_MONTHS,
    hijriOf: hijriOf,
    DEFAULTS: DEFAULTS,
    wrap360: wrap360,
    wrap180: wrap180,
    clamp: clamp,
    pad2: pad2,
    get state() { return state; },
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    computeTimes: computeTimes,
    myParts: myParts,
    dataSource: dataSource,
    refreshZone: refreshZone,
    zoneRows: zoneRows,
    qiblaBearing: qiblaBearing,
    distanceToKaaba: distanceToKaaba,
    activeQiblaBearing: activeQiblaBearing,
    fmtTime: fmtTime,
    fmtDegMin: fmtDegMin,
    partsOf: partsOf,
    zoneOf: zoneOf,
    distKm: distKm,
    zoneFromCoords: zoneFromCoords
  };

})(window);
