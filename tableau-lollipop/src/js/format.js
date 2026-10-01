/* Lollipop Viz Extension - number formatting and axis tick maths. */
(function (global) {
  'use strict';

  var COMPACT = [
    { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'K' }
  ];

  function groupThousands (str, on) {
    if (!on) return str;
    var parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /* Decide a sensible decimal count when the user has not fixed one. */
  function autoDecimals (n) {
    var a = Math.abs(n);
    if (a === 0) return 0;
    /* Never invent a decimal for a whole number. Without this, a count of 840
     * renders as "840.0", which reads as a measurement rather than a count. */
    if (n === Math.floor(n)) return 0;
    if (a >= 1000) return 0;
    if (a >= 100) return 1;
    if (a >= 1) return 2;
    if (a >= 0.01) return 3;
    return 4;
  }

  /* Format one number according to the resolved settings object. */
  function number (value, s) {
    if (value === null || value === undefined || value === '' || !isFinite(value)) return '';
    var n = Number(value);
    var style = s.numStyle || 'auto';
    var dec = s.numAutoDecimals ? null : (s.numDecimals || 0);
    var out;

    if (style === 'scientific') {
      out = n.toExponential(dec === null ? 2 : dec);
      return (s.numPrefix || '') + out + (s.numSuffix || '');
    }

    if (style === 'percent') {
      var p = n * 100;
      var pd = dec === null ? autoDecimals(p) : dec;
      out = groupThousands(p.toFixed(pd), s.numThousands) + '%';
      return (s.numPrefix || '') + out + (s.numSuffix || '');
    }

    if (style === 'compact' || (style === 'auto' && Math.abs(n) >= 10000)) {
      for (var i = 0; i < COMPACT.length; i++) {
        if (Math.abs(n) >= COMPACT[i].v) {
          var scaled = n / COMPACT[i].v;
          var cd = dec === null ? (Math.abs(scaled) >= 100 ? 0 : 1) : dec;
          out = scaled.toFixed(cd).replace(/\.0+$/, '') + COMPACT[i].s;
          var cpre = style === 'currency' ? (s.numCurrency || '$') : '';
          return (s.numPrefix || '') + cpre + out + (s.numSuffix || '');
        }
      }
    }

    var d = dec === null ? autoDecimals(n) : dec;
    out = groupThousands(n.toFixed(d), s.numThousands);
    if (style === 'currency') {
      var sym = s.numCurrency || '$';
      out = (n < 0 ? '-' : '') + sym + out.replace('-', '');
    }
    return (s.numPrefix || '') + out + (s.numSuffix || '');
  }

  /* "Nice" axis bounds and ticks, the standard 1/2/5/10 progression. */
  function niceNum (range, round) {
    var exp = Math.floor(Math.log(range) / Math.LN10);
    var frac = range / Math.pow(10, exp);
    var nice;
    if (round) {
      if (frac < 1.5) nice = 1;
      else if (frac < 3) nice = 2;
      else if (frac < 7) nice = 5;
      else nice = 10;
    } else {
      if (frac <= 1) nice = 1;
      else if (frac <= 2) nice = 2;
      else if (frac <= 5) nice = 5;
      else nice = 10;
    }
    return nice * Math.pow(10, exp);
  }

  /* Returns { min, max, step, ticks[] } covering [lo, hi] in about `count` steps. */
  function ticks (lo, hi, count) {
    if (!isFinite(lo) || !isFinite(hi)) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
    if (lo === hi) { hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1); }
    count = Math.max(2, count || 5);
    var range = niceNum(hi - lo, false);
    var step = niceNum(range / (count - 1), true);
    var min = Math.floor(lo / step) * step;
    var max = Math.ceil(hi / step) * step;
    var out = [];
    /* Accumulate with a guard so floating point drift cannot spin forever. */
    var guard = 0;
    for (var v = min; v <= max + step * 0.5 && guard < 1000; v += step, guard++) {
      out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    }
    return { min: min, max: max, step: step, ticks: out };
  }

  /* Trim text to a character budget with a true ellipsis. */
  function trim (text, maxChars) {
    var t = String(text === null || text === undefined ? '' : text);
    if (!maxChars || t.length <= maxChars) return t;
    return t.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  global.LP = global.LP || {};
  global.LP.format = {
    number: number,
    ticks: ticks,
    trim: trim,
    autoDecimals: autoDecimals
  };
})(typeof window !== 'undefined' ? window : globalThis);
