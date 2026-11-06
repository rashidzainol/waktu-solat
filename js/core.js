/* ==========================================================================
   core.js — state, solar math, prayer times, qibla bearing
   ========================================================================== */
(function (global) {
  'use strict';

  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;

  var KAABA = { lat: 21.4225, lon: 39.8262 };

  /* ---------------------------------------------------------------- utils */

  function wrap360(a) { return ((a % 360) + 360) % 360; }
  function wrap180(a) { a = wrap360(a); return a > 180 ? a - 360 : a; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* --------------------------------------------------------- solar engine */

  // Julian Day at 0h UT of the given calendar date.
  function julianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  // Low-precision solar coordinates (Meeus). Accurate to ~1 minute for our use.
  // jd: Julian Day including fraction (UT)
  function sunPosition(jd) {
    var n = jd - 2451545.0;
    var L = 280.460 + 0.9856474 * n;            // mean longitude (deg)
    var g = (357.528 + 0.9856003 * n) * D2R;    // mean anomaly
    var lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    var eps = (23.439 - 0.0000004 * n) * D2R;   // obliquity

    var decl = Math.asin(Math.sin(eps) * Math.sin(lambda)) * R2D;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * R2D;

    // Equation of time = apparent solar time - mean solar time (hours)
    var eot = wrap180(L - ra) / 15;

    return { decl: decl, eot: eot, ra: ra };
  }

  // Hour angle (degrees) at which the sun reaches the given altitude.
  // Returns null when the sun never reaches that altitude (polar day/night).
  function hourAngle(lat, decl, altitude) {
    var c = (Math.sin(altitude * D2R) - Math.sin(lat * D2R) * Math.sin(decl * D2R)) /
            (Math.cos(lat * D2R) * Math.cos(decl * D2R));
    if (c > 1 || c < -1) return null;
    return Math.acos(c) * R2D;
  }

  // Sun altitude for Asr (shadow of an object is `factor` times its height).
  function asrAltitude(lat, decl, factor) {
    return Math.atan(1 / (factor + Math.tan(Math.abs(lat - decl) * D2R))) * R2D;
  }

  /* ------------------------------------------------------------- methods */

  var METHODS = {
    jakim:   { name: 'JAKIM',            fajr: 18,   isha: 18,   note: 'Subuh 18°, Isyak 18° (rujukan takwim JAKIM)' },
    mwl:     { name: 'Muslim World League', fajr: 18, isha: 17,  note: 'Subuh 18°, Isyak 17°' },
    isna:    { name: 'ISNA',             fajr: 15,   isha: 15,   note: 'Subuh 15°, Isyak 15°' },
    egypt:   { name: 'Mesir',            fajr: 19.5, isha: 17.5, note: 'Subuh 19.5°, Isyak 17.5°' },
    karachi: { name: 'Karachi',          fajr: 18,   isha: 18,   note: 'Subuh 18°, Isyak 18°' },
    makkah:  { name: 'Umm al-Qura',      fajr: 18.5, isha: null, note: 'Subuh 18.5°, Isyak = Maghrib + 90 min' }
  };

  var CITIES = [
    { name: 'Kuala Lumpur',   lat: 3.1390,  lon: 101.6869 },
    { name: 'Putrajaya',      lat: 2.9264,  lon: 101.6964 },
    { name: 'Shah Alam',      lat: 3.0733,  lon: 101.5185 },
    { name: 'Seremban',       lat: 2.7297,  lon: 101.9381 },
    { name: 'Melaka',         lat: 2.1896,  lon: 102.2501 },
    { name: 'Johor Bahru',    lat: 1.4927,  lon: 103.7414 },
    { name: 'Batu Pahat',     lat: 1.8548,  lon: 102.9325 },
    { name: 'Ipoh',           lat: 4.5975,  lon: 101.0901 },
    { name: 'George Town',    lat: 5.4141,  lon: 100.3288 },
    { name: 'Alor Setar',     lat: 6.1184,  lon: 100.3685 },
    { name: 'Kangar',         lat: 6.4414,  lon: 100.1986 },
    { name: 'Kota Bharu',     lat: 6.1254,  lon: 102.2381 },
    { name: 'Kuala Terengganu', lat: 5.3302, lon: 103.1408 },
    { name: 'Kuantan',        lat: 3.8077,  lon: 103.3260 },
    { name: 'Kuching',        lat: 1.5533,  lon: 110.3592 },
    { name: 'Sibu',           lat: 2.2878,  lon: 111.8305 },
    { name: 'Miri',           lat: 4.3995,  lon: 113.9914 },
    { name: 'Kota Kinabalu',  lat: 5.9804,  lon: 116.0735 },
    { name: 'Sandakan',       lat: 5.8394,  lon: 118.1172 },
    { name: 'Labuan',         lat: 5.2831,  lon: 115.2308 }
  ];

  /* -------------------------------------------------------------- state */

  var DEFAULTS = {
    lat: 3.1390,
    lon: 101.6869,
    city: 'Kuala Lumpur',
    theme: 'dark',
    method: 'jakim',
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 1,
    ihtiyat: 2,
    tzMode: 'device',
    tzOffset: 8,
    hijriOffset: 0,
    qiblaMode: 'auto',
    qiblaBearing: 292.5,      // manual bearing from a qibla certificate
    compassOffset: 0,
    adj: { imsak: 0, fajr: 0, syuruk: 0, dhuha: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
  };

  var STORE_KEY = 'waktu-solat/v1';
  var state = null;

  function loadState() {
    var base = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        Object.keys(base).forEach(function (k) {
          if (saved[k] !== undefined && saved[k] !== null) {
            if (k === 'adj' && typeof saved[k] === 'object') {
              Object.keys(base.adj).forEach(function (p) {
                if (typeof saved[k][p] === 'number') base.adj[p] = saved[k][p];
              });
            } else {
              base[k] = saved[k];
            }
          }
        });
      }
    } catch (e) { /* ignore corrupt storage */ }
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

  /* -------------------------------------------------------- time helpers */

  // Minutes east of UTC for a given local date, honouring the tz setting.
  function tzOffsetMinutes(date) {
    if (state.tzMode === 'manual') return Math.round(state.tzOffset * 60);
    return -date.getTimezoneOffset();
  }

  // UTC instant (ms) of local midnight for the calendar date of `date`.
  function localMidnightMs(date) {
    var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    var offMin = tzOffsetMinutes(date);
    return Date.UTC(y, m, d) - offMin * 60000;
  }

  /* -------------------------------------------------------- takwim hijri */

  // Nama bulan Hijri mengikut JAKIM.
  var HIJRI_MONTHS = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir',
                      'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban',
                      'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'];

  // Tarikh 1hb setiap bulan Hijri mengikut takwim JAKIM (Imkanur Rukyah),
  // diambil daripada data rasmi e-Solat. Disimpan dalam app supaya kekal offline.
  // Bermula 1 Muharam 1446 hingga akhir 2029.
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

  // Hijri {y, m, d} untuk tarikh kalendar tempatan. null jika di luar jadual JAKIM.
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

  /* -------------------------------------------------------- prayer times */

  var ORDER = ['imsak', 'fajr', 'syuruk', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha'];

  var META = {
    imsak:   { label: 'Imsak',   sub: '10 min sebelum Subuh', prayer: false },
    fajr:    { label: 'Subuh',   sub: '',                      prayer: true  },
    syuruk:  { label: 'Syuruk',  sub: 'Matahari terbit',       prayer: false },
    dhuha:   { label: 'Duha',    sub: '±20 min selepas syuruk', prayer: false },
    dhuhr:   { label: 'Zohor',   sub: '',                      prayer: true  },
    asr:     { label: 'Asar',    sub: '',                      prayer: true  },
    maghrib: { label: 'Maghrib', sub: '',                      prayer: true  },
    isha:    { label: 'Isyak',   sub: '',                      prayer: true  }
  };

  function computeTimes(date) {
    // Calendar date in the zone we are displaying for.
    var y, m, d;
    if (state.tzMode === 'manual') {
      var sh = new Date(date.getTime() + state.tzOffset * 3600000);
      y = sh.getUTCFullYear(); m = sh.getUTCMonth() + 1; d = sh.getUTCDate();
    } else {
      y = date.getFullYear(); m = date.getMonth() + 1; d = date.getDate();
    }

    var offMin = tzOffsetMinutes(date);          // minutes east of UTC
    // Solar hours below are measured from 00:00 UTC of the calendar date.
    var dayStart = Date.UTC(y, m - 1, d);

    // Solar parameters sampled at local noon.
    var utNoonHours = 12 - offMin / 60;
    var jd = julianDay(y, m, d) + utNoonHours / 24;
    var sun = sunPosition(jd);

    var lat = state.lat;
    var decl = sun.decl;

    // Solar transit in UT hours.
    var transit = 12 - state.lon / 15 - sun.eot;

    var method = METHODS[state.method];
    var fajrAngle = (state.method === 'custom') ? state.fajrAngle : (method ? method.fajr : 18);
    var ishaAngle = (state.method === 'custom') ? state.ishaAngle : (method ? method.isha : 18);

    var hRise = hourAngle(lat, decl, -0.833);
    var hFajr = hourAngle(lat, decl, -fajrAngle);
    var hAsr  = hourAngle(lat, decl, asrAltitude(lat, decl, state.asrFactor));
    var hIsha = ishaAngle == null ? null : hourAngle(lat, decl, -ishaAngle);

    var iht = state.ihtiyat;
    var adj = state.adj;

    function at(utHours, extraMin) {
      if (utHours == null || !isFinite(utHours)) return null;
      var minutes = utHours * 60 + (extraMin || 0);
      return new Date(dayStart + minutes * 60000);
    }

    var fajrUt = hFajr == null ? null : transit - hFajr / 15;
    var riseUt = hRise == null ? null : transit - hRise / 15;
    var setUt  = hRise == null ? null : transit + hRise / 15;
    var asrUt  = hAsr  == null ? null : transit + hAsr / 15;
    var ishaUt = hIsha == null ? null : transit + hIsha / 15;

    var out = {
      imsak:   at(fajrUt, iht - 10 + adj.imsak),
      fajr:    at(fajrUt, iht + adj.fajr),
      syuruk:  at(riseUt, adj.syuruk),           // JAKIM: no ihtiyat on syuruk
      dhuha:   at(riseUt, 20 + adj.dhuha),
      dhuhr:   at(transit, iht + adj.dhuhr),
      asr:     at(asrUt, iht + adj.asr),
      maghrib: at(setUt, iht + adj.maghrib),
      isha:    at(ishaUt, iht + adj.isha)
    };

    // Umm al-Qura: Isha is fixed at Maghrib + 90 minutes.
    if (state.method === 'makkah' && out.maghrib) {
      out.isha = new Date(out.maghrib.getTime() + (90 + adj.isha) * 60000);
    }

    return out;
  }

  /* ------------------------------------------------------------- qibla */

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

  // Bearing actually used by the compass, honouring the manual override.
  function activeQiblaBearing() {
    if (state.qiblaMode === 'manual') return wrap360(state.qiblaBearing);
    return qiblaBearing(state.lat, state.lon);
  }

  /* ----------------------------------------------------------- formatting */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function partsOf(date) {
    if (state.tzMode === 'manual') {
      var d = new Date(date.getTime() + state.tzOffset * 3600000);
      return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(),
               y: d.getUTCFullYear(), mo: d.getUTCMonth(), da: d.getUTCDate(),
               wd: d.getUTCDay() };
    }
    return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(),
             y: date.getFullYear(), mo: date.getMonth(), da: date.getDate(),
             wd: date.getDay() };
  }

  // Clock time rounded to the nearest minute (matches how takwim is published).
  function fmtTime(date) {
    if (!date) return '—';
    var p = partsOf(date);
    var t = p.h * 60 + p.m + (p.s >= 30 ? 1 : 0);
    t = ((t % 1440) + 1440) % 1440;
    return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
  }

  function fmtDegMin(deg) {
    deg = wrap360(deg);
    var d = Math.floor(deg);
    var m = Math.round((deg - d) * 60);
    if (m === 60) { m = 0; d = (d + 1) % 360; }
    return d + '° ' + pad2(m) + '′';
  }

  function nearestCity(lat, lon) {
    var best = null, bestD = Infinity;
    CITIES.forEach(function (c) {
      var d = Math.hypot(c.lat - lat, c.lon - lon);
      if (d < bestD) { bestD = d; best = c; }
    });
    return { city: best, deg: bestD };
  }

  /* ------------------------------------------------------------- export */

  global.Core = {
    D2R: D2R, R2D: R2D,
    KAABA: KAABA,
    METHODS: METHODS,
    CITIES: CITIES,
    ORDER: ORDER,
    META: META,
    HIJRI_MONTHS: HIJRI_MONTHS,
    hijriOf: hijriOf,
    DEFAULTS: DEFAULTS,
    wrap360: wrap360,
    wrap180: wrap180,
    clamp: clamp,
    get state() { return state; },
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    tzOffsetMinutes: tzOffsetMinutes,
    localMidnightMs: localMidnightMs,
    julianDay: julianDay,
    sunPosition: sunPosition,
    hourAngle: hourAngle,
    asrAltitude: asrAltitude,
    computeTimes: computeTimes,
    qiblaBearing: qiblaBearing,
    distanceToKaaba: distanceToKaaba,
    activeQiblaBearing: activeQiblaBearing,
    fmtTime: fmtTime,
    fmtDegMin: fmtDegMin,
    pad2: pad2,
    partsOf: partsOf,
    nearestCity: nearestCity
  };

})(window);
