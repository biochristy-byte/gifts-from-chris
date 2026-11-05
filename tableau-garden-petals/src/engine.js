/* Garden Petals engine. Pure rendering: takes a model and settings, draws flowers.
   No Tableau calls in here, so it runs in a test harness and in the extension alike.

   model = { title, valueName, referenceLabel,
             petalNames:[...], petalColors:[hex|''],
             flowers:[{ key, name, group, lat, lon, score, rank, caution, v:[...], ref:[...] }] }
   v and ref line up with petalNames; null means "no data". */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  var PALETTE = ['#6fa4dd', '#2468ae', '#f28b27', '#5c6470', '#a9aeb9', '#2f9e8f', '#c75b9b', '#8b6bd6'];

  var DEFAULTS = {
    layout: { mode: 'grid', fit: 'scroll', columns: 8, flowerSize: 110, colGap: 30, rowGap: 14, align: 'center',
              sort: 'score-desc', limit: 0, under: 'name-score', center: 'dot', nudge: true, viewBar: true },
    petals: { width: 35, tip: 'pointed', start: 90, direction: 'cw', opacity: 100, outline: 'none',
              scale: 'shared', fixed: 1, floor: 0, dot: 10, dotColor: '#ffffff', list: [] },
    values: { format: 'pct0', prefix: '', suffix: '' },
    reference: { show: true, color: '#2b2b2b', width: 1, label: '' },
    bloom: { on: true, size: 85, bg: '#fff5ee', accent: '#f28b27', dim: 70, title: '{flower} | {group}',
             subtitle: 'Compared with the {reference}', centerScore: true, labels: true, labelContent: 'name-value',
             labelSize: 0, key: true, arrows: true },
    title: { show: true, text: '', size: 22 },
    colors: { bg: '#fdf3ec', stage: '#ffffff', ink: '#1b2a2e', ink2: '#4a5c61', stem: '#3d9a66', coast: '#9fbcb2',
              land: '#e3ede8', bee: '#f2b21d', frost: '#5fc3ee', legendInk: '', hintInk: '' },
    fonts: { body: 'Poppins', title: 'Poppins', uiSize: 13, labelSize: 13 },
    fields: { ref: '', group: '', rank: '', color: '', lat: '', lon: '', caution: '', sci: '', math: '', read: '' },
    tooltip: { mode: 'auto' },
    effects: { frost: false, glowStyle: 'glow', frostPetal: '', frostAt: 80, wilt: false, twins: true, coast: 'peek', breeze: true, names: 'auto' }
  };

  function merge(base, over) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      var b = base ? base[k] : undefined, o = over[k];
      if (o && typeof o === 'object' && !Array.isArray(o) && b && typeof b === 'object' && !Array.isArray(b)) out[k] = merge(b, o);
      else out[k] = o;
    });
    return out;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }

  /* Equal Earth projection */
  var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M3 = Math.sqrt(3) / 2;
  function eqe(lon, lat) {
    var l = Math.asin(M3 * Math.sin(lat * Math.PI / 180)), l2 = l * l, l6 = l2 * l2 * l2, lam = lon * Math.PI / 180;
    return [lam * Math.cos(l) / (M3 * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))), -l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))];
  }
  var BX = eqe(180, 0)[0], TOPY = eqe(0, 80)[1], BOTY = eqe(0, -56)[1];
  var landPath = null;
  function getLand() {
    if (landPath || !global.GARDEN_LAND) return landPath;
    landPath = new Path2D();
    global.GARDEN_LAND.forEach(function (r) {
      r.forEach(function (p, i) { var q = eqe(p[0], p[1]); if (i === 0) landPath.moveTo(q[0], q[1]); else landPath.lineTo(q[0], q[1]); });
      landPath.closePath();
    });
    return landPath;
  }
  function hav(a, b) {
    var r = Math.PI / 180, la1 = a.lat * r, la2 = b.lat * r, dl = (b.lon - a.lon) * r, dp = la2 - la1;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  var CSS = [
    '.gp-root{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;font-family:var(--gp-font),system-ui,sans-serif;color:var(--gp-ink);background:var(--gp-bg)}',
    '.gp-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px 24px;padding:14px 56px 10px 22px;flex:0 0 auto}',
    '.gp-title{white-space:pre-line;font-family:var(--gp-tfont),system-ui,sans-serif;font-weight:700;line-height:1.1;margin:0;letter-spacing:-.01em}',
    '.gp-hl{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1 1 300px}',
    '.gp-quick{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.gp-seg{display:inline-flex;border:1px solid rgba(0,0,0,.18);border-radius:999px;overflow:hidden;background:var(--gp-stage)}',
    '.gp-seg button,.gp-tg{font:600 12px var(--gp-font),sans-serif;border:0;background:transparent;color:var(--gp-ink);padding:6px 13px;cursor:pointer}',
    '.gp-seg button[aria-pressed="true"]{background:var(--gp-ink);color:var(--gp-stage)}',
    '.gp-tg{border:1px solid rgba(0,0,0,.18);border-radius:999px;background:var(--gp-stage)}.gp-tg[aria-pressed="true"]{background:var(--gp-ink);color:var(--gp-stage)}',
    '.gp-quick button:focus-visible{outline:2px solid #2a76d2;outline-offset:1px}',
    '.gp-legend{display:flex;gap:14px;align-items:flex-start;background:var(--gp-panel);border-radius:10px;padding:8px 12px;max-width:100%;flex:0 1 auto}',
    '.gp-chips{display:flex;flex-direction:column;gap:4px;font-size:var(--gp-ui);color:var(--gp-legend)}',
    '.gp-chips span{display:flex;gap:7px;align-items:center;white-space:nowrap}',
    '.gp-chips i{width:10px;height:10px;border-radius:50%;flex:0 0 auto}',
    '.gp-read{max-width:260px;font-size:calc(var(--gp-ui) - 0.5px);color:var(--gp-legend);line-height:1.5}.gp-read b{letter-spacing:.08em;font-size:calc(var(--gp-ui) - 2px);color:var(--gp-legend)}',
    '.gp-stage{position:relative;flex:1 1 auto;min-height:0;overflow:hidden auto;scrollbar-gutter:stable;background:var(--gp-stage);margin:0 14px 12px;border-radius:12px}',
    '.gp-cv{display:block;touch-action:none}',
    '.gp-tip{position:absolute;pointer-events:none;background:var(--gp-ink);color:var(--gp-stage);font-size:12px;padding:8px 10px;border-radius:8px;z-index:5;max-width:280px;line-height:1.45}',
    '.gp-tip b{font-size:13px}.gp-tip .r{display:flex;gap:6px;align-items:center}.gp-tip .r i{width:8px;height:8px;border-radius:50%;display:inline-block}',
    '.gp-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:5px;z-index:4}',
    '.gp-zoom button{width:30px;height:30px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:var(--gp-stage);color:var(--gp-ink);font:600 16px sans-serif;cursor:pointer}',
    '.gp-hint{position:absolute;left:10px;bottom:8px;font-size:var(--gp-ui);color:var(--gp-hintc);background:var(--gp-panel);padding:3px 10px;border-radius:6px;pointer-events:none}',
    '.gp-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--gp-ink2);font-size:14px;line-height:1.6}',
    '.gp-gear{position:absolute;right:16px;top:10px;z-index:6;width:30px;height:30px;border-radius:50%;border:1px solid rgba(0,0,0,.15);background:var(--gp-stage);color:var(--gp-ink);font-size:16px;cursor:pointer}',
    '.gp-bloom{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.35);backdrop-filter:blur(4px)}',
    '.gp-bloom[hidden],.gp-msg[hidden],.gp-tip[hidden]{display:none!important}',
    '.gp-bin{background:var(--gp-bloombg);border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.22);padding:8px;position:relative;border:1px solid var(--gp-bloomline)}',
    '.gp-bin canvas{display:block}',
    '.gp-bbar{display:flex;gap:8px;justify-content:center;padding:6px 0 2px}',
    '.gp-bbar button{font:600 12px var(--gp-font),sans-serif;border:1px solid rgba(0,0,0,.18);background:var(--gp-stage);color:var(--gp-ink);border-radius:999px;padding:6px 14px;cursor:pointer}'
  ].join('\n');

  function create(root, hooks) {
    hooks = hooks || {};
    var S = merge(DEFAULTS, {});
    var model = { title: '', valueName: 'Value', referenceLabel: 'reference', petalNames: [], petalColors: [], flowers: [] };
    var F = [], P = [], N = 0, GMAX = 1, PMAX = [], hasGeo = false, hasScore = false, byRank = [];
    var C = {};
    var W = 0, H = 0, dpr = 1, T = 0, bs = 1, bx = 0, by = 0;
    var view = { z: 1, zt: 1, px: 0, pxT: 0, py: 0, pyT: 0 };
    var coast = { a: 0, hold: 0 };
    var picked = false, hover = -1, featured = -1, pulse = { i: -1, t0: -9 };
    var hits = [], raf = 0, running = false, last = 0, mode = 'grid', gridInfo = null;
    var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    root.classList.add('gp-root');
    root.innerHTML =
      '<div class="gp-head"><div class="gp-hl"><h1 class="gp-title"></h1><div class="gp-quick"></div></div><div class="gp-legend"><div class="gp-chips"></div><div class="gp-read"></div></div></div>' +
      '<div class="gp-stage"><canvas class="gp-cv" tabindex="0"></canvas><div class="gp-tip" hidden></div>' +
      '<div class="gp-zoom"><button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">&minus;</button><button data-z="reset" aria-label="Reset view">&#8634;</button></div>' +
      '<div class="gp-hint"></div><div class="gp-msg" hidden></div></div>' +
      '<div class="gp-bloom" hidden><div class="gp-bin"><canvas></canvas><div class="gp-bbar"><button data-b="prev">&larr; Previous</button><button data-b="next">Next &rarr;</button><button data-b="close">Close</button></div></div></div>';
    var $ = function (s) { return root.querySelector(s); };
    var elHead = $('.gp-head'), elTitle = $('.gp-title'), elQuick = $('.gp-quick'), elChips = $('.gp-chips'), elRead = $('.gp-read'), elStage = $('.gp-stage'),
        cv = $('.gp-cv'), ctx = cv.getContext('2d'), elTip = $('.gp-tip'), elZoom = $('.gp-zoom'), elHint = $('.gp-hint'),
        elMsg = $('.gp-msg'), elBloom = $('.gp-bloom'), bcv = $('.gp-bin canvas'), bctx = bcv.getContext('2d'), elBin = $('.gp-bin');
    var bl = { open: false, i: -1, t0: 0, raf: 0, W: 0, H: 0 };

    /* ---------- settings and model ---------- */
    function applyTheme() {
      var c = S.colors; C = { bg: c.bg, stage: c.stage, ink: c.ink, ink2: c.ink2, stem: c.stem, coast: c.coast, land: c.land, bee: c.bee, frost: c.frost };
      var f = '"' + S.fonts.body + '"', tf = '"' + S.fonts.title + '"';
      root.style.setProperty('--gp-bg', c.bg); root.style.setProperty('--gp-stage', c.stage); root.style.setProperty('--gp-ink', c.ink);
      var sg = c.stage.replace('#', ''), pr = parseInt(sg.slice(0, 2), 16) || 255, pg = parseInt(sg.slice(2, 4), 16) || 255, pb = parseInt(sg.slice(4, 6), 16) || 255;
      root.style.setProperty('--gp-panel', 'rgba(' + pr + ',' + pg + ',' + pb + ',0.92)');
      var lum = function (h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 0; var v = [0, 2, 4].map(function (i) { var x = parseInt(m[1].substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      var cr = function (x, y) { var a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      var pick = function (pref) { if (pref && cr(pref, c.stage) >= 7) return pref; var best = c.ink, bc = cr(c.ink, c.stage); ['#111111', '#ffffff'].forEach(function (k) { var q = cr(k, c.stage); if (q > bc) { best = k; bc = q; } }); return best; };
      root.style.setProperty('--gp-legend', c.legendInk || pick(c.ink)); root.style.setProperty('--gp-hintc', c.hintInk || pick(c.ink));
      root.style.setProperty('--gp-ui', (S.fonts.uiSize || 13) + 'px');
      root.style.setProperty('--gp-ink2', c.ink2); root.style.setProperty('--gp-font', f); root.style.setProperty('--gp-tfont', tf);
      root.style.setProperty('--gp-bloombg', S.bloom.bg); root.style.setProperty('--gp-bloomline', S.bloom.accent);
      C.fb = f + ',system-ui,sans-serif'; C.fd = tf + ',system-ui,sans-serif';
    }
    function setSettings(s) { S = merge(DEFAULTS, s || {}); applyTheme(); rebuild(); }
    function setData(m) { model = merge({ title: '', valueName: 'Value', referenceLabel: 'reference', petalNames: [], petalColors: [], flowers: [] }, m); rebuild(); }

    function fmt(v) {
      if (v == null || !fin(v)) return 'no data';
      var f = S.values.format, s;
      if (f === 'pct0') s = Math.round(v * 100) + '%'; else if (f === 'pct1') s = (v * 100).toFixed(1) + '%';
      else if (f === 'num0') s = String(Math.round(v)); else if (f === 'num1') s = v.toFixed(1); else if (f === 'num2') s = v.toFixed(2);
      else s = String(Math.round(v * 1000) / 1000);
      return (S.values.prefix || '') + s + (S.values.suffix || '');
    }
    function refLabel() { return S.reference.label || model.referenceLabel || 'reference'; }
    function titleText() { return S.title.text || model.title || ''; }

    function rebuild() {
      /* petal display list: user overrides first (order, name, colour), then anything new */
      var names = model.petalNames.slice(), disp = [];
      (S.petals.list || []).forEach(function (it) {
        var i = names.indexOf(it.src);
        if (i >= 0 && !disp.some(function (d) { return d.idx === i; })) disp.push({ idx: i, src: it.src, name: it.name || it.src, color: it.color || '' });
      });
      names.forEach(function (n, i) { if (!disp.some(function (d) { return d.idx === i; })) disp.push({ idx: i, src: n, name: n, color: '' }); });
      disp.forEach(function (d, k) { d.color = d.color || (model.petalColors && model.petalColors[d.idx]) || PALETTE[k % PALETTE.length]; });
      P = disp; N = P.length;

      var rows = model.flowers.map(function (m) {
        return { m: m, key: m.key, name: m.name, group: m.group || '', score: fin(m.score) ? m.score : null, lat: m.lat, lon: m.lon,
                 wilt: !!m.caution, extra: (m.extra || []).filter(function (x) { return fin(x.v); }), v: P.map(function (d) { var x = m.v[d.idx]; return fin(x) ? x : null; }),
                 ref: P.map(function (d) { var x = m.ref ? m.ref[d.idx] : null; return fin(x) ? x : null; }) };
      });
      var so = S.layout.sort;
      rows.sort(function (a, b) {
        if (so === 'none') return 0;
        if (so === 'name-asc') return a.name.localeCompare(b.name);
        if (so === 'name-desc') return b.name.localeCompare(a.name);
        if (so === 'group') return (a.group.localeCompare(b.group)) || ((b.score || 0) - (a.score || 0));
        var d = (b.score == null ? -Infinity : b.score) - (a.score == null ? -Infinity : a.score);
        return so === 'score-asc' ? -d : d;
      });
      if (S.layout.limit > 0) rows = rows.slice(0, S.layout.limit);
      var old = {}, fkey = picked && featured >= 0 && F[featured] ? F[featured].key : null; F.forEach(function (f) { old[f.key] = f; });
      F = rows.map(function (r, i) {
        var o = old[r.key], q = eqe(fin(r.lon) ? r.lon : 0, fin(r.lat) ? r.lat : 0);
        var f = o || { hx: 0, hy: 0, rx: 0, ry: 0, tx: 0, ty: 0, stemA: 1, fresh: true };
        f.i = i; f.key = r.key; f.name = r.name; f.group = r.group; f.score = r.score; f.lat = r.lat; f.lon = r.lon; f.wilt = r.wilt; f.extra = r.extra; f.v = r.v; f.ref = r.ref;
        f.wx = q[0]; f.wy = q[1]; f.ph = (i * 2.399) % TAU; f.rank = i; f.twins = [];
        return f;
      });
      hasGeo = F.length > 0 && F.every(function (f) { return fin(f.lat) && fin(f.lon); });
      hasScore = F.length > 0 && F.every(function (f) { return f.score != null; });
      GMAX = 0; PMAX = P.map(function () { return 0; });
      F.forEach(function (f) { f.v.concat(f.ref).forEach(function (x, j) { if (x != null) { GMAX = Math.max(GMAX, x); var k = j % N; PMAX[k] = Math.max(PMAX[k], x); } }); });
      if (GMAX <= 0) GMAX = 1;
      computeTwins();
      byRank = F.slice().sort(function (a, b) { return ((b.score == null ? -1e9 : b.score) - (a.score == null ? -1e9 : a.score)) || a.name.localeCompare(b.name); });
      if (hover >= F.length) hover = -1;
      featured = -1; if (fkey != null) F.forEach(function (f) { if (f.key === fkey) featured = f.i; });
      if (featured < 0) featured = F.length ? byRank[0].i : -1;
      buildHeader();
      setMode(S.layout.mode, true);
    }

    function computeTwins() {
      if (!S.effects.twins || N < 2) return;
      var pool = F.filter(function (f) { return f.v.every(function (x) { return x != null; }); });
      if (pool.length < 4) return;
      var mu = [], sd = [];
      for (var k = 0; k < N; k++) {
        var s1 = 0; pool.forEach(function (f) { s1 += f.v[k]; }); mu[k] = s1 / pool.length;
        var s2 = 0; pool.forEach(function (f) { s2 += Math.pow(f.v[k] - mu[k], 2); }); sd[k] = Math.sqrt(s2 / pool.length) || 1;
      }
      pool.forEach(function (f) { f.z = f.v.map(function (x, j) { return (x - mu[j]) / sd[j]; }); });
      pool.forEach(function (f) {
        var ds = [];
        pool.forEach(function (g) { if (g !== f) { var d = 0; for (var j = 0; j < N; j++) d += Math.pow(f.z[j] - g.z[j], 2); ds.push({ f: g, d: Math.sqrt(d) }); } });
        ds.sort(function (a, b) { return a.d - b.d; });
        f.twins = ds.slice(0, 3).map(function (t) { return { f: t.f, km: (hasGeo ? hav(f, t.f) : null) }; });
      });
    }

    function buildHeader() {
      elTitle.style.display = S.title.show ? '' : 'none';
      elTitle.textContent = titleText(); elTitle.style.fontSize = S.title.size + 'px';
      elChips.innerHTML = P.map(function (d) { return '<span><i style="background:' + esc(d.color) + '"></i>' + esc(d.name) + '</span>'; }).join('');
      elRead.innerHTML = '<b>HOW TO READ</b><br>Petal length = ' + esc(model.valueName) + (S.reference.show ? '<br>Outline = ' + esc(refLabel()) : '') + glowNote();
      buildQuick();
      elHead.style.display = (S.title.show || P.length || S.layout.viewBar) ? '' : 'none';
    }
    function glowNote() {
      var fi = frostIdx(); if (fi < 0) return '';
      var at = S.effects.frostAt, pct = GMAX <= 1.0001 ? at + '%' : String(at);
      return '<br>Glow = ' + esc(P[fi].name) + ' at ' + esc(pct) + ' or more';
    }
    function buildQuick() {
      elQuick.style.display = S.layout.viewBar && F.length ? '' : 'none';
      var views = [['grid', 'Grid'], ['garden', 'Garden map'], ['alt', 'Altitude']].filter(function (v) { return v[0] === 'grid' || (v[0] === 'garden' ? hasGeo : hasScore); });
      var h = '<span class="gp-seg" role="group" aria-label="View">' + views.map(function (v) { return '<button type="button" data-view="' + v[0] + '" aria-pressed="' + (mode === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</span>';
      h += '<button type="button" class="gp-tg" data-tg="frost" aria-pressed="' + !!S.effects.frost + '">Glow</button>';
      h += '<button type="button" class="gp-tg" data-tg="wilt" aria-pressed="' + !!S.effects.wilt + '">Wilt</button>';
      elQuick.innerHTML = h;
    }

    /* ---------- geometry ---------- */
    function petalLen(v, k) {
      var mx = S.petals.scale === 'own' ? (PMAX[k] || 1) : S.petals.scale === 'fixed' ? (S.petals.fixed || 1) : GMAX;
      return Math.max(S.petals.floor / 100 + 0.0001, Math.min(1.5, v / mx));
    }
    function angOf(k, wilt) {
      var a = -S.petals.start * Math.PI / 180 + (S.petals.direction === 'ccw' ? -1 : 1) * k * TAU / Math.max(N, 1);
      if (wilt) { var d = Math.atan2(Math.sin(Math.PI / 2 - a), Math.cos(Math.PI / 2 - a)); a += d * 0.26; }
      return a;
    }
    function petalPath(c, r0, L) {
      if (L < r0 + 0.6) L = r0 + 0.6;
      var sp = L - r0, hh = (S.petals.width / 35) * 0.44 * sp, tip = S.petals.tip === 'round' ? 0.98 : 0.78;
      c.moveTo(r0, 0);
      c.bezierCurveTo(r0 + sp * .25, -hh, r0 + sp * tip, -hh * (S.petals.tip === 'round' ? 1.0 : .78), L, 0);
      c.bezierCurveTo(r0 + sp * tip, hh * (S.petals.tip === 'round' ? 1.0 : .78), r0 + sp * .25, hh, r0, 0);
      c.closePath();
    }
    function frostIdx() {
      if (!S.effects.frost) return -1;
      for (var k = 0; k < N; k++) if (P[k].src === S.effects.frostPetal || P[k].name === S.effects.frostPetal) return k;
      if (!S.effects.frostPetal) for (var q = 0; q < N; q++) if (/\bphones?\b|\bfrost|\bcold\b/i.test(P[q].src)) return q;
      return -1;
    }
    function frostOn(f, fi) {
      if (fi < 0 || f.v[fi] == null) return false;
      return f.v[fi] >= (GMAX <= 1.0001 ? S.effects.frostAt / 100 : S.effects.frostAt);
    }

    function drawFlower(c, x, y, R, f, o) {
      var wilt = S.effects.wilt && f.wilt, fi = frostIdx(), frost = frostOn(f, fi), al = o.alpha == null ? 1 : o.alpha, gst = S.effects.glowStyle, gl = gst !== 'frost', ice = gst !== 'glow';
      var r0 = R * S.petals.dot / 100, rot = o.sway ? Math.sin(T * 0.8 + f.ph) * 0.035 : 0, op = S.petals.opacity / 100;
      c.save(); c.translate(x, y);
      if (frost) {
        var sh = 0.5 + 0.5 * Math.sin(T * 1.6 + f.ph), hr = R * (gl ? 2.1 : 1.65), g = c.createRadialGradient(0, 0, R * 0.2, 0, 0, hr);
        g.addColorStop(0, C.frost); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalAlpha = al * (gl ? 0.42 + 0.16 * sh : 0.22 + 0.10 * sh); c.fillStyle = g; c.beginPath(); c.arc(0, 0, hr, 0, TAU); c.fill();
      }
      for (var k = 0; k < N; k++) {
        var v = f.v[k], a = angOf(k, wilt) + rot, dim = (o.spot >= 0 && o.spot !== k) ? 0.13 : 1;
        c.save(); c.rotate(a);
        if (v == null) {
          c.globalAlpha = al * 0.55; c.setLineDash([2.5, 2.5]); c.lineWidth = 1; c.strokeStyle = C.ink2;
          c.beginPath(); petalPath(c, r0, R * 0.34); c.stroke();
        } else {
          var L = r0 + (R - r0) * petalLen(v, k) * (wilt ? 0.93 : 1);
          c.globalAlpha = al * dim * op * (wilt ? 0.86 : 1); c.fillStyle = P[k].color; c.beginPath(); petalPath(c, r0, L);
          if (frost && gl && k === fi) { c.shadowColor = C.frost; c.shadowBlur = Math.max(6, R * 0.55); }
          c.fill(); c.shadowBlur = 0; c.shadowColor = 'transparent';
          c.globalAlpha = al * dim * (wilt ? 0.86 : 1);
          if (S.petals.outline === 'dark') { c.lineWidth = Math.max(0.8, R * 0.04); c.strokeStyle = C.ink; c.stroke(); }
          else { c.lineWidth = Math.max(0.7, R * 0.035); c.strokeStyle = S.petals.outline === 'white' ? '#ffffff' : C.stage; c.stroke(); }
          if (frost && ice && k === fi) {
            c.lineWidth = Math.max(1.3, R * 0.08); c.strokeStyle = C.frost; c.beginPath(); petalPath(c, r0, L); c.stroke();
            var tw = 0.5 + 0.5 * Math.sin(T * 3 + f.ph); c.globalAlpha = al * (0.5 + 0.5 * tw); c.lineWidth = 1.1; c.beginPath();
            for (var s = 0; s < 3; s++) { var u = (0.55 + s * 0.18) * L, w = R * 0.09 * (1 + (s % 2)); c.moveTo(u, -w); c.lineTo(u, w); c.moveTo(u - w * .7, -w * .7); c.lineTo(u + w * .7, w * .7); }
            c.stroke();
          }
        }
        c.restore();
      }
      if (S.reference.show && o.outline !== false) {
        for (var j = 0; j < N; j++) {
          if (f.ref[j] == null || (o.spot >= 0 && o.spot !== j)) continue;
          c.save(); c.rotate(angOf(j, false) + rot); c.globalAlpha = al * (o.big ? 0.95 : 0.6); c.lineWidth = o.big ? 1.6 : Math.max(S.reference.width * 0.7, R * 0.05);
          c.strokeStyle = S.reference.color; c.setLineDash([]); c.beginPath(); petalPath(c, r0, r0 + (R - r0) * petalLen(f.ref[j], j)); c.stroke(); c.restore();
        }
      }
      if (S.layout.center !== 'none') {
        c.globalAlpha = al; c.fillStyle = S.petals.dotColor; c.beginPath(); c.arc(0, 0, Math.max(r0 * 1.15, 1.5), 0, TAU); c.fill();
        c.lineWidth = 0.8; c.strokeStyle = C.ink2; c.stroke();
      }
      if (wilt && !o.big) { c.globalAlpha = al * 0.5; c.setLineDash([3, 3]); c.lineWidth = 1; c.strokeStyle = C.ink2; c.beginPath(); c.arc(0, 0, R * 1.12, 0, TAU); c.stroke(); c.setLineDash([]); }
      c.restore();
      if (wilt && !reduce && !o.big) {
        var ph = ((T / 4.5) + f.ph / TAU) % 1;
        c.save(); c.translate(x + Math.sin(ph * 9 + f.ph) * R * 0.25, y + R * 0.3 + ph * R * 1.5); c.rotate(ph * 5 + f.ph); c.globalAlpha = al * (1 - ph) * 0.85;
        c.fillStyle = P[Math.min(2, N - 1)].color; c.beginPath(); petalPath(c, 0, R * 0.38); c.fill(); c.restore();
      }
    }

    /* ---------- layout and simulation ---------- */
    function stageSize() { return { w: Math.max(200, elStage.clientWidth), h: Math.max(160, elStage.clientHeight) }; }
    var underH = function () { var ls = S.fonts.labelSize || 13; return S.layout.under === 'none' ? 0 : (S.layout.under === 'name-score' ? Math.round(ls * 2.9) : Math.round(ls * 1.7)); };
    function computeGrid() {
      var st = stageSize(), n = F.length || 1, L = S.layout, uh = underH(), cols, R, cw, ch;
      if (L.fit === 'columns') {
        cols = Math.max(1, Math.min(n, L.columns)); cw = (st.w - 24 + L.colGap) / cols; R = Math.min(L.flowerSize / 2, (cw - L.colGap) / 2); ch = 2 * R + uh + L.rowGap + 8;
      } else if (L.fit === 'fit') {
        var best = 0; cols = 1;
        for (var c = 1; c <= n; c++) {
          var rows = Math.ceil(n / c), r = Math.min(((st.w - 24 + L.colGap) / c - L.colGap) / 2, ((st.h - 16 + L.rowGap) / rows - L.rowGap - uh - 8) / 2);
          if (r > best) { best = r; cols = c; }
        }
        R = Math.max(8, best); cw = 2 * R + L.colGap; ch = 2 * R + uh + L.rowGap + 8;
      } else {
        R = L.flowerSize / 2; cw = 2 * R + L.colGap; cols = Math.max(1, Math.floor((st.w - 24 + L.colGap) / cw)); ch = 2 * R + uh + L.rowGap + 8;
      }
      var rowsN = Math.ceil(n / cols), blockW = cols * cw - L.colGap, offX = L.align === 'left' ? 12 : L.align === 'right' ? st.w - 12 - blockW : (st.w - blockW) / 2;
      gridInfo = { cols: cols, cw: cw, ch: ch, R: R, offX: offX, rows: rowsN, height: rowsN * ch + 24 };
    }
    function canvasHeight() {
      var st = stageSize();
      if (mode === 'grid') { computeGrid(); return L_fitScroll() ? Math.max(st.h, gridInfo.height) : st.h; }
      return st.h;
    }
    function L_fitScroll() { return S.layout.fit !== 'fit'; }
    function groundY() { return H - 46; }
    function radius() {
      if (mode === 'grid') return gridInfo ? gridInfo.R : 20;
      var r = Math.max(9, Math.min(30, W / 46)); if (W < 600) r = Math.max(9, W / 38);
      if (S.layout.flowerSize && S.layout.flowerSize !== 110) r = S.layout.flowerSize / 4.5;
      return mode === 'garden' ? r * Math.pow(view.z, 0.4) : r;
    }
    function fit() { var m = 14, sw = 2 * BX, sh = BOTY - TOPY; bs = Math.min((W - 2 * m) / sw, (H - 2 * m) / sh); bx = W / 2; by = H / 2 - ((TOPY + BOTY) / 2) * bs; }
    function toScreen(wx, wy) { return [(wx * bs + bx) * view.z + view.px, (wy * bs + by) * view.z + view.py]; }
    function altBounds() {
      var s = F.filter(function (f) { return f.score != null; }).map(function (f) { return f.score; });
      var lo = Math.min.apply(null, s), hi = Math.max.apply(null, s), pad = (hi - lo) * 0.08 || 1;
      return { lo: Math.floor((lo - pad) / 10) * 10, hi: Math.ceil((hi + pad) / 10) * 10 };
    }
    var alt = { lo: 0, hi: 1 };
    function altX(lon) { return 44 + ((fin(lon) ? lon : 0) + 180) / 360 * (W - 88); }
    function altY(sc) { var r = radius(), lo = groundY() - 1.5 * r, hi = 60 + r; return lo - (sc - alt.lo) / ((alt.hi - alt.lo) || 1) * (lo - hi); }
    function altXRank(f) { return 44 + (F.length > 1 ? f.rank / (F.length - 1) : 0.5) * (W - 88); }

    function targets(f) {
      if (mode === 'garden') { var p = toScreen(f.wx, f.wy); f.tx = p[0]; f.ty = p[1]; f.rx = p[0]; f.ry = p[1]; return 1; }
      if (mode === 'alt') { var x = hasGeo ? altX(f.lon) : altXRank(f); f.tx = x; f.ty = altY(f.score); f.rx = x; f.ry = groundY(); return 1; }
      var g = gridInfo, k = f.rank, col = k % g.cols, row = Math.floor(k / g.cols);
      f.tx = g.offX + col * g.cw + (g.cw - S.layout.colGap) / 2; f.ty = 12 + row * g.ch + g.R + 4; f.rx = f.tx; f.ry = f.ty; return 0;
    }
    elQuick.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.view) { S.layout.mode = b.dataset.view; setMode(b.dataset.view, true); buildQuick(); if (hooks.onSetting) hooks.onSetting('layout.mode', b.dataset.view); }
      else if (b.dataset.tg) { S.effects[b.dataset.tg] = !S.effects[b.dataset.tg]; buildQuick(); if (hooks.onSetting) hooks.onSetting('effects.' + b.dataset.tg, S.effects[b.dataset.tg]); }
    });
    function resolveMode(m) {
      if (m === 'garden' && !hasGeo) return 'grid';
      if (m === 'alt' && !hasScore) return 'grid';
      return m;
    }
    function setMode(m, silent) {
      var want = m, r = resolveMode(m);
      mode = r;
      view.zt = 1; view.z = Math.max(1, view.z); view.pxT = 0; view.pyT = 0;
      if (hasScore) alt = altBounds();
      resize();
      elZoom.style.display = mode === 'garden' ? '' : 'none';
      var hint = mode === 'garden' ? 'Scroll to zoom, drag to pan, click a flower to bloom it.' : mode === 'alt' ? 'Taller flowers have a higher score. Click a flower to bloom it.' : 'Click a flower to bloom it.';
      elHint.textContent = hint; elHint.style.display = S.bloom.on ? '' : 'none';
      var msg = '';
      if (want === 'garden' && !hasGeo) msg = 'Garden map needs latitude and longitude. Drop fields named Latitude and Longitude on Detail, or pick them on the Fields tab. Showing the grid for now.';
      if (want === 'alt' && !hasScore) msg = 'Altitude needs a Score. Drop a measure on the Score shelf. Showing the grid for now.';
      if (!F.length) msg = 'Drop a dimension on Flower, a dimension on Petal, and a measure on Length.';
      if (msg && F.length) { elHint.textContent = msg; elHint.style.display = ''; elHint.style.maxWidth = '70%'; elMsg.hidden = true; }
      else { elMsg.textContent = msg; elMsg.hidden = !msg; elHint.style.maxWidth = ''; }
      F.forEach(function (f) { targets(f); if (f.fresh) { f.hx = f.tx + Math.cos(f.i * 2.1) * 2; f.hy = f.ty + Math.sin(f.i * 2.1) * 2; f.stemA = mode === 'grid' ? 0 : 1; f.fresh = false; } });
      if (S.effects.coast === 'peek' && mode === 'garden') coast.hold = 2.4;
      buildQuick();
      settle(40);
    }
    function resize() {
      elStage.style.overflowX = 'hidden'; elStage.style.overflowY = (mode === 'grid' && S.layout.fit !== 'fit') ? 'auto' : 'hidden';
      var st = stageSize(); dpr = Math.min(2, global.devicePixelRatio || 1); W = st.w; H = canvasHeight();
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      fit(); clampView();
    }
    function clampView() {
      view.pxT = Math.min(0, Math.max(W - W * view.zt, view.pxT)); view.pyT = Math.min(0, Math.max(H - H * view.zt, view.pyT));
      if (view.zt <= 1.0001) { view.pxT = 0; view.pyT = 0; }
    }

    function step(dt) {
      var kv = 1 - Math.exp(-dt * 10);
      view.z += (view.zt - view.z) * kv; view.px += (view.pxT - view.px) * kv; view.py += (view.pyT - view.py) * kv;
      if (Math.abs(view.z - view.zt) < 1e-4) view.z = view.zt;
      var k = 1 - Math.exp(-dt * (mode === 'grid' ? 9 : 4)), R = radius();
      for (var i = 0; i < F.length; i++) { var f = F[i], st = targets(f); f.stemA += (st - f.stemA) * k; f.hx += (f.tx - f.hx) * k; f.hy += (f.ty - f.hy) * k; }
      if (mode !== 'grid' && S.layout.nudge) {
        var minD = 2 * R;
        for (var pass = 0; pass < 6; pass++) for (var a = 0; a < F.length; a++) for (var b = a + 1; b < F.length; b++) {
          var A = F[a], B = F[b], dx = B.hx - A.hx, dy = B.hy - A.hy, d2 = dx * dx + dy * dy;
          if (d2 < minD * minD) {
            var d = Math.sqrt(d2) || 0.001; if (d < 0.01) { dx = Math.cos(a * 1.7); dy = Math.sin(a * 1.7); d = 1; }
            var push = (minD - d) / 2 * 0.9, ux = dx / d, uy = dy / d; A.hx -= ux * push; A.hy -= uy * push; B.hx += ux * push; B.hy += uy * push;
          }
        }
        if (view.zt < 1.05) { var mg = R * 1.1 + 4; for (var q = 0; q < F.length; q++) { var h = F[q]; h.hx = Math.min(W - mg, Math.max(mg, h.hx)); h.hy = Math.min(H - mg - (mode === 'garden' ? 18 : 0), Math.max(mg, h.hy)); } }
      }
      var ca = S.effects.coast === 'on' ? 0.55 : 0;
      if (coast.hold > 0) { coast.hold -= dt; ca = Math.max(ca, 1); }
      coast.a += (ca - coast.a) * (1 - Math.exp(-dt * (ca > coast.a ? 7 : 2.6)));
    }
    function settle(n) { for (var i = 0; i < n; i++) step(1 / 60); }

    /* ---------- drawing ---------- */
    function arcCtl(a, b) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      if (ny > 0) { nx = -nx; ny = -ny; } return { x: mx + nx * d * 0.26, y: my + ny * d * 0.26 };
    }
    function arcAt(a, b, cp, u) { var q = 1 - u; return { x: q * q * a.x + 2 * q * u * cp.x + u * u * b.x, y: q * q * a.y + 2 * q * u * cp.y + u * u * b.y }; }
    function label(txt, x, y, sz, col, clamp, bold) {
      ctx.font = (bold ? '600 ' : '500 ') + sz + 'px ' + C.fb; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (clamp) { var hw = ctx.measureText(txt).width / 2 + 4; x = Math.min(W - hw, Math.max(hw, x)); y = Math.min(H - sz - 6, Math.max(4, y)); }
      ctx.lineWidth = 3.5; ctx.strokeStyle = C.stage; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y); ctx.fillStyle = col || C.ink; ctx.fillText(txt, x, y);
    }
    function short(n, max) { return n.length > max ? n.slice(0, max - 1) + '…' : n; }
    function headPos(f) { var R = radius(), sw = (S.effects.breeze && !reduce) ? 1 : 0; return { x: f.hx + Math.sin(T * 0.9 + f.ph) * R * 0.06 * sw, y: f.hy + Math.cos(T * 0.7 + f.ph) * R * 0.04 * sw }; }

    function drawStem(f) {
      var a = f.stemA, rx = f.rx, ry = f.ry, len = Math.hypot(f.hx - rx, f.hy - ry), R = radius();
      if (a < 0.02) return;
      ctx.save(); ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = C.stem; ctx.beginPath(); ctx.arc(rx, ry, mode === 'alt' ? 1.6 : 2.4, 0, TAU); ctx.fill();
      if (len > R * 0.55) {
        var cx = (rx + f.hx) / 2 + (mode === 'alt' ? 0 : -(f.hy - ry) * 0.12), cy = (ry + f.hy) / 2 + (mode === 'alt' ? 0 : (f.hx - rx) * 0.12);
        ctx.strokeStyle = C.stem; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(cx, cy, f.hx, f.hy); ctx.stroke();
        if (len > R * 1.7) {
          var u = 0.5, q = 1 - u, lx = q * q * rx + 2 * q * u * cx + u * u * f.hx, ly = q * q * ry + 2 * q * u * cy + u * u * f.hy;
          var tx = 2 * q * (cx - rx) + 2 * u * (f.hx - cx), ty = 2 * q * (cy - ry) + 2 * u * (f.hy - cy), ang = Math.atan2(ty, tx) + 1.0;
          ctx.globalAlpha = a * 0.75; ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(5, 0, 5.5, 2.2, 0, 0, TAU); ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    }
    function drawAlt() {
      var span = alt.hi - alt.lo, stepv = span > 400 ? 100 : span > 150 ? 50 : span > 60 ? 20 : span > 20 ? 10 : 5;
      ctx.save(); ctx.font = '500 11px ' + C.fb; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
      for (var s = Math.ceil(alt.lo / stepv) * stepv; s <= alt.hi; s += stepv) {
        var y = altY(s); ctx.strokeStyle = 'rgba(120,140,140,.25)'; ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W - 44, y); ctx.stroke();
        ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.fillText(String(s), 38, y);
      }
      ctx.fillStyle = C.stem; ctx.globalAlpha = 0.28; ctx.fillRect(44, groundY(), W - 88, 6); ctx.globalAlpha = 1;
      ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (hasGeo) [-150, -100, -50, 0, 50, 100, 150].forEach(function (l) { ctx.fillText(l === 0 ? '0°' : Math.abs(l) + '°' + (l < 0 ? 'W' : 'E'), altX(l), groundY() + 12); });
      ctx.textAlign = 'left'; ctx.font = '600 11.5px ' + C.fb;
      ctx.fillText('Height = score' + (hasGeo ? '. Left to right = longitude.' : ', highest first.'), 44, 10);
      ctx.restore();
    }
    function nameFor(f) { return S.layout.under === 'name' ? short(f.name, 17) : short(f.name, 17); }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      if (!F.length) return;
      var R = radius(), land = getLand();
      if (mode === 'garden' && coast.a > 0.01 && land) {
        ctx.save(); ctx.translate(view.px, view.py); ctx.scale(view.z, view.z); ctx.translate(bx, by); ctx.scale(bs, bs);
        ctx.globalAlpha = coast.a * 0.9; ctx.fillStyle = C.land; ctx.fill(land);
        ctx.globalAlpha = Math.min(1, coast.a * 1.1); ctx.strokeStyle = C.coast; ctx.lineWidth = 1.3 / (bs * view.z); ctx.lineJoin = 'round'; ctx.stroke(land); ctx.restore();
      }
      if (mode === 'alt') drawAlt();
      var act = hover >= 0 ? hover : featured, AF = F[act];
      var heads = F.map(function (f) { var p = headPos(f); return { x: p.x, y: p.y, f: f }; });
      hits = heads;
      if (mode !== 'grid') for (var i = 0; i < F.length; i++) drawStem(F[i]);
      var twinSet = {}, showArcs = mode !== 'grid' && AF && AF.twins.length > 0 && S.effects.twins;
      if (showArcs) {
        AF.twins.forEach(function (t) { twinSet[t.f.i] = 1; });
        var a0 = heads[act]; ctx.save(); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = C.bee; ctx.globalAlpha = 0.9; ctx.setLineDash([1, 6]);
        AF.twins.forEach(function (t) { var b = heads[t.f.i], cp = arcCtl(a0, b); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y); ctx.stroke(); });
        ctx.restore();
      }
      var order = heads.slice().sort(function (p, q) { return p.y - q.y; }), focus = showArcs && hover >= 0;
      order.forEach(function (h) { if (h.f.i === act) return; drawFlower(ctx, h.x, h.y, R, h.f, { alpha: (focus && !twinSet[h.f.i]) ? 0.5 : 1, spot: -1, sway: S.effects.breeze && !reduce }); });
      if (AF) drawFlower(ctx, heads[act].x, heads[act].y, R * (mode === 'grid' ? 1 : 1.12), AF, { alpha: 1, spot: -1, sway: S.effects.breeze && !reduce });
      if (AF && mode !== 'grid') { var ah = heads[act]; ctx.save(); ctx.strokeStyle = S.bloom.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ah.x, ah.y, R * 1.4, 0, TAU); ctx.stroke(); ctx.restore(); }
      if (showArcs) {
        var ah2 = heads[act];
        AF.twins.forEach(function (t, k) {
          var b = heads[t.f.i], cp = arcCtl(ah2, b);
          ctx.save(); ctx.strokeStyle = C.bee; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, R * 1.3, 0, TAU); ctx.stroke(); ctx.restore();
          var u = reduce ? 0.5 : ((T * 0.22 + k / 3) % 1), p = arcAt(ah2, b, cp, u), ang = Math.atan2(b.y - ah2.y, b.x - ah2.x);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-1, -3.2, 3.3, 2, 0, 0, TAU); ctx.ellipse(-1, 3.2, 3.3, 2, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = C.bee; ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2b2412'; ctx.fillRect(-1.2, -3, 1.3, 6); ctx.fillRect(1.6, -2.7, 1.1, 5.4); ctx.restore();
          if (b.x < -R || b.x > W + R || b.y < -R || b.y > H + R) return;
          var vx = b.x - ah2.x, vy = b.y - ah2.y, vd = Math.hypot(vx, vy) || 1, up = (vy / vd) < -0.2, ly = up ? b.y - R * 1.5 - 30 : b.y + R * 1.45, lx = b.x + (vx / vd) * R * 0.9;
          ly = Math.min(H - 34, Math.max(4, ly)); label(short(t.f.name, 18), lx, ly, 12.5, C.ink, true); if (t.km != null) label(Math.round(t.km).toLocaleString('en-US') + ' km', lx, ly + 15, 11.5, C.ink2, true);
        });
      }
      var nm = S.effects.names, showAll = nm === 'all' || (nm === 'auto' && mode === 'garden' && view.z >= 2.4);
      heads.forEach(function (h) {
        var f = h.f; if (h.x < -R || h.x > W + R || h.y < -R || h.y > H + R) return;
        if (mode === 'grid') {
          if (S.layout.under === 'none') return;
          var LS = S.fonts.labelSize || 13; label(short(f.name, 18), h.x, h.y + R * 1.25 + 2, LS, C.ink);
          if (S.layout.under === 'name-score' && f.score != null) label(String(Math.round(f.score)), h.x, h.y + R * 1.25 + 2 + LS * 1.25, LS - 0.5, C.ink2);
        } else if (f.i === act) label(f.name, h.x, h.y + R * 1.5, (S.fonts.labelSize || 13) + 1, C.ink, false, true);
        else if (showAll) label(short(f.name, 14), h.x, h.y + R * 1.15, Math.max(11, (S.fonts.labelSize || 13) - 2), C.ink2);
      });
      var pa = (T - pulse.t0) / 1.8;
      if (pulse.i >= 0 && pa < 1 && heads[pulse.i]) { var ph = heads[pulse.i]; ctx.save(); ctx.strokeStyle = S.bloom.accent; ctx.globalAlpha = 1 - pa; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ph.x, ph.y, R * (1.4 + pa * 3), 0, TAU); ctx.stroke(); ctx.restore(); }
    }

    /* ---------- tooltip ---------- */
    function showTip(f, x, y) {
      var rows = P.map(function (d, k) {
        var v = f.v[k], r = f.ref[k], dl = '';
        if (v != null && r != null && S.reference.show) { var pp = GMAX <= 1.0001 ? Math.round((v - r) * 100) : Math.round((v - r) * 10) / 10; dl = ' (' + (pp > 0 ? '+' : pp < 0 ? '−' : '') + Math.abs(pp) + (GMAX <= 1.0001 ? ' pp' : '') + ')'; }
        return '<div class="r"><i style="background:' + esc(d.color) + '"></i>' + esc(d.name) + ': <b>' + esc(fmt(v)) + '</b>' + esc(dl) + '</div>';
      }).join('');
      var tm = S.tooltip.mode, ex = f.extra || [];
      if (tm === 'auto') tm = ex.length ? 'scores' : 'petals';
      var sc = ex.length ? ex : (f.score != null ? [{ k: 'Score', v: f.score }] : []);
      var scRows = sc.map(function (x) { return '<div class="r"><span style="min-width:62px">' + esc(x.k) + '</span><b>' + esc(String(Math.round(x.v))) + '</b></div>'; }).join('');
      elTip.innerHTML = '<b>' + esc(f.name) + '</b>' + (f.group ? '<br>' + esc(f.group) : '') +
        (tm !== 'petals' ? '<div style="margin-top:5px">' + scRows + '</div>' : '') + (tm !== 'scores' ? '<div style="margin-top:4px">' + rows + '</div>' : '');
      elTip.hidden = false;
      var tw = elTip.offsetWidth, th = elTip.offsetHeight, sx = elStage.scrollLeft, sy = elStage.scrollTop, vw = elStage.clientWidth, vh = elStage.clientHeight;
      var left = Math.min(sx + vw - tw - 6, Math.max(sx + 6, x + 14)), top = Math.min(sy + vh - th - 6, Math.max(sy + 6, y - th - 10));
      elTip.style.left = left + 'px'; elTip.style.top = top + 'px';
    }

    /* ---------- bloom ---------- */
    function tmpl(s, f) { return String(s || '').replace(/\{flower\}/g, f.name).replace(/\{group\}/g, f.group || '').replace(/\{score\}/g, f.score == null ? '' : Math.round(f.score)).replace(/\{reference\}/g, refLabel()).replace(/^\s*\|\s*|\s*\|\s*$/g, ''); }
    function wrapText(c, txt, maxW) {
      var words = txt.split(' '), lines = [], cur = '';
      words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur); return lines;
    }
    function sizeBloom() {
      var st = { w: elStage.clientWidth || W, h: elStage.clientHeight || H }, sz = S.bloom.size / 100;
      var w = Math.min(st.w * sz, 860), h = Math.round(w * 0.78); if (h > st.h * 0.86) { h = Math.round(st.h * 0.86); w = Math.round(h / 0.78); }
      w = Math.max(w, 300); h = Math.max(h, 260); var d = Math.min(2, global.devicePixelRatio || 1);
      bl.W = w; bl.H = h; bcv.width = w * d; bcv.height = h * d; bcv.style.width = w + 'px'; bcv.style.height = h + 'px'; bctx.setTransform(d, 0, 0, d, 0, 0);
      elBloom.style.background = 'rgba(255,255,255,' + (S.bloom.dim / 200) + ')';
    }
    function drawBloom(ts) {
      var f = F[bl.i]; if (!f) return; var t = Math.min(1, (ts - bl.t0) / 700), ease = 1 - Math.pow(1 - t, 3), g = bctx, BW = bl.W, BH = bl.H;
      g.clearRect(0, 0, BW, BH); g.textBaseline = 'alphabetic'; g.textAlign = 'center';
      g.fillStyle = C.ink; g.font = '700 ' + Math.round(Math.min(24, BW / 24)) + 'px ' + C.fd; g.fillText(tmpl(S.bloom.title, f), BW / 2, 32);
      g.fillStyle = C.ink2; g.font = 'italic 500 ' + Math.round(Math.min(14, BW / 48)) + 'px ' + C.fb; g.fillText(tmpl(S.bloom.subtitle, f), BW / 2, 54);
      var cx = BW / 2, cy = BH * 0.5, Rf = Math.min(BW * 0.22, BH * 0.235), saved = T; T = ts / 1000;
      g.save(); g.translate(cx, cy); g.scale(0.55 + 0.45 * ease, 0.55 + 0.45 * ease); g.rotate((1 - ease) * -0.5); g.translate(-cx, -cy);
      drawFlower(g, cx, cy, Rf, f, { alpha: ease, spot: -1, outline: true, big: true, sway: false }); g.restore(); T = saved;
      if (S.bloom.centerScore && f.score != null) {
        g.globalAlpha = ease; g.fillStyle = S.petals.dotColor; g.beginPath(); g.arc(cx, cy, Rf * 0.2, 0, TAU); g.fill(); g.strokeStyle = C.ink2; g.lineWidth = 1; g.stroke();
        g.fillStyle = C.ink; g.font = '700 ' + Math.round(Rf * 0.17) + 'px ' + C.fd; g.fillText(String(Math.round(f.score)), cx, cy + Rf * 0.05);
      }
      if (S.bloom.labels) {
        var fs = S.bloom.labelSize > 0 ? S.bloom.labelSize : Math.round(Math.max(10.5, Math.min(14, BW / 56)));
        for (var k = 0; k < N; k++) {
          var a = angOf(k, false), v = f.v[k], L = v == null ? Rf * 0.34 : Rf * petalLen(v, k), rr = Math.max(L, Rf * 0.6) + 16, px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          var co = Math.cos(a), al = co > 0.25 ? 'left' : (co < -0.25 ? 'right' : 'center'), maxW = al === 'left' ? BW - px - 10 : (al === 'right' ? px - 10 : Math.min(220, BW - 24));
          maxW = Math.max(90, Math.min(maxW, 200)); g.font = '500 ' + fs + 'px ' + C.fb;
          var lc = S.bloom.labelContent, nameLines = lc === 'value' ? [] : wrapText(g, P[k].name, maxW);
          var vt = lc === 'name' ? '' : fmt(v);
          if (vt && f.ref[k] != null && v != null && S.reference.show) { var pp = GMAX <= 1.0001 ? Math.round((v - f.ref[k]) * 100) : Math.round((v - f.ref[k]) * 10) / 10; vt += '  (' + (pp >= 0 ? '+' : '−') + Math.abs(pp) + (GMAX <= 1.0001 ? ' pp' : '') + ')'; }
          var tot = nameLines.length + (vt ? 1 : 0), y0 = Math.sin(a) < -0.5 ? py - (tot - 1) * (fs + 3) - 2 : (Math.sin(a) > 0.5 ? py + fs : py - (tot - 1) * (fs + 3) / 2);
          g.textAlign = al; g.globalAlpha = ease; nameLines.forEach(function (ln, j) { g.fillStyle = C.ink2; g.fillText(ln, px, y0 + j * (fs + 3)); });
          if (vt) {
            g.font = '700 ' + (fs + 2) + 'px ' + C.fb; var vw = g.measureText(vt).width, dx = al === 'left' ? px - 9 : (al === 'right' ? px + 9 : px - vw / 2 - 10);
            g.fillStyle = P[k].color; g.beginPath(); g.arc(dx, y0 + nameLines.length * (fs + 3) - fs * 0.35, 4, 0, TAU); g.fill(); g.fillStyle = C.ink; g.fillText(vt, px, y0 + nameLines.length * (fs + 3));
          }
        }
      }
      g.globalAlpha = 1; g.fillStyle = C.ink2; g.textAlign = 'center'; g.font = '500 11.5px ' + C.fb;
      var key = S.bloom.key && S.reference.show, foot = (key ? 'Outline = ' + refLabel() + '  ·  ' : '') + (byRank.indexOf(f) + 1) + ' of ' + F.length + (S.bloom.arrows ? '  ·  arrow keys to browse, Esc to close' : '');
      var fw = g.measureText(foot).width, fx = BW / 2 + (key ? 9 : 0);
      g.fillText(foot, fx, BH - 8);
      if (key) { g.strokeStyle = S.reference.color; g.lineWidth = 1.2; g.beginPath(); g.ellipse(fx - fw / 2 - 11, BH - 12, 7, 4.5, 0, 0, TAU); g.stroke(); }
    }
    function bloomLoop(ts) { if (!bl.open) return; drawBloom(ts); bl.raf = requestAnimationFrame(bloomLoop); }
    function openBloom(i) {
      if (!S.bloom.on || i < 0 || !F[i]) return; bl.open = true; bl.i = i; elBloom.hidden = false; sizeBloom(); bl.t0 = performance.now();
      cancelAnimationFrame(bl.raf); bl.raf = requestAnimationFrame(bloomLoop);
    }
    function closeBloom() { bl.open = false; elBloom.hidden = true; cancelAnimationFrame(bl.raf); }
    function stepBloom(d) { var k = (byRank.indexOf(F[bl.i]) + d + F.length) % F.length; bl.i = byRank[k].i; featured = bl.i; picked = true; bl.t0 = performance.now(); }

    /* ---------- input ---------- */
    function hit(x, y) {
      var R = Math.max(radius() * 1.05, 15), best = -1, bd = 1e9;
      for (var i = 0; i < hits.length; i++) { var h = hits[i], d = Math.hypot(h.x - x, h.y - y); if (d < R && d < bd) { bd = d; best = h.f.i; } }
      return best;
    }
    function local(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
    var drag = null;
    cv.addEventListener('pointerdown', function (e) { var p = local(e); drag = { x: p.x, y: p.y, px: view.pxT, py: view.pyT, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) {
      var p = local(e);
      if (drag && mode === 'garden' && view.zt > 1) { var dx = p.x - drag.x, dy = p.y - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; if (drag.moved) { view.pxT = drag.px + dx; view.pyT = drag.py + dy; clampView(); } }
      else if (drag && Math.hypot(p.x - drag.x, p.y - drag.y) > 4) drag.moved = true;
      if (!drag || !drag.moved) {
        var h = hit(p.x, p.y); hover = h; cv.style.cursor = h >= 0 ? 'pointer' : (mode === 'garden' && view.zt > 1 ? 'grab' : 'default');
        if (h >= 0) showTip(F[h], p.x, p.y); else elTip.hidden = true;
      }
    });
    cv.addEventListener('pointerup', function (e) {
      var p = local(e), d = drag; drag = null;
      if (d && !d.moved) { var h = hit(p.x, p.y); if (h >= 0) { featured = h; picked = true; openBloom(h); if (hooks.onPick) hooks.onPick(F[h].key); } }
    });
    cv.addEventListener('pointerleave', function () { hover = -1; elTip.hidden = true; });
    cv.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBloom(featured); } });
    cv.addEventListener('wheel', function (e) {
      if (mode !== 'garden') return; e.preventDefault();
      var p = local(e), zo = view.zt, zn = Math.min(8, Math.max(1, zo * Math.exp(-e.deltaY * 0.0016))), wx = (p.x - view.pxT) / zo, wy = (p.y - view.pyT) / zo;
      view.zt = zn; view.pxT = p.x - wx * zn; view.pyT = p.y - wy * zn; clampView();
    }, { passive: false });
    cv.addEventListener('dblclick', function () { view.zt = 1; clampView(); });
    function zoomBy(m) { if (mode !== 'garden') return; var cx = W / 2, cy = H / 2, zo = view.zt, zn = Math.min(8, Math.max(1, zo * m)), wx = (cx - view.pxT) / zo, wy = (cy - view.pyT) / zo; view.zt = zn; view.pxT = cx - wx * zn; view.pyT = cy - wy * zn; clampView(); }
    elZoom.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.z === 'in') zoomBy(1.6); else if (b.dataset.z === 'out') zoomBy(1 / 1.6); else { view.zt = 1; clampView(); } });
    root.querySelector('.gp-bbar').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.b === 'close') closeBloom(); else stepBloom(b.dataset.b === 'next' ? 1 : -1); });
    elBloom.addEventListener('click', function (e) { if (e.target === elBloom) closeBloom(); });
    document.addEventListener('keydown', function (e) {
      if (!bl.open) return; if (e.key === 'Escape') closeBloom(); else if (S.bloom.arrows && e.key === 'ArrowRight') stepBloom(1); else if (S.bloom.arrows && e.key === 'ArrowLeft') stepBloom(-1);
    });
    try { var ro = { w: 0, h: 0, q: 0 }; new ResizeObserver(function () {
      if (!W || ro.q) return; ro.q = requestAnimationFrame(function () { ro.q = 0; var w = elStage.clientWidth, h = elStage.clientHeight; if (Math.abs(w - ro.w) < 1 && Math.abs(h - ro.h) < 1) return; ro.w = w; ro.h = h; resize(); if (bl.open) sizeBloom(); });
    }).observe(elStage); } catch (e) {}

    function frame(ts) {
      if (!running) return;
      var dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts; T = ts / 1000;
      try { step(dt); draw(); } catch (e) { if (hooks.onError && !frame.said) { frame.said = 1; hooks.onError('draw (' + mode + '): ' + (e && e.stack || e)); } }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

    applyTheme(); start();
    return {
      setData: setData, setSettings: setSettings, resize: resize, openBloom: openBloom, closeBloom: closeBloom, start: start, stop: stop, settle: settle,
      peek: function () { coast.hold = 2.2; },
      find: function (name) { var f = F.filter(function (x) { return x.name.toLowerCase() === String(name).toLowerCase(); })[0]; if (!f) return false; featured = f.i; picked = true; pulse.i = f.i; pulse.t0 = T;
        if (mode === 'garden') { view.zt = 3.2; view.pxT = W / 2 - (f.wx * bs + bx) * 3.2; view.pyT = H / 2 - (f.wy * bs + by) * 3.2; clampView(); } return true; },
      setMode: function (m) { S.layout.mode = m; setMode(m); },
      state: function () { return { mode: mode, N: N, flowers: F.length, hasGeo: hasGeo, hasScore: hasScore, W: W, H: H, R: radius(), petals: P.map(function (d) { return { src: d.src, name: d.name, color: d.color }; }), GMAX: GMAX, twins: F.filter(function (f) { return f.twins.length; }).length, grid: gridInfo }; },
      rows: function () { return F.map(function (f) { return { key: f.key, name: f.name, lat: f.lat, lon: f.lon, rx: f.rx, ry: f.ry, hx: f.hx, hy: f.hy }; }); },
      flowers: function () { return F; }, hitsNow: function () { return hits; }, canvas: cv, stage: elStage
    };
  }

  global.GardenEngine = { create: create, DEFAULTS: DEFAULTS, merge: merge, PALETTE: PALETTE };
})(window);
