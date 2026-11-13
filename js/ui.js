/* ==========================================================================
   ui.js — rendering, navigation, settings (data JAKIM)
   ========================================================================== */
(function () {
  'use strict';

  var C = window.Core;
  var $ = function (id) { return document.getElementById(id); };

  var DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  var MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
                'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

  var PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

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
  var pushedClock = false;
  var lastDateStr = '';
  var clockSig = '';

  /* ----------------------------------------------------------- mode TV */

  var IS_TV = false;
  try {
    IS_TV = !!(window.AndroidNotif && window.AndroidNotif.isTv && window.AndroidNotif.isTv());
  } catch (e) {}
  if (!IS_TV) {
    // Heuristic: skrin besar landskap tanpa sentuhan (contoh: TV box / PC)
    try {
      IS_TV = matchMedia('(min-width:1100px) and (orientation:landscape)').matches &&
              matchMedia('(hover:hover) and (pointer:fine)').matches &&
              !('ontouchstart' in window);
    } catch (e) {}
  }

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

  function hijriText(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);

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

  function zoneText() {
    var z = C.zoneOf(C.state.zone);
    return z ? z.code + ' · ' + z.name : C.state.zone;
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
      .map(function (k) { return times[k] ? { key: k, date: times[k] } : null; })
      .filter(function (e) { return e != null; });

    var next = null;
    for (var i = 0; i < events.length; i++) {
      if (events[i].date > now) { next = events[i]; break; }
    }

    var tomorrowTimes = null;
    if (!next) {
      tomorrowTimes = C.computeTimes(nextDay(now));
      if (!tomorrowTimes.missing && tomorrowTimes.fajr) {
        next = { key: 'fajr', date: tomorrowTimes.fajr, tomorrow: true };
      }
    }

    var current = null;
    for (var j = events.length - 1; j >= 0; j--) {
      if (events[j].date <= now) { current = events[j]; break; }
    }

    return { times: times, events: events, next: next, current: current,
             tomorrowTimes: tomorrowTimes, missing: !!times.missing };
  }

  /* -------------------------------------------------------------- render */

  function renderTimes(now) {
    var sc = schedule(now);
    var st = C.state;

    // hero
    var name = sc.next ? C.META_LABELS[sc.next.key] : '—';
    $('heroEyebrow').textContent = sc.next
      ? (sc.next.tomorrow ? 'Seterusnya · esok' : 'Seterusnya')
      : 'Data JAKIM';
    $('nextName').textContent = name;
    $('nextTime').textContent = sc.next ? C.fmtTime(sc.next.date) : '—';
    if (sc.next) {
      $('countdown').innerHTML = 'lagi <b id="cdVal"></b>';
      updateCountdown(sc, now);
    } else {
      $('countdown').textContent = 'Data belum tersedia';
    }

    var nm = new Date(now.getTime());
    $('heroDate').innerHTML = DAYS[nm.getDay()] + '<br>' + nm.getDate() + ' ' +
      MONTHS[nm.getMonth()] + ' ' + nm.getFullYear();

    $('dateMiladi').textContent = DAYS[nm.getDay()] + ', ' + nm.getDate() + ' ' +
      MONTHS[nm.getMonth()] + ' ' + nm.getFullYear();
    var h = hijriText(nm);
    $('dateHijri').textContent = h || '—';
    $('zoneLabel').textContent = 'MYT (UTC+8)';

    // list
    var list = $('prayerList');
    var frag = document.createDocumentFragment();

    C.ORDER.forEach(function (key) {
      var label = C.META_LABELS[key];
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
      n1.textContent = label;
      nmEl.appendChild(n1);

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

    // nota sumber data
    var ds = C.dataSource();
    if (ds) {
      $('calcNote').innerHTML =
        'Data rasmi <b>JAKIM e-Solat ' + ds.year + '</b> · Zon <b>' + st.zone + '</b> · Masa MYT (UTC+8)';
    } else {
      $('calcNote').innerHTML = 'Data JAKIM belum tersedia untuk tarikh ini.';
    }

    lastSignature = signature(sc);
    updateLocationLabel();
  }

  function signature(sc) {
    if (!sc.next) return sc.missing ? 'missing' : '';
    return sc.next.key + ':' + sc.next.date.getTime();
  }

  function updateCountdown(sc, now) {
    var el = $('cdVal');
    if (!el || !sc.next) return;
    var ms = sc.next.date.getTime() - now.getTime();
    el.textContent = countdownText(ms);
  }

  function updateLocationLabel() {
    $('locLabel').textContent = zoneText();
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
    var ds = now.toDateString();
    if (ds !== lastDateStr) {
      lastDateStr = ds;
      renderTimes(now);
      pushSchedule();
      pushWidget();
    }
    if (currentView === 'clock') renderClock(now);
  }

  /* -------------------------------------------------------------- clock */

  function h12Parts(date) {
    var h = date.getHours();
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return { h: h12, m: date.getMinutes(), s: date.getSeconds(), ampm: h < 12 ? 'AM' : 'PM' };
  }

  function renderClock(now, force) {
    var sc = schedule(now);
    var st = C.state;
    var mini = st.clockStyle === 'mini';

    var boxF = $('clockFull'), boxM = $('clockMini');
    if (boxF) boxF.hidden = mini;
    if (boxM) boxM.hidden = !mini;

    var sig = signature(sc) + '|' + st.clockStyle + '|' +
              (now.getHours() < 12 ? 'A' : 'P') + '|' + now.toDateString();

    if (mini) {
      var m = h12Parts(now);
      var el = $('ckmTime');
      el.innerHTML = C.pad2(m.h) + ':' + C.pad2(m.m) +
        '<span class="ckm-sec num">' + C.pad2(m.s) + '</span>';
      var next = sc.next
        ? (C.META_LABELS[sc.next.key] + (sc.next.tomorrow ? ' · esok' : '') +
          ' pukul <b class="num">' + C.fmtTime(sc.next.date) + '</b>')
        : 'Data JAKIM belum tersedia';
      $('ckmNext').innerHTML = next + (sc.next ? ' &nbsp;·&nbsp; lagi <b>' +
        countdownText(sc.next.date.getTime() - now.getTime()) + '</b>' : '');
      return;
    }

    if (!force && sig === clockSig) {
      // kemas kini kira detik sahaja
      var cnt = $('ckCount');
      if (cnt && sc.next) cnt.textContent = countdownText(sc.next.date.getTime() - now.getTime());
      return;
    }
    clockSig = sig;

    var p = h12Parts(now);
    $('ckTime').innerHTML = C.pad2(p.h) + ':' + C.pad2(p.m) +
      '<span class="ampm">' + p.ampm + '</span>';
    var h = hijriText(now);
    $('ckDate').textContent = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' +
      MONTHS[now.getMonth()] + ' ' + now.getFullYear() + (h ? ' · ' + h : '');

    if (sc.next) {
      $('ckName').textContent = C.META_LABELS[sc.next.key] + (sc.next.tomorrow ? ' · esok' : '');
      $('ckNextAt').textContent = C.fmtTime(sc.next.date);
      $('ckCount').textContent = countdownText(sc.next.date.getTime() - now.getTime());
    } else {
      $('ckName').textContent = 'Data JAKIM belum tersedia';
      $('ckNextAt').textContent = '—';
      $('ckCount').textContent = '—';
    }

    var grid = $('ckGrid');
    var frag = document.createDocumentFragment();
    C.ORDER.forEach(function (key) {
      var date = sc.times[key];
      var cell = document.createElement('div');
      cell.className = 'ck-cell';
      if (date) {
        if (sc.next && sc.next.key === key && !sc.next.tomorrow) cell.classList.add('is-next');
        else if (date < now) cell.classList.add('is-past');
      }
      var k = document.createElement('div');
      k.className = 'k';
      k.textContent = C.META_LABELS[key];
      var t = document.createElement('div');
      t.className = 't';
      t.textContent = C.fmtTime(date);
      cell.appendChild(k);
      cell.appendChild(t);
      frag.appendChild(cell);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  /* -------------------------------------------------- notifikasi (APK) */

  function pushSchedule() {
    try {
      if (!window.AndroidNotif || !window.AndroidNotif.schedule) return;
      if (!C.state.notify) { window.AndroidNotif.cancel(); return; }

      var now = new Date();
      var days = [now, nextDay(now)];
      var events = [];
      days.forEach(function (day) {
        var times = C.computeTimes(day);
        if (times.missing) return;
        PRAYER_KEYS.forEach(function (k) {
          if (times[k] && times[k].getTime() > now.getTime() - 60000) {
            events.push({ key: k, label: C.META_LABELS[k], ms: times[k].getTime() });
          }
        });
      });
      window.AndroidNotif.schedule(JSON.stringify(events));
    } catch (e) {}
  }

  /* ------------------------------------------------------ widget (APK) */

  function pushWidget() {
    try {
      if (!window.AndroidNotif || !window.AndroidNotif.updateWidget) return;
      var days = [];
      [new Date(), nextDay(new Date())].forEach(function (day) {
        var times = C.computeTimes(day);
        if (times.missing) return;
        var t = {};
        C.ORDER.forEach(function (k) {
          t[k] = times[k] ? times[k].getTime() : 0;
        });
        days.push({
          date: day.getFullYear() + '-' + C.pad2(day.getMonth() + 1) + '-' + C.pad2(day.getDate()),
          times: t
        });
      });
      window.AndroidNotif.updateWidget(JSON.stringify({
        city: C.state.zone, days: days
      }));
    } catch (e) {}
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
    if (g && bearing != null) g.setAttribute('transform', 'rotate(' + bearing + ' 160 160)');
  }

  function renderQibla() {
    var st = C.state;
    var bearing = C.activeQiblaBearing();

    if (bearing == null) {
      $('qiblaBig').textContent = '—';
      $('qiblaCap').textContent = 'Benarkan GPS untuk arah kiblat';
    } else {
      $('qiblaBig').innerHTML = C.fmtDegMin(bearing).replace('°', '°<span>').replace('′', '′</span>');
      $('qiblaCap').textContent = st.qiblaMode === 'manual'
        ? 'Mengikut bearing manual'
        : 'Arah kiblat dari GPS anda';
    }

    positionQibla(bearing);

    if (st.gpsLat != null && st.gpsLon != null) {
      var dist = C.distanceToKaaba(st.gpsLat, st.gpsLon);
      $('qDist').textContent = Math.round(dist).toLocaleString('ms-MY') + ' km';
    } else {
      $('qDist').textContent = '—';
    }

    // mode segmented control
    Array.prototype.forEach.call($('qiblaMode').children, function (b) {
      b.classList.toggle('on', b.dataset.mode === st.qiblaMode);
    });
    $('bearingBox').hidden = st.qiblaMode !== 'manual';
    $('qDeg').value = Math.floor(C.wrap360(st.qiblaBearing));
    $('qMin').value = Math.round((C.wrap360(st.qiblaBearing) % 1) * 60) % 60;

    var note;
    if (st.qiblaMode === 'manual') {
      note = 'Bearing manual: <b>' + C.fmtDegMin(st.qiblaBearing) + '</b>.';
    } else if (bearing == null) {
      note = 'Tekan <b>Guna GPS</b> untuk dapat bearing kiblat lokasi anda, ' +
             'atau tukar ke <b>Manual</b> dan masukkan bearing sendiri.';
    } else {
      note = 'Dikira dari koordinat GPS anda ke Kaabah. Tukar ke <b>Manual</b> ' +
             'jika mahu guna nilai bearing sendiri.';
    }
    $('qiblaNote').innerHTML = note;

    updateQiblaLive();
  }

  function updateQiblaLive() {
    var st = C.state;
    var bearing = C.activeQiblaBearing();
    var wrap = $('compassWrap');

    var btnCompass = $('btnCompass');

    if (bearing == null) {
      $('qDelta').textContent = '—';
      wrap.classList.remove('aligned');
      var txt = $('compassStateText');
      var stateEl = $('compassState');
      var perm = window.Compass.permission;
      var showBtn = false;
      stateEl.className = 'compass-state warn';

      if (st.qiblaMode === 'manual') {
        txt.textContent = 'Guna kompas fizikal pada ' + C.fmtDegMin(st.qiblaBearing) + ' dari utara';
      } else if (!window.Compass.isSecure()) {
        txt.textContent = 'Kompas/GPS perlukan sambungan https:// atau localhost';
      } else if (perm === 'denied') {
        txt.textContent = 'Akses kompas tidak dibenarkan — guna kompas fizikal';
      } else if (perm === 'unsupported') {
        txt.textContent = 'Tiada sensor kompas — guna kompas fizikal';
      } else {
        txt.textContent = 'Tekan Guna GPS untuk mulakan';
        showBtn = true;
      }
      btnCompass.hidden = !showBtn;
      return;
    }

    if (liveHeading == null) {
      $('qDelta').textContent = '—';
      wrap.classList.remove('aligned');
      var txt2 = $('compassStateText');
      var stateEl2 = $('compassState');
      var perm2 = window.Compass.permission;
      var showBtn2 = false;
      stateEl2.className = 'compass-state warn';

      if (!window.Compass.isSecure()) {
        txt2.textContent = 'Kompas perlukan sambungan https:// atau localhost';
      } else if (perm2 === 'denied') {
        txt2.textContent = 'Akses kompas tidak dibenarkan — guna kompas fizikal pada ' +
          C.fmtDegMin(bearing) + ' dari utara';
      } else if (window.Compass.needsPermission() && perm2 !== 'granted') {
        txt2.textContent = 'Benarkan akses kompas untuk melihat arah';
        showBtn2 = true;
      } else if (perm2 === 'unsupported') {
        txt2.textContent = 'Tiada sensor kompas — guna kompas fizikal pada ' +
          C.fmtDegMin(bearing) + ' dari utara';
      } else {
        txt2.textContent = 'Menunggu bacaan kompas…';
      }
      btnCompass.hidden = !showBtn2;
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

    var stateEl3 = $('compassState');
    stateEl3.className = 'compass-state live';
    $('compassStateText').textContent = 'Kompas aktif · menghadap ' +
      Math.round(heading) + '°' + (window.Compass.absolute ? ' (utara sebenar)' : '');
  }

  /* ------------------------------------------------------------ settings */

  function syncSettings() {
    var st = C.state;

    var sel = $('setZone');
    sel.innerHTML = '';
    var lastState = '';
    C.ZONES.forEach(function (z) {
      if (z.state !== lastState) {
        var g = document.createElement('optgroup');
        g.label = z.state;
        sel.appendChild(g);
        lastState = z.state;
      }
      var o = document.createElement('option');
      o.value = z.code;
      o.textContent = z.code + ' — ' + z.name;
      sel.appendChild(o);
    });
    sel.value = st.zone;

    $('setQiblaMode').value = st.qiblaMode;
    $('setQBearing').value = Number(st.qiblaBearing.toFixed(2));
    $('setQOffset').value = st.compassOffset;

    $('setClockStyle').value = st.clockStyle === 'mini' ? 'mini' : 'full';
    $('setAutoClock').value = st.autoClock ? '1' : '0';
    $('setNotify').value = st.notify ? '1' : '0';

    applyTheme();
  }

  function commit() {
    C.saveState();
    syncSettings();
    renderTimes(new Date());
    renderQibla();
    pushSchedule();
    pushWidget();
  }

  /* -------------------------------------------------------------- views */

  function showView(name, viaPop) {
    if (name === 'clock') {
      if (!pushedClock && !viaPop) {
        try { history.pushState({ vs: 'clock' }, ''); } catch (e) {}
      }
      pushedClock = true;
    }
    currentView = name;
    ['times', 'clock', 'qibla', 'settings'].forEach(function (v) {
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
      if (name !== 'clock') releaseWake();
    }
    if (name === 'clock') {
      renderClock(new Date(), true);
      acquireWake();
      try {
        if (window.AndroidNotif && window.AndroidNotif.keepScreenOn) {
          window.AndroidNotif.keepScreenOn(true);
        }
      } catch (e) {}
    } else {
      try {
        if (window.AndroidNotif && window.AndroidNotif.keepScreenOn) {
          window.AndroidNotif.keepScreenOn(false);
        }
      } catch (e) {}
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
    if (!silent) toast('Mencari lokasi…', 4000);

    navigator.geolocation.getCurrentPosition(function (pos) {
      gpsBusy = false;
      C.state.gpsLat = pos.coords.latitude;
      C.state.gpsLon = pos.coords.longitude;
      C.saveState();
      renderQibla();
      toast('GPS dikemas kini');
    }, function (err) {
      gpsBusy = false;
      var msg = 'Gagal dapat lokasi';
      if (err.code === 1) msg = 'Kebenaran lokasi ditolak';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia';
      else if (err.code === 3) msg = 'Lokasi tamat masa';
      toast(msg, 4200);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  /* ---------------------------------------------------------- d-pad nav */

  function dpadItems() {
    var sel = '#view-' + currentView +
      ' button:not([hidden]):not([disabled]),' +
      '#view-' + currentView + ' a,' +
      '#view-' + currentView + ' select:not([hidden]),' +
      '#view-' + currentView + ' input:not([hidden]):not([type=hidden]),' +
      '.topbar button, .tabbar button';
    return Array.prototype.filter.call(document.querySelectorAll(sel), function (el) {
      return el.offsetParent !== null || el.closest('.tabbar') || el.closest('.topbar');
    });
  }

  function spatialNext(cur, items, dir) {
    var r1 = cur.getBoundingClientRect();
    var dx = dir === 'ArrowLeft' ? -1 : dir === 'ArrowRight' ? 1 : 0;
    var dy = dir === 'ArrowUp' ? -1 : dir === 'ArrowDown' ? 1 : 0;
    var best = null, bestScore = Infinity;
    items.forEach(function (el) {
      if (el === cur) return;
      var r2 = el.getBoundingClientRect();
      var c1x = r1.left + r1.width / 2, c1y = r1.top + r1.height / 2;
      var c2x = r2.left + r2.width / 2, c2y = r2.top + r2.height / 2;
      var vx = c2x - c1x, vy = c2y - c1y;
      var forward = vx * dx + vy * dy;
      if (forward <= 0) return;
      var cross = Math.abs(vx * dy - vy * dx);
      var score = forward + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  }

  function wire() {
    $('btnClock').addEventListener('click', function () { showView('clock'); });
    $('btnClockExit').addEventListener('click', function () {
      if (pushedClock) {
        try { history.back(); } catch (e) {}
      } else {
        showView('times');
      }
    });

    // Butang Back remote TV / peranti: dari Mod Jam kembali ke Waktu Solat.
    window.addEventListener('popstate', function () {
      if (pushedClock) {
        pushedClock = false;
        showView('times', true);
      }
    });

    // ---- navigasi D-pad (remote TV)
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape' && currentView === 'clock') {
        e.preventDefault();
        if (pushedClock) { try { history.back(); } catch (err) {} }
        else showView('times');
        return;
      }
      if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;

      var items = dpadItems();
      if (!items.length) return;
      var idx = items.indexOf(document.activeElement);
      if (idx < 0) {
        items[0].focus();
        e.preventDefault();
        return;
      }
      var next = spatialNext(document.activeElement, items, k);
      if (next) {
        next.focus();
        e.preventDefault();
        if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest' });
      }
    });

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

    // ---- zon JAKIM
    $('setZone').addEventListener('change', function () {
      C.state.zone = this.value;
      commit();
      toast('Zon: ' + zoneText());
    });

    // ---- kemas kini data JAKIM
    $('btnRefresh').addEventListener('click', function () {
      var btn = this;
      var z = C.state.zone;
      btn.disabled = true;
      $('refreshStatus').textContent = 'Memuat turun data JAKIM ' + z + '…';
      C.refreshZone(z, function (err, n) {
        btn.disabled = false;
        if (err) {
          $('refreshStatus').textContent = 'Gagal — semak sambungan internet.';
          toast('Gagal kemas kini: ' + err.message, 4200);
        } else {
          $('refreshStatus').textContent = 'Data terkini dimuat (' + n + ' hari).';
          toast('Data JAKIM dikemas kini');
          commit();
        }
      });
    });

    // ---- kiblat settings
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

    // ---- GPS (untuk kiblat)
    $('btnUseGps').addEventListener('click', function () { locate(); });

    // ---- mod jam & notifikasi
    $('setClockStyle').addEventListener('change', function () {
      C.state.clockStyle = this.value === 'mini' ? 'mini' : 'full';
      commit();
      if (currentView === 'clock') renderClock(new Date(), true);
    });
    $('setAutoClock').addEventListener('change', function () {
      C.state.autoClock = this.value === '1';
      commit();
    });
    $('setNotify').addEventListener('change', function () {
      C.state.notify = this.value === '1';
      commit();
      toast(C.state.notify ? 'Notifikasi waktu solat dihidupkan' : 'Notifikasi dimatikan');
    });

    // ---- theme
    Array.prototype.forEach.call($('themePick').children, function (b) {
      b.addEventListener('click', function () {
        C.state.theme = b.dataset.theme;
        C.saveState();
        applyTheme();
      });
    });

    // ---- reset
    $('btnReset').addEventListener('click', function () {
      if (!confirm('Set semula semua tetapan kepada asal?')) return;
      C.resetState();
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
    try { hadSave = !!localStorage.getItem('waktu-solat/v2') || !!localStorage.getItem('waktu-solat/v1'); } catch (e) {}

    C.loadState();

    // Mod TV: pertama kali dibuka pada TV — hidupkan jam & notifikasi.
    if (IS_TV && !hadSave) {
      C.state.autoClock = true;
      C.state.notify = true;
      C.saveState();
    }

    if (IS_TV) document.body.classList.add('tv-mode');

    applyTheme();
    buildDial();
    syncSettings();
    wire();

    lastDateStr = new Date().toDateString();
    var startView = C.state.autoClock ? 'clock' : 'times';
    showView(startView);
    renderTimes(new Date());
    renderQibla();
    setInterval(tick, 1000);
    tick();
    pushSchedule();
    pushWidget();

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
