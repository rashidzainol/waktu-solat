/* ==========================================================================
   core.js — zon JAKIM, data waktu solat rasmi, kiblat, takwim
   ==========================================================================
   Waktu solat TIDAK lagi dikira. Data bulat-bulat daripada JAKIM (e-Solat),
   dibenam dalam app (js/jakim-data.js) dan boleh dikemas kini dalam talian
   (cache per peranti) selepas 2026.
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

  var ZONES = [
    { code: 'WLY01', state: 'Wilayah Persekutuan', name: 'Kuala Lumpur, Putrajaya' },
    { code: 'WLY02', state: 'Wilayah Persekutuan', name: 'Labuan' },
    { code: 'JHR01', state: 'Johor', name: 'Pulau Aur dan Pulau Pemanggil' },
    { code: 'JHR02', state: 'Johor', name: 'Johor Bahru, Kota Tinggi, Mersing, Kulai' },
    { code: 'JHR03', state: 'Johor', name: 'Kluang, Pontian' },
    { code: 'JHR04', state: 'Johor', name: 'Batu Pahat, Muar, Segamat, Gemas Johor, Tangkak' },
    { code: 'KDH01', state: 'Kedah', name: 'Kota Setar, Kubang Pasu, Pokok Sena' },
    { code: 'KDH02', state: 'Kedah', name: 'Kuala Muda, Yan, Pendang' },
    { code: 'KDH03', state: 'Kedah', name: 'Padang Terap, Sik' },
    { code: 'KDH04', state: 'Kedah', name: 'Baling' },
    { code: 'KDH05', state: 'Kedah', name: 'Bandar Baharu, Kulim' },
    { code: 'KDH06', state: 'Kedah', name: 'Langkawi' },
    { code: 'KDH07', state: 'Kedah', name: 'Puncak Gunung Jerai' },
    { code: 'KTN01', state: 'Kelantan', name: 'Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai' },
    { code: 'KTN02', state: 'Kelantan', name: 'Gua Musang (Galas, Bertam), Jeli, Lojing' },
    { code: 'MLK01', state: 'Melaka', name: 'Seluruh Negeri Melaka' },
    { code: 'NGS01', state: 'Negeri Sembilan', name: 'Tampin, Jempol' },
    { code: 'NGS02', state: 'Negeri Sembilan', name: 'Jelebu, Kuala Pilah, Rembau' },
    { code: 'NGS03', state: 'Negeri Sembilan', name: 'Port Dickson, Seremban' },
    { code: 'PHG01', state: 'Pahang', name: 'Pulau Tioman' },
    { code: 'PHG02', state: 'Pahang', name: 'Kuantan, Pekan, Muadzam Shah' },
    { code: 'PHG03', state: 'Pahang', name: 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka' },
    { code: 'PHG04', state: 'Pahang', name: 'Bentong, Lipis, Raub' },
    { code: 'PHG05', state: 'Pahang', name: 'Genting Sempah, Janda Baik, Bukit Tinggi' },
    { code: 'PHG06', state: 'Pahang', name: 'Cameron Highlands, Genting Highlands, Bukit Fraser' },
    { code: 'PHG07', state: 'Pahang', name: 'Rompin (Rompin, Endau, Pontian)' },
    { code: 'PLS01', state: 'Perlis', name: 'Kangar, Padang Besar, Arau' },
    { code: 'PNG01', state: 'Pulau Pinang', name: 'Seluruh Negeri Pulau Pinang' },
    { code: 'PRK01', state: 'Perak', name: 'Tapah, Slim River, Tanjung Malim' },
    { code: 'PRK02', state: 'Perak', name: 'Kuala Kangsar, Sg. Siput, Ipoh, Batu Gajah, Kampar' },
    { code: 'PRK03', state: 'Perak', name: 'Lenggong, Pengkalan Hulu, Grik' },
    { code: 'PRK04', state: 'Perak', name: 'Temengor, Belum' },
    { code: 'PRK05', state: 'Perak', name: 'Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pangkor' },
    { code: 'PRK06', state: 'Perak', name: 'Selama, Taiping, Bagan Serai, Parit Buntar' },
    { code: 'PRK07', state: 'Perak', name: 'Bukit Larut' },
    { code: 'SBH01', state: 'Sabah', name: 'Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Sukau' },
    { code: 'SBH02', state: 'Sabah', name: 'Beluran, Telupid, Pinangah, Terusan, Kuamut, Sandakan (Barat)' },
    { code: 'SBH03', state: 'Sabah', name: 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Tawau (Timur)' },
    { code: 'SBH04', state: 'Sabah', name: 'Bandar Tawau, Balong, Merotai, Kalabakan, Tawau (Barat)' },
    { code: 'SBH05', state: 'Sabah', name: 'Kudat, Kota Marudu, Pitas, Pulau Banggi' },
    { code: 'SBH06', state: 'Sabah', name: 'Gunung Kinabalu' },
    { code: 'SBH07', state: 'Sabah', name: 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan' },
    { code: 'SBH08', state: 'Sabah', name: 'Pensiangan, Keningau, Tambunan, Nabawan' },
    { code: 'SBH09', state: 'Sabah', name: 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston' },
    { code: 'SGR01', state: 'Selangor', name: 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam' },
    { code: 'SGR02', state: 'Selangor', name: 'Kuala Selangor, Sabak Bernam' },
    { code: 'SGR03', state: 'Selangor', name: 'Klang, Kuala Langat' },
    { code: 'SWK01', state: 'Sarawak', name: 'Limbang, Lawas, Sundar, Trusan' },
    { code: 'SWK02', state: 'Sarawak', name: 'Miri, Niah, Bekenu, Sibuti, Marudi' },
    { code: 'SWK03', state: 'Sarawak', name: 'Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu' },
    { code: 'SWK04', state: 'Sarawak', name: 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit' },
    { code: 'SWK05', state: 'Sarawak', name: 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai' },
    { code: 'SWK06', state: 'Sarawak', name: 'Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok' },
    { code: 'SWK07', state: 'Sarawak', name: 'Serian, Simunjan, Samarahan, Sebuyau, Meludam' },
    { code: 'SWK08', state: 'Sarawak', name: 'Kuching, Bau, Lundu, Sematan' },
    { code: 'SWK09', state: 'Sarawak', name: 'Zon Khas (Kampung Patarikan)' },
    { code: 'TRG01', state: 'Terengganu', name: 'Kuala Terengganu, Marang, Kuala Nerus' },
    { code: 'TRG02', state: 'Terengganu', name: 'Besut, Setiu' },
    { code: 'TRG03', state: 'Terengganu', name: 'Hulu Terengganu' },
    { code: 'TRG04', state: 'Terengganu', name: 'Dungun, Kemaman' }
  ];

  /* -------------------------------------------------------------- state */

  var DEFAULTS = {
    zone: 'WLY01',
    theme: 'dark',
    qiblaMode: 'auto',
    qiblaBearing: 292.5,      // manual bearing from a qibla certificate
    compassOffset: 0,
    gpsLat: null,             // koordinat GPS terakhir (untuk kiblat)
    gpsLon: null,
    notify: true,
    autoClock: false,
    clockStyle: 'full'
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
    return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
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

  /* ------------------------------------------------------------- export */

  global.Core = {
    KAABA: KAABA,
    ZONES: ZONES,
    META_LABELS: {
      imsak: 'Imsak', fajr: 'Subuh', syuruk: 'Syuruk', dhuha: 'Duha',
      dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak'
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
    zoneOf: zoneOf
  };

})(window);
