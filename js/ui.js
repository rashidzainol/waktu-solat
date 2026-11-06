/* ==========================================================================
   ui.js — rendering, navigation, settings
   ========================================================================== */
(function () {
  'use strict';

  var C = window.Core;
  var $ = function (id) { return document.getElementById(id); };

  var DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  var MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
                'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

  var PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var ADJ_KEYS = ['imsak', 'fajr', 'syuruk', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha'];

  var THEMES = {
    dark:    { label: 'Gelap',     bar: '#070d0b', light: false },
    light:   { label: 'Terang',    bar: '#f3f6f3', light: true  },
    minimal: { label: 'Minimalis', bar: '#f6f6f5', light: true  }
  };

  var lastSignature = '';
  var currentView = 'times';
  var liveHeading = null;
  var wakeLock = null;
  var gpsBusy = false;

  /* ------------------------------------------------------------- helpers */

  function toast(msg, ms) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  }

  function isSecure() {
    return window.isSecureContext === true;
  }

  function tzLabel() {
    var off = C.tzOffsetMinutes(new Date()) / 60;
    var sign = off < 0 ? '\u2212' : '+';
    var abs = Math.abs(off);
    return 'UTC' + sign + (abs % 1 === 0 ? abs : abs.toFixed(1));
  }

  function hijriText(date) {
    var off = C.state.hijriOffset || 0;
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + off, 12, 0, 0);

    // Takwim rasmi JAKIM.
    var hj = C.hijriOf(d);
    if (hj) return hj.d + ' ' + C.HIJRI_MONTHS[hj.m - 1] + ' ' + hj.y + ' H';

    // Di luar julat jadual JAKIM: anggaran Umm al-Qura.
    var opts = { day: 'numeric', month: 'long', year: 'numeric' };
    var txt = '';
    try {
      txt = new Intl.DateTimeFormat('ms-MY-u-ca-islamic-umalqura', opts).format(d);
    } catch (e) {
      try {
        txt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', opts).format(d);
      } catch (e2) { return ''; }
    }
    // Some locales already emit the "H" suffix.
    return /(^|\s)H$/.test(txt) ? txt : txt + ' H';
  }

  function countdownText(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + ' hari ' + h + ' jam';
    if (h > 0) return h + ' jam ' + m + ' min';
    if (m > 0) return m + ' min ' + s + ' s';
    return s + ' s';
  }

  function fmtCoord(v, pos, neg) {
    return Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? pos : neg);
  }

  /* -------------------------------------------------------------- theme */

  function applyTheme() {
    var t = C.state.theme;
    if (!THEMES[t]) t = 'dark';
    document.documentElement.setAttribute('data-theme', t);

    var meta = $('metaTheme');
    if (meta) meta.setAttribute('content', THEMES[t].bar);

    // Shell Android (jika berjalan dalam APK).
    try {
      if (window.AndroidTheme && window.AndroidTheme.setBars) {
        window.AndroidTheme.setBars(THEMES[t].bar, THEMES[t].light);
      }
    } catch (e) {}

    var pick = $('themePick');
    if (pick) {
      Array.prototype.forEach.call(pick.children, function (b) {
        b.classList.toggle('on', b.dataset.theme === t);
      });
    }
  }

  /* ------------------------------------------------------------ schedule */

  function nextDay(base) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 12, 0, 0);
    return d;
  }

  function schedule(now) {
    var times = C.computeTimes(now);
    var events = PRAYER_KEYS
      .map(function (k) { return { key: k, date: times[k] }; })
      .filter(function (e) { return e.date != null; });

    var next = null;
    for (var i = 0; i < events.length; i++) {
      if (events[i].date > now) { next = events[i]; break; }
    }

    var tomorrowTimes = null;
    if (!next) {
      tomorrowTimes = C.computeTimes(nextDay(now));
      next = { key: 'fajr', date: tomorrowTimes.fajr, tomorrow: true };
    }

    var current = null;
    for (var j = events.length - 1; j >= 0; j--) {
      if (events[j].date <= now) { current = events[j]; break; }
    }

    return { times: times, events: events, next: next, current: current,
             tomorrowTimes: tomorrowTimes };
  }

  /* -------------------------------------------------------------- render */

  function renderTimes(now) {
    var sc = schedule(now);
    var st = C.state;

    // hero
    var name = C.META[sc.next.key].label;
    $('heroEyebrow').textContent = sc.next.tomorrow ? 'Seterusnya · esok' : 'Seterusnya';
    $('nextName').textContent = name;
    $('nextTime').textContent = C.fmtTime(sc.next.date);
    $('countdown').innerHTML = 'lagi <b id="cdVal"></b>';
    updateCountdown(sc, now);

    var nm = new Date(now.getTime());
    $('heroDate').innerHTML = DAYS[nm.getDay()] + '<br>' + nm.getDate() + ' ' +
      MONTHS[nm.getMonth()] + ' ' + nm.getFullYear();

    $('dateMiladi').textContent = DAYS[nm.getDay()] + ', ' + nm.getDate() + ' ' +
      MONTHS[nm.getMonth()] + ' ' + nm.getFullYear();
    var h = hijriText(nm);
    $('dateHijri').textContent = h || '—';
    $('zoneLabel').textContent = tzLabel();

    // list
    var list = $('prayerList');
    var frag = document.createDocumentFragment();

    C.ORDER.forEach(function (key) {
      var meta = C.META[key];
      var date = sc.times[key];
      var row = document.createElement('div');
      row.className = 'prow';
      row.dataset.key = key;

      if (date) {
        if (sc.next && sc.next.key === key && !sc.next.tomorrow) row.classList.add('is-next');
        else if (date < now) row.classList.add('is-past');
      }
      if (sc.current && sc.current.key === key) row.classList.add('is-now');

      var dot = document.createElement('span');
      dot.className = 'pdot';

      var nmEl = document.createElement('div');
      var n1 = document.createElement('div');
      n1.className = 'pname';
      n1.textContent = meta.label;
      nmEl.appendChild(n1);
      if (meta.sub) {
        var n2 = document.createElement('div');
        n2.className = 'psub';
        n2.textContent = meta.sub;
        nmEl.appendChild(n2);
      }

      var tm = document.createElement('div');
      tm.className = 'ptime num';
      tm.textContent = C.fmtTime(date);

      row.appendChild(dot);
      row.appendChild(nmEl);
      row.appendChild(tm);
      frag.appendChild(row);
    });

    list.innerHTML = '';
    list.appendChild(frag);

    // note
    var mdesc = C.METHODS[st.method];
    $('calcNote').innerHTML =
      'Kaedah <b>' + (mdesc ? mdesc.name : 'Tersuai') + '</b> · Asar ' +
      (Number(st.asrFactor) === 2 ? 'Hanafi' : "Shafi'i") +
      ' · Ihtiyat ' + st.ihtiyat + ' min<br>' +
      'Koordinat ' + fmtCoord(st.lat, 'N', 'S') + ', ' + fmtCoord(st.lon, 'E', 'W');

    lastSignature = signature(sc);
    updateLocationLabel();
  }

  function signature(sc) {
    if (!sc.next) return '';
    return sc.next.key + ':' + sc.next.date.getTime();
  }

  function updateCountdown(sc, now) {
    var el = $('cdVal');
    if (!el) return;
    var ms = sc.next.date.getTime() - now.getTime();
    el.textContent = countdownText(ms);
  }

  function updateLocationLabel() {
    var st = C.state;
    var label = st.city && st.city !== 'Tetapkan sendiri' ? st.city : 'Lokasi';
    $('locLabel').textContent = label + ' · ' + fmtCoord(st.lat, 'N', 'S') + ' ' +
      fmtCoord(st.lon, 'E', 'W');
  }

  /* -------------------------------------------------------------- tick */

  function tick() {
    var now = new Date();
    var sc = schedule(now);
    if (signature(sc) !== lastSignature) {
      renderTimes(now);
    } else {
      updateCountdown(sc, now);
      // keep past/next highlighting in sync once a minute is enough
      if (now.getSeconds() === 0) renderTimes(now);
    }
  }

  /* ------------------------------------------------------------- qibla */

  function buildDial() {
    var NS = 'http://www.w3.org/2000/svg';
    var dial = $('dial');
    dial.innerHTML = '';

    for (var a = 0; a < 360; a += 5) {
      var major = a % 30 === 0;
      var r1 = 146, r2 = major ? 132 : 138;
      var line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', cx(r1, a)); line.setAttribute('y1', cy(r1, a));
      line.setAttribute('x2', cx(r2, a)); line.setAttribute('y2', cy(r2, a));
      line.setAttribute('class', 'dial-tick' + (major ? ' major' : ''));
      dial.appendChild(line);
    }

    [[0, 'U'], [90, 'T'], [180, 'S'], [270, 'B']].forEach(function (p) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', cx(114, p[0]));
      t.setAttribute('y', cy(114, p[0]));
      t.setAttribute('class', 'dial-lbl cardinal' + (p[0] === 0 ? ' north' : ''));
      t.textContent = p[1];
      dial.appendChild(t);
    });

    // qibla pointer
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('id', 'qiblaMark');

    var glow = document.createElementNS(NS, 'line');
    glow.setAttribute('x1', 160); glow.setAttribute('y1', 132);
    glow.setAttribute('x2', 160); glow.setAttribute('y2', 76);
    glow.setAttribute('stroke', 'rgba(227,192,122,.20)');
    glow.setAttribute('stroke-width', '10');
    glow.setAttribute('stroke-linecap', 'round');
    g.appendChild(glow);

    var line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 160); line.setAttribute('y1', 132);
    line.setAttribute('x2', 160); line.setAttribute('y2', 76);
    line.setAttribute('stroke', 'url(#kaabaGold)');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);

    var kg = document.createElementNS(NS, 'g');
    kg.setAttribute('transform', 'translate(160 56)');
    var body = document.createElementNS(NS, 'rect');
    body.setAttribute('x', -11); body.setAttribute('y', -9);
    body.setAttribute('width', 22); body.setAttribute('height', 18);
    body.setAttribute('rx', 3);
    body.setAttribute('fill', '#12100c');
    body.setAttribute('stroke', 'url(#kaabaGold)');
    body.setAttribute('stroke-width', 1.4);
    kg.appendChild(body);
    var band = document.createElementNS(NS, 'rect');
    band.setAttribute('x', -11); band.setAttribute('y', -3.5);
    band.setAttribute('width', 22); band.setAttribute('height', 4.4);
    band.setAttribute('fill', 'url(#kaabaGold)');
    kg.appendChild(band);
    g.appendChild(kg);

    dial.appendChild(g);
    positionQibla(C.activeQiblaBearing());
  }

  function cx(r, a) { return 160 + r * Math.sin(a * Math.PI / 180); }
  function cy(r, a) { return 160 - r * Math.cos(a * Math.PI / 180); }

  function positionQibla(bearing) {
    var g = $('qiblaMark');
    if (g) g.setAttribute('transform', 'rotate(' + bearing + ' 160 160)');
  }

  function renderQibla() {
    var st = C.state;
    var bearing = C.activeQiblaBearing();
    var auto = C.qiblaBearing(st.lat, st.lon);

    $('qiblaBig').innerHTML = C.fmtDegMin(bearing).replace('°', '°<span>').replace('′', '′</span>');
    $('qiblaCap').textContent = st.qiblaMode === 'manual'
      ? 'Mengikut bearing sijil kiblat'
      : 'Arah kiblat dari lokasi anda';

    positionQibla(bearing);

    var dist = C.distanceToKaaba(st.lat, st.lon);
    $('qDist').textContent = Math.round(dist).toLocaleString('ms-MY') + ' km';

    // mode segmented control
    Array.prototype.forEach.call($('qiblaMode').children, function (b) {
      b.classList.toggle('on', b.dataset.mode === st.qiblaMode);
    });
    $('bearingBox').hidden = st.qiblaMode !== 'manual';
    $('qDeg').value = Math.floor(C.wrap360(st.qiblaBearing));
    $('qMin').value = Math.round((C.wrap360(st.qiblaBearing) % 1) * 60) % 60;

    var note = st.qiblaMode === 'manual'
      ? 'Bearing manual: <b>' + C.fmtDegMin(st.qiblaBearing) + '</b>. Kiraan GPS untuk lokasi ini ialah ' +
        C.fmtDegMin(auto) + ' (beza ' + (Math.abs(C.wrap180(st.qiblaBearing - auto)).toFixed(1)) + '°).'
      : 'Dikira dari koordinat anda ke Kaabah. Tukar ke <b>Manual</b> jika sijil kiblat memberi nilai tersendiri.';
    $('qiblaNote').innerHTML = note;

    updateQiblaLive();
  }

  function updateQiblaLive() {
    var st = C.state;
    var bearing = C.activeQiblaBearing();
    var wrap = $('compassWrap');

    var btnCompass = $('btnCompass');

    if (liveHeading == null) {
      $('qDelta').textContent = '—';
      wrap.classList.remove('aligned');
      var txt = $('compassStateText');
      var stateEl = $('compassState');
      var perm = window.Compass.permission;
      var showBtn = false;
      stateEl.className = 'compass-state warn';

      if (!window.Compass.isSecure()) {
        txt.textContent = 'Kompas perlukan sambungan https:// atau localhost';
      } else if (perm === 'denied') {
        txt.textContent = 'Akses kompas tidak dibenarkan — guna kompas fizikal pada ' +
          C.fmtDegMin(bearing) + ' dari utara';
      } else if (window.Compass.needsPermission() && perm !== 'granted') {
        txt.textContent = 'Benarkan akses kompas untuk melihat arah';
        showBtn = true;
      } else if (perm === 'unsupported') {
        txt.textContent = 'Tiada sensor kompas — guna kompas fizikal pada ' +
          C.fmtDegMin(bearing) + ' dari utara';
      } else {
        txt.textContent = 'Menunggu bacaan kompas…';
      }
      btnCompass.hidden = !showBtn;
      return;
    }

    btnCompass.hidden = true;

    var heading = C.wrap360(liveHeading + (Number(st.compassOffset) || 0));
    var delta = C.wrap180(bearing - heading);
    var abs = Math.abs(delta);

    var dial = $('dial');
    if (dial) dial.setAttribute('transform', 'rotate(' + (-heading) + ' 160 160)');

    var dTxt;
    if (abs <= 2.5) dTxt = 'Tepat pada kiblat';
    else dTxt = Math.round(abs) + '° ke ' + (delta > 0 ? 'kanan' : 'kiri');
    $('qDelta').textContent = dTxt;

    wrap.classList.toggle('aligned', abs <= 3);

    var stateEl = $('compassState');
    stateEl.className = 'compass-state live';
    $('compassStateText').textContent = 'Kompas aktif · menghadap ' +
      Math.round(heading) + '°' + (window.Compass.absolute ? ' (utara sebenar)' : '');
  }

  /* ------------------------------------------------------------ settings */

  function syncSettings() {
    var st = C.state;

    var sel = $('setCity');
    sel.innerHTML = '';
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'Tetapkan sendiri';
    sel.appendChild(opt);
    C.CITIES.forEach(function (c, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = c.name;
      sel.appendChild(o);
    });
    var idx = C.CITIES.findIndex(function (c) { return c.name === st.city; });
    sel.value = idx >= 0 ? String(idx) : '';

    $('setLat').value = st.lat.toFixed(4);
    $('setLon').value = st.lon.toFixed(4);

    $('setMethod').value = st.method;
    $('setFajr').value = st.fajrAngle;
    $('setIsha').value = st.ishaAngle;
    $('setAsr').value = String(st.asrFactor);
    $('setIhtiyat').value = st.ihtiyat;

    $('setQiblaMode').value = st.qiblaMode;
    $('setQBearing').value = Number(st.qiblaBearing.toFixed(2));
    $('setQOffset').value = st.compassOffset;

    $('setTzMode').value = st.tzMode;
    $('setTz').value = st.tzOffset;
    $('setHijri').value = String(st.hijriOffset);

    toggleMethodRows();
    $('rowTz').hidden = st.tzMode !== 'manual';
    applyTheme();
  }

  function buildAdjRows() {
    var card = $('adjCard');
    card.innerHTML = '';
    ADJ_KEYS.forEach(function (k) {
      var row = document.createElement('div');
      row.className = 'field';
      var fl = document.createElement('div');
      fl.className = 'fl';
      var n = document.createElement('div');
      n.className = 'n';
      n.textContent = C.META[k].label;
      fl.appendChild(n);

      var inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '1';
      inp.min = '-20';
      inp.max = '20';
      inp.inputMode = 'numeric';
      inp.dataset.adj = k;
      inp.value = C.state.adj[k] || 0;
      inp.addEventListener('change', function () {
        var v = parseInt(inp.value, 10);
        if (!isFinite(v)) v = 0;
        C.state.adj[k] = C.clamp(v, -20, 20);
        inp.value = C.state.adj[k];
        commit();
      });

      var unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = 'min';

      row.appendChild(fl);
      row.appendChild(inp);
      row.appendChild(unit);
      card.appendChild(row);
    });
  }

  function toggleMethodRows() {
    var custom = C.state.method === 'custom';
    $('rowFajr').hidden = !custom;
    $('rowIsha').hidden = !custom;
    var m = C.METHODS[C.state.method];
    $('methodDesc').textContent = m ? m.note : 'Tetapkan sudut sendiri';
  }

  function commit() {
    C.saveState();
    syncSettings();
    renderTimes(new Date());
    renderQibla();
  }

  /* -------------------------------------------------------------- views */

  function showView(name) {
    currentView = name;
    ['times', 'qibla', 'settings'].forEach(function (v) {
      $('view-' + v).classList.toggle('active', v === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('on', t.dataset.view === name);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (name === 'qibla') {
      renderQibla();
      window.Compass.requestPermission().then(function () {
        updateQiblaLive();
      });
      acquireWake();
    } else {
      window.Compass.stop();
      releaseWake();
    }
    if (name === 'settings') syncSettings();
  }

  async function acquireWake() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* not critical */ }
  }

  function releaseWake() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  /* ----------------------------------------------------------------- gps */

  function locate(silent) {
    if (gpsBusy) return;
    if (!navigator.geolocation) { toast('Peranti ini tiada sokongan GPS'); return; }
    if (!isSecure()) {
      toast('GPS hanya berfungsi pada https:// atau localhost');
      return;
    }
    gpsBusy = true;
    $('btnGps').classList.add('on');
    if (!silent) toast('Mencari lokasi…', 4000);

    navigator.geolocation.getCurrentPosition(function (pos) {
      gpsBusy = false;
      $('btnGps').classList.remove('on');
      var lat = pos.coords.latitude;
      var lon = pos.coords.longitude;
      C.state.lat = lat;
      C.state.lon = lon;
      var near = C.nearestCity(lat, lon);
      C.state.city = (near.deg < 0.75) ? near.city.name : 'Lokasi semasa';
      C.saveState();
      commit();
      toast('Lokasi dikemas kini · ' + C.state.city);
    }, function (err) {
      gpsBusy = false;
      $('btnGps').classList.remove('on');
      var msg = 'Gagal dapat lokasi';
      if (err.code === 1) msg = 'Kebenaran lokasi ditolak — tetapkan koordinat di Tetapan';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia';
      else if (err.code === 3) msg = 'Lokasi tamat masa';
      toast(msg, 4200);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  /* ---------------------------------------------------------------- init */

  function wire() {
    $('btnGps').addEventListener('click', function () { locate(); });

    document.querySelector('.brand').addEventListener('click', function () {
      showView('settings');
    });

    $('btnCompass').addEventListener('click', function () {
      window.Compass.resetSmoothing();
      window.Compass.requestPermission().then(function () { updateQiblaLive(); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { showView(t.dataset.view); });
    });

    // ---- location
    $('setCity').addEventListener('change', function () {
      var v = this.value;
      if (v === '') return;
      var c = C.CITIES[Number(v)];
      if (!c) return;
      C.state.city = c.name;
      C.state.lat = c.lat;
      C.state.lon = c.lon;
      commit();
    });
    $('setLat').addEventListener('change', function () {
      var v = parseFloat(this.value);
      if (!isFinite(v) || v < -90 || v > 90) { this.value = C.state.lat.toFixed(4); return; }
      C.state.lat = v;
      C.state.city = 'Tetapkan sendiri';
      commit();
    });
    $('setLon').addEventListener('change', function () {
      var v = parseFloat(this.value);
      if (!isFinite(v) || v < -180 || v > 180) { this.value = C.state.lon.toFixed(4); return; }
      C.state.lon = v;
      C.state.city = 'Tetapkan sendiri';
      commit();
    });
    $('btnUseGps').addEventListener('click', function () { locate(); });
    $('btnSaveLoc').addEventListener('click', function () {
      var la = parseFloat($('setLat').value);
      var lo = parseFloat($('setLon').value);
      if (isFinite(la) && isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180) {
        C.state.lat = la; C.state.lon = lo; C.state.city = 'Tetapkan sendiri';
        commit();
        toast('Koordinat disimpan');
      } else {
        toast('Koordinat tidak sah');
      }
    });

    // ---- calculation
    $('setMethod').addEventListener('change', function () {
      C.state.method = this.value;
      var m = C.METHODS[this.value];
      if (m) {
        if (m.fajr != null) C.state.fajrAngle = m.fajr;
        if (m.isha != null) C.state.ishaAngle = m.isha;
      }
      C.state.asrFactor = Number($('setAsr').value) || 1;
      commit();
    });
    $('setFajr').addEventListener('change', function () {
      var v = parseFloat(this.value);
      if (isFinite(v) && v >= 0 && v <= 30) { C.state.fajrAngle = v; commit(); }
      else { this.value = C.state.fajrAngle; }
    });
    $('setIsha').addEventListener('change', function () {
      var v = parseFloat(this.value);
      if (isFinite(v) && v >= 0 && v <= 30) { C.state.ishaAngle = v; commit(); }
      else { this.value = C.state.ishaAngle; }
    });
    $('setAsr').addEventListener('change', function () {
      C.state.asrFactor = Number(this.value) || 1;
      commit();
    });
    $('setIhtiyat').addEventListener('change', function () {
      var v = parseInt(this.value, 10);
      C.state.ihtiyat = isFinite(v) ? C.clamp(v, 0, 10) : 2;
      commit();
    });

    // ---- qibla settings
    $('setQiblaMode').addEventListener('change', function () {
      C.state.qiblaMode = this.value;
      commit();
    });
    $('setQBearing').addEventListener('change', function () {
      var v = parseFloat(this.value);
      if (isFinite(v)) { C.state.qiblaBearing = C.wrap360(v); this.value = C.state.qiblaBearing.toFixed(2); commit(); }
      else { this.value = C.state.qiblaBearing.toFixed(2); }
    });
    $('setQOffset').addEventListener('change', function () {
      var v = parseFloat(this.value);
      C.state.compassOffset = isFinite(v) ? C.clamp(v, -20, 20) : 0;
      this.value = C.state.compassOffset;
      C.saveState();
      updateQiblaLive();
    });

    // ---- display
    $('setTzMode').addEventListener('change', function () {
      C.state.tzMode = this.value;
      $('rowTz').hidden = this.value !== 'manual';
      commit();
    });
    $('setTz').addEventListener('change', function () {
      var v = parseFloat(this.value);
      C.state.tzOffset = isFinite(v) ? C.clamp(v, -12, 14) : 8;
      this.value = C.state.tzOffset;
      commit();
    });
    $('setHijri').addEventListener('change', function () {
      C.state.hijriOffset = parseInt(this.value, 10) || 0;
      commit();
    });

    // ---- theme
    Array.prototype.forEach.call($('themePick').children, function (b) {
      b.addEventListener('click', function () {
        C.state.theme = b.dataset.theme;
        C.saveState();
        applyTheme();
      });
    });

    // ---- install sebagai PWA
    var installPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installPrompt = e;
      $('installRow').hidden = false;
    });
    $('btnInstall').addEventListener('click', function () {
      if (!installPrompt) { toast('Guna menu pelayar → Pasang app'); return; }
      installPrompt.prompt();
      installPrompt.userChoice.then(function () {
        installPrompt = null;
        $('installRow').hidden = true;
      });
    });
    window.addEventListener('appinstalled', function () {
      installPrompt = null;
      $('installRow').hidden = true;
      toast('App dipasang');
    });

    // ---- reset
    $('btnReset').addEventListener('click', function () {
      if (!confirm('Set semula semua tetapan kepada asal?')) return;
      C.resetState();
      buildAdjRows();
      syncSettings();
      renderTimes(new Date());
      renderQibla();
      toast('Tetapan diset semula');
    });

    // ---- qibla page controls
    Array.prototype.forEach.call($('qiblaMode').children, function (b) {
      b.addEventListener('click', function () {
        C.state.qiblaMode = b.dataset.mode;
        C.saveState();
        renderQibla();
      });
    });

    function readManualBearing() {
      var d = parseInt($('qDeg').value, 10);
      var m = parseInt($('qMin').value, 10);
      if (!isFinite(d)) d = 0;
      if (!isFinite(m)) m = 0;
      d = C.clamp(d, 0, 359);
      m = C.clamp(m, 0, 59);
      C.state.qiblaBearing = C.wrap360(d + m / 60);
      C.saveState();
      renderQibla();
    }
    $('qDeg').addEventListener('change', readManualBearing);
    $('qMin').addEventListener('change', readManualBearing);

    // ---- compass stream
    window.Compass.on(function (p) {
      liveHeading = p.heading;
      if (currentView === 'qibla') updateQiblaLive();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && currentView === 'qibla') {
        window.Compass.start();
        acquireWake();
      }
    });
  }

  function init() {
    var hadSave = false;
    try { hadSave = !!localStorage.getItem('waktu-solat/v1'); } catch (e) {}

    C.loadState();
    applyTheme();
    buildDial();
    buildAdjRows();
    syncSettings();
    wire();

    renderTimes(new Date());
    renderQibla();
    setInterval(tick, 1000);
    tick();

    if (!hadSave) setTimeout(function () { locate(true); }, 800);

    if ('serviceWorker' in navigator && isSecure()) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
