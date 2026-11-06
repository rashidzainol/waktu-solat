/* ==========================================================================
   compass.js — device orientation → true-ish heading
   --------------------------------------------------------------------------
   Heading is derived from the rotation matrix so it behaves correctly for
   both flat and near-upright holds. The "pointing" axis used is the top edge
   of the phone (device +Y), which is what you sight along when the phone is
   held flat in front of you.

   Note: Android's absolute orientation is referenced to magnetic north.
   Magnetic declination in Malaysia is < 1°, and a manual offset is provided
   in settings for any residual error.
   ========================================================================== */
(function (global) {
  'use strict';

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  var supported = ('DeviceOrientationEvent' in global);
  var listening = false;
  var usingAbsolute = false;
  var permissionState = 'unknown';   // unknown | granted | denied | unsupported

  var smooth = null;
  var lastRaw = null;
  var lastTime = 0;
  var tilt = 0;                       // |sin(pitch)| 0 = flat
  var listeners = [];
  var latest = null;                  // last computed heading (deg) or null

  function emit() {
    var payload = {
      heading: latest,
      smooth: smooth,
      tilt: tilt,
      supported: supported && permissionState !== 'denied' && permissionState !== 'unsupported',
      absolute: usingAbsolute
    };
    listeners.forEach(function (fn) {
      try { fn(payload); } catch (e) {}
    });
  }

  function on(fn) {
    listeners.push(fn);
    if (latest !== null || supported) fn({ heading: latest, smooth: smooth, tilt: tilt,
      supported: supported && permissionState !== 'unsupported' && permissionState !== 'denied',
      absolute: usingAbsolute });
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  }

  // Rotation matrix (W3C) → heading of the phone's top edge, in degrees CW from north.
  function headingFromEuler(alpha, beta, gamma) {
    var _x = beta * D2R, _y = gamma * D2R, _z = alpha * D2R;
    var cX = Math.cos(_x), sX = Math.sin(_x);
    var cY = Math.cos(_y), sY = Math.sin(_y);
    var cZ = Math.cos(_z), sZ = Math.sin(_z);

    // Row 2 of R (device → earth): earth axes are X=east, Y=north, Z=up.
    var m12 = -cX * sZ;
    var m22 = cZ * cX;

    // Row 3 used to detect how upright the phone is.
    var m32 = sX;

    var len = Math.hypot(m12, m22);
    if (len < 0.25) return null;   // pointing straight up/down — ambiguous

    var heading = Math.atan2(m12, m22) * R2D;
    return { heading: (heading + 360) % 360, tilt: Math.abs(m32) };
  }

  function pushHeading(h, t, now) {
    if (h == null || !isFinite(h)) return;
    lastRaw = h;
    tilt = t == null ? 0 : t;

    if (smooth == null) {
      smooth = h;
    } else {
      // Circular exponential moving average.
      var d = ((h - smooth + 540) % 360) - 180;
      var dt = Math.min(0.25, Math.max(0.016, (now - lastTime) / 1000));
      var k = 1 - Math.pow(0.0018, dt);     // ~fast enough to feel live, slow enough to calm
      smooth = (smooth + d * k + 360) % 360;
    }
    lastTime = now;
    latest = smooth;
    emit();
  }

  function handleAbsolute(e) {
    if (typeof e.alpha !== 'number') return;
    usingAbsolute = true;
    var r = headingFromEuler(e.alpha, e.beta || 0, e.gamma || 0);
    if (r) pushHeading(r.heading, r.tilt, performance.now());
  }

  function handleRelative(e) {
    if (usingAbsolute) return;             // prefer the absolute stream
    // iOS provides a true-north heading directly.
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      usingAbsolute = true;
      var t = Math.abs(Math.sin((e.beta || 0) * D2R));
      pushHeading((e.webkitCompassHeading + 360) % 360, t, performance.now());
      return;
    }
    if (typeof e.alpha !== 'number' || !e.absolute) return;
    var r = headingFromEuler(e.alpha, e.beta || 0, e.gamma || 0);
    if (r) pushHeading(r.heading, r.tilt, performance.now());
  }

  function start() {
    if (!supported || listening) return true;
    global.addEventListener('deviceorientationabsolute', handleAbsolute, true);
    global.addEventListener('deviceorientation', handleRelative, true);
    listening = true;
    if (permissionState === 'unknown') permissionState = 'granted';
    // If nothing arrives in 2 s, mark as unavailable.
    setTimeout(function () {
      if (latest === null) {
        permissionState = permissionState === 'denied' ? 'denied' : 'unsupported';
        emit();
      }
    }, 2000);
    return true;
  }

  function stop() {
    if (!listening) return;
    global.removeEventListener('deviceorientationabsolute', handleAbsolute, true);
    global.removeEventListener('deviceorientation', handleRelative, true);
    listening = false;
  }

  // iOS 13+ requires an explicit user gesture.
  function requestPermission() {
    if (!supported) { permissionState = 'unsupported'; emit(); return Promise.resolve(false); }
    var DOE = global.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      return DOE.requestPermission().then(function (res) {
        if (res === 'granted') { permissionState = 'granted'; start(); emit(); return true; }
        permissionState = 'denied'; emit(); return false;
      }).catch(function () { permissionState = 'denied'; emit(); return false; });
    }
    permissionState = 'granted';
    return Promise.resolve(start());
  }

  function needsPermission() {
    var DOE = global.DeviceOrientationEvent;
    return !!(DOE && typeof DOE.requestPermission === 'function');
  }

  function isSecure() {
    return global.isSecureContext === true;
  }

  function resetSmoothing() { smooth = null; latest = null; }

  global.Compass = {
    on: on,
    start: start,
    stop: stop,
    requestPermission: requestPermission,
    needsPermission: needsPermission,
    isSecure: isSecure,
    resetSmoothing: resetSmoothing,
    get heading() { return smooth; },
    get raw() { return lastRaw; },
    get tilt() { return tilt; },
    get permission() { return permissionState; }
  };

})(window);
