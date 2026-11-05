/* Tableau adapter and boot for Garden Petals.
   Reads the four encodings (flower, petal, length, score) plus any Detail columns,
   builds the engine's model, keeps settings in tableau.extensions.settings. */
(function (global) {
  'use strict';
  var GE = global.GardenEngine, GEO = global.GardenGeo;
  var DEF = GE.DEFAULTS;
  var SECTIONS = Object.keys(DEF);
  var KEY = 'gp.';

  var T = null, ws = null, engine = null, ui = null;
  var S = GE.merge(DEF, {});
  var state = { columns: [], encoded: {}, auto: {}, map: {}, rows: 0, flowers: 0, geoFrom: '', geoMiss: [], errors: [], model: null, reads: 0, env: '' };
  var refreshing = false, refreshQueued = false, saveTimer = 0;

  function log(m) { state.errors.push(String(m)); if (state.errors.length > 30) state.errors.shift(); try { console.warn('[garden-petals]', m); } catch (e) {} }

  /* ---------- settings: one JSON string per section ---------- */
  function coerce(base, v) {
    if (v == null) return base;
    if (typeof base === 'number') { var n = parseFloat(v); return isFinite(n) ? n : base; }
    if (typeof base === 'boolean') return v === true || v === 'true' || v === 1 || v === '1';
    if (typeof base === 'string') return String(v);
    if (Array.isArray(base)) return Array.isArray(v) ? v : base;
    if (base && typeof base === 'object' && v && typeof v === 'object') {
      var o = {}; Object.keys(base).forEach(function (k) { o[k] = coerce(base[k], v[k]); }); return o;
    }
    return base;
  }
  function loadSettings() {
    var all = {}; try { all = T.extensions.settings.getAll() || {}; } catch (e) { log('settings read: ' + e.message); }
    var out = {};
    SECTIONS.forEach(function (sec) {
      var raw = all[KEY + sec], parsed = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch (e) { log('settings ' + sec + ' unreadable, using defaults'); } }
      out[sec] = coerce(DEF[sec], parsed);
    });
    S = out;
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        SECTIONS.forEach(function (sec) { T.extensions.settings.set(KEY + sec, JSON.stringify(S[sec])); });
        T.extensions.settings.saveAsync().catch(function (e) { log('settings save: ' + (e && e.message)); });
      } catch (e) { log('settings save: ' + e.message); }
    }, 400);
  }
  function setPath(path, v) { var ks = path.split('.'), t = S; for (var i = 0; i < ks.length - 1; i++) t = t[ks[i]]; t[ks[ks.length - 1]] = v; }

  /* ---------- column matching ---------- */
  function bare(n) { return String(n || '').replace(/^(SUM|AVG|MIN|MAX|ATTR|MEDIAN|CNT|CNTD|AGG|USR)\((.*)\)$/i, '$2').replace(/^(YEAR|MONTH|DAY)\((.*)\)$/i, '$2').trim(); }
  var PATTERNS = {
    ref: /ref|oecd|average|benchmark|baseline|target/i,
    group: /region|group|continent|category|area/i,
    rank: /rank/i,
    color: /hex|colou?r/i,
    lat: /^lat/i,
    lon: /^(lon|lng)/i,
    caution: /caution|flag|wilt|warning|partial/i,
    sci: /sci/i,
    math: /math/i,
    read: /read/i
  };
  function autoMatch(cols, taken) {
    var out = {};
    Object.keys(PATTERNS).forEach(function (k) {
      for (var i = 0; i < cols.length; i++) {
        if (taken[cols[i]]) continue;
        if (PATTERNS[k].test(bare(cols[i]))) { out[k] = cols[i]; taken[cols[i]] = 1; break; }
      }
    });
    return out;
  }
  function pickCol(cols, name) {
    if (!name) return '';
    if (cols.indexOf(name) >= 0) return name;
    var n = bare(name).toLowerCase();
    for (var i = 0; i < cols.length; i++) if (bare(cols[i]).toLowerCase() === n) return cols[i];
    return '';
  }
  function num(c) {
    if (c == null) return null;
    var v = c.nativeValue != null ? c.nativeValue : c.value;
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var f = parseFloat(String(c.value != null ? c.value : v).replace(/[%,\s]/g, ''));
    return isFinite(f) ? f : null;
  }
  function txt(c) {
    if (c == null) return '';
    var v = c.formattedValue != null && c.formattedValue !== '' ? c.formattedValue : c.value;
    return v == null ? '' : String(v);
  }
  function truthy(c) { return /^(yes|y|true|1|t|caution|flag)$/i.test(txt(c).trim()); }

  /* ---------- reading Tableau ---------- */
  function encodings() {
    return ws.getVisualSpecificationAsync().then(function (spec) {
      var out = {};
      var ms = spec.marksSpecifications && spec.marksSpecifications[spec.activeMarksSpecificationIndex];
      ((ms && ms.encodings) || []).forEach(function (enc) {
        var f = enc.field; if (!f) return;
        out[enc.id] = f.name || f.fieldName || f.fieldId || '';
      });
      return out;
    });
  }
  function readAll() {
    var all = { columns: null, rows: [] };
    return ws.getSummaryDataReaderAsync(undefined, { ignoreSelection: true }).then(function (reader) {
      var n = reader.pageCount, chain = Promise.resolve();
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () { return reader.getPageAsync(i); }).then(function (page) {
          if (!all.columns) all.columns = page.columns.map(function (c) { return c.fieldName; });
          for (var r = 0; r < page.data.length; r++) all.rows.push(page.data[r]);
        });
      })(i);
      return chain.then(function () { return reader.releaseAsync(); }, function (e) { return reader.releaseAsync().then(function () { throw e; }); });
    }).then(function () { return all; });
  }

  function buildModel(enc, data) {
    var cols = data.columns || [];
    state.columns = cols.slice(); state.encoded = enc; state.rows = data.rows.length;
    var cFlower = pickCol(cols, enc.flower), cPetal = pickCol(cols, enc.petal), cLen = pickCol(cols, enc.length), cScore = pickCol(cols, enc.score);
    var taken = {}; [cFlower, cPetal, cLen, cScore].forEach(function (c) { if (c) taken[c] = 1; });
    var auto = autoMatch(cols, taken); state.auto = auto;
    var F = S.fields, fc = {};
    Object.keys(PATTERNS).forEach(function (k) { fc[k] = pickCol(cols, F[k]) || auto[k] || ''; });
    fc.sci = fc.sci || (cScore && !/math|read/i.test(bare(cScore)) ? cScore : '');
    var scoreCols = [['Science', fc.sci], ['Math', fc.math], ['Reading', fc.read]].filter(function (x) { return x[1]; });
    state.map = { flower: cFlower, petal: cPetal, length: cLen, score: cScore, ref: fc.ref, group: fc.group, rank: fc.rank, color: fc.color, lat: fc.lat, lon: fc.lon, caution: fc.caution, sci: fc.sci, math: fc.math, read: fc.read };
    if (!cFlower || !cPetal || !cLen) return { missing: [!cFlower && 'Flower', !cPetal && 'Petal', !cLen && 'Length'].filter(Boolean) };
    var ix = {}; cols.forEach(function (c, i) { ix[c] = i; });
    var petalNames = [], pidx = {}, petalColors = [], flowers = [], fidx = {};
    data.rows.forEach(function (row) {
      var fname = txt(row[ix[cFlower]]), pname = txt(row[ix[cPetal]]);
      if (!fname || !pname) return;
      if (pidx[pname] == null) { pidx[pname] = petalNames.length; petalNames.push(pname); petalColors.push(''); }
      var f = fidx[fname];
      if (!f) {
        f = fidx[fname] = { key: fname, name: fname, group: '', lat: null, lon: null, score: null, rank: null, caution: false, extra: null, v: [], ref: [] };
        flowers.push(f);
      }
      var p = pidx[pname];
      f.v[p] = num(row[ix[cLen]]);
      if (!f.extra && scoreCols.length) { f.extra = scoreCols.map(function (x) { return { k: x[0], v: num(row[ix[x[1]]]) }; }); }
      if (fc.ref) f.ref[p] = num(row[ix[fc.ref]]);
      if (cScore && f.score == null) f.score = num(row[ix[cScore]]);
      if (fc.group && !f.group) f.group = txt(row[ix[fc.group]]);
      if (fc.rank && f.rank == null) f.rank = num(row[ix[fc.rank]]);
      if (fc.caution && !f.caution) f.caution = truthy(row[ix[fc.caution]]);
      if (fc.color && !petalColors[p]) { var h = txt(row[ix[fc.color]]).trim(); if (/^#[0-9a-f]{6}$/i.test(h)) petalColors[p] = h; }
      if (fc.lat && fc.lon && f.lat == null) { var la = num(row[ix[fc.lat]]), lo = num(row[ix[fc.lon]]); if (la != null && lo != null) { f.lat = la; f.lon = lo; } }
    });
    var P = petalNames.length, fromData = 0, fromGaz = 0, miss = [];
    flowers.forEach(function (f) {
      for (var i = 0; i < P; i++) { if (f.v[i] === undefined) f.v[i] = null; if (f.ref[i] === undefined) f.ref[i] = null; }
      if (f.lat != null) fromData++;
      else { var g = GEO && GEO.lookup(f.name); if (g) { f.lat = g.lat; f.lon = g.lon; fromGaz++; } else miss.push(f.name); }
    });
    state.flowers = flowers.length; state.geoMiss = miss;
    state.geoFrom = fromData ? ('Latitude/Longitude fields (' + fromData + ')') + (fromGaz ? ' + built-in list (' + fromGaz + ')' : '') : (fromGaz ? 'built-in list (' + fromGaz + ' of ' + flowers.length + ')' : 'none');
    var valueName = bare(enc.length || 'Value');
    var refName = fc.ref ? bare(fc.ref) : 'reference';
    return { model: { title: (ws && ws.name) || '', valueName: valueName, referenceLabel: refName, petalNames: petalNames, petalColors: petalColors, flowers: flowers } };
  }

  function setMessage(html) { var m = engine && engine.stage.querySelector('.gp-msg'); if (!m) return; m.hidden = !html; m.innerHTML = html || ''; }

  function refresh() {
    if (refreshing) { refreshQueued = true; return Promise.resolve(); }
    refreshing = true; refreshQueued = false;
    return encodings().then(function (enc) {
      return readAll().then(function (data) { state.reads++; return buildModel(enc, data); });
    }).then(function (res) {
      if (res.missing) {
        engine.setData({ petalNames: [], flowers: [] });
        setMessage('<div><b>Almost there.</b><br>Drag a field onto <b>' + res.missing.join('</b>, <b>') + '</b> in the Marks card.<br>Flower = one flower per value (a country). Petal = the petals around it. Length = how long each petal is.</div>');
        return;
      }
      state.model = res.model;
      setMessage(res.model.flowers.length ? '' : '<div>No data in this view. Check your filters.</div>');
      engine.setData(res.model);
      if (ui) ui.render();
    }).catch(function (e) {
      log('refresh: ' + (e && e.message || e));
      setMessage('<div><b>Could not read the data.</b><br>' + String(e && e.message || e).replace(/[<>&]/g, '') + '<br>Open settings > Fields > diagnostics for details.</div>');
    }).then(function () {
      refreshing = false; if (refreshQueued) return refresh();
    });
  }

  /* ---------- panel API ---------- */
  function displayPetals() {
    var m = state.model; if (!m) return [];
    var out = [], used = {};
    (S.petals.list || []).forEach(function (it) { var i = m.petalNames.indexOf(it.src); if (i >= 0 && !used[i]) { used[i] = 1; out.push({ src: it.src, name: it.name || it.src, color: it.color || m.petalColors[i] || '' }); } });
    m.petalNames.forEach(function (n, i) { if (!used[i]) out.push({ src: n, name: n, color: m.petalColors[i] || '' }); });
    out.forEach(function (p, k) { p.color = p.color || GE.PALETTE[k % GE.PALETTE.length]; });
    return out;
  }
  function diagnostics() {
    var m = state.map, L = [];
    L.push('Garden Petals 1.0.0 | API ' + (state.env || '?') + ' | reads ' + state.reads);
    L.push('Rows read: ' + state.rows + ' | flowers: ' + state.flowers + ' | petals: ' + (state.model ? state.model.petalNames.length : 0));
    L.push('Encoded on shelves: ' + (Object.keys(state.encoded).map(function (k) { return k + '=' + state.encoded[k]; }).join(', ') || '(none)'));
    L.push('Columns in the data: ' + (state.columns.join(' | ') || '(none)'));
    L.push('Mapped: ' + Object.keys(m).map(function (k) { return k + '=' + (m[k] || '-'); }).join(', '));
    L.push('Location from: ' + (state.geoFrom || '-') + (state.geoMiss.length ? ' | not found: ' + state.geoMiss.slice(0, 12).join('; ') + (state.geoMiss.length > 12 ? ' ...' : '') : ''));
    if (state.errors.length) L.push('Errors: ' + state.errors.join(' || '));
    return L.join('\n');
  }
  var api = {
    get: function () { return S; },
    info: function () { return { columns: state.columns, petals: displayPetals(), auto: state.auto }; },
    set: function (path, v, silent) { setPath(path, v); if (!silent) api.commit(); },
    commit: function () { engine.setSettings(S); saveSoon(); },
    reset: function () { S = GE.merge(DEF, {}); api.commit(); refresh(); },
    diagnostics: diagnostics
  };
  var refieldPaths = /^fields\./;
  var origSet = api.set;
  api.set = function (path, v, silent) { origSet(path, v, silent); if (refieldPaths.test(path) && !silent) refresh(); };

  global.addEventListener('error', function (e) { log('window error: ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno); });
  global.addEventListener('unhandledrejection', function (e) { log('unhandled: ' + (e.reason && e.reason.message || e.reason)); });

  /* ---------- boot ---------- */
  function boot() {
    T = global.tableau;
    var root = document.getElementById('root');
    engine = GE.create(root, { onError: log, onSetting: function (path, v) { setPath(path, v); saveSoon(); if (ui) ui.render(); } });
    ui = global.GardenSettingsUI.create(root, api);
    global.__gp = { engine: engine, api: api, state: state, ui: ui, refresh: refresh, diagnostics: diagnostics };
    if (!T || !T.extensions) { setMessage('<div>This page runs inside Tableau as a viz extension. Add the .trex file from the Marks card.</div>'); return; }
    return T.extensions.initializeAsync().then(function () {
      state.env = (T.extensions.environment && T.extensions.environment.apiVersion) || '';
      ws = T.extensions.worksheetContent && T.extensions.worksheetContent.worksheet;
      if (!ws) throw new Error('This extension must be added as a viz extension (Marks card), not a dashboard extension.');
      loadSettings(); engine.setSettings(S);
      var ET = T.TableauEventType || {};
      ['SummaryDataChanged', 'FilterChanged', 'ParameterChanged'].forEach(function (n) {
        if (ET[n]) { try { ws.addEventListener(ET[n], function () { refresh(); }); } catch (e) { log('listener ' + n + ': ' + e.message); } }
      });
      try { T.extensions.settings.addEventListener(ET.SettingsChanged || 'settings-changed', function () { /* another tab edited */ }); } catch (e) {}
      return refresh();
    }).then(function () { engine.start(); }).catch(function (e) {
      log('init: ' + (e && e.message || e));
      setMessage('<div><b>Garden Petals could not start.</b><br>' + String(e && e.message || e).replace(/[<>&]/g, '') + '</div>');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
