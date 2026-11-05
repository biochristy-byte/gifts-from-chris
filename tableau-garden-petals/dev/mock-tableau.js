/* A stand-in for the Tableau Extensions API, shaped from the published type
 * declarations (extensions-api-types 1.17) and the behaviour of the official samples.
 * It proves OUR side of the documented contract in a plain browser. It does NOT prove
 * that Tableau Desktop drives the extension correctly.
 *
 * Fidelity choices:
 *   - summary data is served in 10,000 row pages, like the real reader
 *   - a second reader before releaseAsync throws, so a leak shows up here
 *   - settings values come back as strings, because Tableau stores strings
 *   - column names look like Tableau's: SUM(Value), not Value
 */
(function (global) {
  'use strict';
  var PAGE_SIZE = +(new URLSearchParams(location.search).get('page') || 10000);
  var STORE = 'gp-mock-settings';

  function MockWorksheet() {
    this.name = 'Sample Garden';
    this.fixture = 'sample';
    this.listeners = {};
    this.openReader = null;
    this.readerOpens = 0;
    this.maxConcurrent = 0;
    this.encodings = {
      flower: { name: 'Country', fieldId: 'f-c' },
      petal: { name: 'Metric', fieldId: 'f-m' },
      length: { name: 'SUM(Value)', fieldId: 'f-v' },
      score: { name: 'SUM(Science Score)', fieldId: 'f-s' }
    };
    this.delay = 0;
  }
  MockWorksheet.prototype.getSummaryDataReaderAsync = function () {
    var self = this;
    if (self.openReader) return Promise.reject(new Error('A DataTableReader is already open on this worksheet. Call releaseAsync first.'));
    var fx = global.GP_FIXTURES[self.fixture], rows = fx.rows, cols = fx.columns;
    var pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    var reader = {
      pageCount: pageCount, totalRowCount: rows.length,
      getPageAsync: function (i) {
        if (i < 0 || i >= pageCount) return Promise.reject(new RangeError('page out of range: ' + i));
        var slice = rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
        var page = {
          columns: cols.map(function (n, idx) { return { fieldName: n, index: idx, dataType: typeof (rows[0] || {})[n] === 'number' ? 'float' : 'string' }; }),
          data: slice.map(function (r) { return cols.map(function (c) { var v = r[c]; return { value: v, nativeValue: v, formattedValue: v == null ? '' : String(v) }; }); })
        };
        return new Promise(function (res) { setTimeout(function () { res(page); }, self.delay); });
      },
      releaseAsync: function () { self.openReader = null; return Promise.resolve(); }
    };
    self.openReader = reader; self.readerOpens++;
    return new Promise(function (res) { setTimeout(function () { res(reader); }, self.delay); });
  };
  MockWorksheet.prototype.getVisualSpecificationAsync = function () {
    var self = this, enc = [];
    ['flower', 'petal', 'length', 'score'].forEach(function (id) {
      if (self.encodings[id]) enc.push({ id: id, fieldEncodingId: id + '-0', type: 'custom', field: self.encodings[id] });
    });
    return Promise.resolve({ rowFields: [], columnFields: [], activeMarksSpecificationIndex: 0, marksSpecifications: [{ primitiveType: 'viz-extension', encodings: enc }] });
  };
  MockWorksheet.prototype.addEventListener = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); return function () {}; };
  MockWorksheet.prototype.emit = function (type) { (this.listeners[type] || []).forEach(function (f) { try { f({ type: type }); } catch (e) { console.error('[mock] listener threw', e); } }); };

  function MockSettings() { this._v = {}; this.saveCount = 0; }
  MockSettings.prototype.getAll = function () { return Object.assign({}, this._v); };
  MockSettings.prototype.get = function (k) { return this._v[k]; };
  MockSettings.prototype.set = function (k, v) { if (typeof v !== 'string') throw new TypeError('Tableau settings hold strings only: ' + k); this._v[k] = v; };
  MockSettings.prototype.erase = function (k) { delete this._v[k]; };
  MockSettings.prototype.addEventListener = function () { return function () {}; };
  MockSettings.prototype.saveAsync = function () {
    this.saveCount++; var snap = this.getAll();
    try { global.localStorage.setItem(STORE, JSON.stringify(snap)); } catch (e) {}
    return Promise.resolve(snap);
  };
  MockSettings.prototype.restore = function () { try { var r = global.localStorage.getItem(STORE); if (r) this._v = JSON.parse(r); } catch (e) {} };

  var ws = new MockWorksheet(), settings = new MockSettings();
  if (!/[?&]fresh=1/.test(location.search)) settings.restore();
  var q = new URLSearchParams(location.search);
  if (q.get('fixture')) ws.fixture = q.get('fixture');
  if (q.get('delay')) ws.delay = +q.get('delay');

  global.tableau = {
    extensions: {
      initializeAsync: function () { return new Promise(function (r) { setTimeout(r, 0); }); },
      worksheetContent: { worksheet: ws },
      settings: settings,
      environment: { mode: 'authoring', apiVersion: '1.17.0 (mock)', tableauVersion: 'mock' }
    },
    TableauEventType: { SummaryDataChanged: 'summary-data-changed', FilterChanged: 'filter-changed', ParameterChanged: 'parameter-changed', SettingsChanged: 'settings-changed' }
  };
  global.GP_MOCK = {
    ws: ws, settings: settings,
    setFixture: function (k) { ws.fixture = k; ws.emit('summary-data-changed'); },
    setEncoding: function (id, name) { ws.encodings[id] = name ? { name: name, fieldId: 'f-' + name } : null; ws.emit('summary-data-changed'); },
    clear: function () { settings._v = {}; try { localStorage.removeItem(STORE); } catch (e) {} }
  };
})(window);
