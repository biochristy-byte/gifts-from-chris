/* A stand-in for the Tableau Extensions API, shaped from the published type
 * declarations in @tableau/extensions-api-types 1.17.0 and the behaviour of
 * the official ConnectedScatterplot sample.
 *
 * It exists so the renderer, the settings panel, the number formatting and the
 * paging logic can be exercised and proven in a plain browser. It does NOT
 * prove that Tableau Desktop drives this extension correctly. It proves our
 * side of the contract given the contract as documented.
 *
 * Deliberate fidelity choices:
 *   - summary data is served in 10,000 row pages, like the real reader
 *   - releaseAsync must be called before a second reader can be opened, and
 *     throws if it is not, so a leak shows up here rather than in Tableau
 *   - settings values come back as strings, because Tableau stores them as
 *     strings, which is where type-coercion bugs hide
 */
(function (global) {
  'use strict';

  var PAGE_SIZE = 10000;

  function makeReaderFactory (getRows, getColumns) {
    var openReader = null;
    return function getSummaryDataReaderAsync () {
      if (openReader) {
        return Promise.reject(new Error(
          'A DataTableReader is already open on this worksheet. Call releaseAsync first.'));
      }
      var rows = getRows();
      var columns = getColumns();
      var pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      var reader = {
        pageCount: pageCount,
        totalRowCount: rows.length,
        getPageAsync: function (i) {
          if (i < 0 || i >= pageCount) return Promise.reject(new RangeError('page out of range: ' + i));
          var slice = rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
          return Promise.resolve({
            columns: columns.map(function (name, idx) {
              return { fieldName: name, index: idx, dataType: typeof (rows[0] || {})[name] === 'number' ? 'float' : 'string' };
            }),
            data: slice.map(function (r) {
              return columns.map(function (c) {
                var v = r[c];
                return {
                  value: v,
                  formattedValue: v === null || v === undefined ? '' : String(v),
                  nativeValue: v
                };
              });
            })
          });
        },
        releaseAsync: function () { openReader = null; return Promise.resolve(); }
      };
      openReader = reader;
      return Promise.resolve(reader);
    };
  }

  function MockWorksheet () {
    var self = this;
    this.name = 'Sheet 1';
    this.backgroundColor = '#ffffff';
    this._fixtureKey = 'typical';
    this._listeners = {};
    this._encodings = {
      category: { name: 'Category', fieldId: 'f-cat' },
      value: { name: 'Value', fieldId: 'f-val' },
      color: { name: 'Segment', fieldId: 'f-seg' },
      label: { name: 'Note', fieldId: 'f-note' }
    };
    this.selectedTuples = [];
    this.hoveredTuple = null;

    this.getSummaryDataReaderAsync = makeReaderFactory(
      function () { return global.LP_FIXTURES[self._fixtureKey].rows; },
      function () { return global.LP_FIXTURES[self._fixtureKey].columns; }
    );
  }

  MockWorksheet.prototype.getVisualSpecificationAsync = function () {
    var enc = [];
    var self = this;
    ['category', 'value', 'color', 'label'].forEach(function (id) {
      if (self._encodings[id]) {
        enc.push({
          id: id,
          fieldEncodingId: id + '-0',
          type: 'custom',
          field: self._encodings[id]
        });
      }
    });
    return Promise.resolve({
      rowFields: [],
      columnFields: [],
      activeMarksSpecificationIndex: 0,
      marksSpecifications: [{ primitiveType: 'viz-extension', encodings: enc }]
    });
  };

  MockWorksheet.prototype.addEventListener = function (type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
    return function () { /* unregister */ };
  };

  MockWorksheet.prototype._emit = function (type) {
    (this._listeners[type] || []).forEach(function (f) {
      try { f({ type: type }); } catch (e) { console.error('[mock] listener threw', e); }
    });
  };

  MockWorksheet.prototype.selectTuplesAsync = function (tuples, mode) {
    if (!Array.isArray(tuples)) return Promise.reject(new TypeError('tuples must be an array'));
    this.selectedTuples = tuples.slice();
    this.lastSelectMode = mode;
    global.dispatchEvent(new CustomEvent('lp-mock-select', { detail: { tuples: tuples, mode: mode } }));
    return Promise.resolve();
  };

  MockWorksheet.prototype.hoverTupleAsync = function (tuple) {
    this.hoveredTuple = tuple;
    global.dispatchEvent(new CustomEvent('lp-mock-hover', { detail: { tuple: tuple } }));
    return Promise.resolve();
  };

  MockWorksheet.prototype.getTooltipTextAsync = function (tuple) {
    return Promise.resolve('Tooltip for tuple ' + tuple);
  };

  /* Settings store: string values only, exactly like the real one. */
  function MockSettings () { this._v = {}; this.saveCount = 0; }
  MockSettings.prototype.getAll = function () {
    var out = {};
    for (var k in this._v) out[k] = this._v[k];
    return out;
  };
  MockSettings.prototype.get = function (k) { return this._v[k]; };
  MockSettings.prototype.set = function (k, v) { this._v[k] = String(v); };
  MockSettings.prototype.erase = function (k) { delete this._v[k]; };
  MockSettings.prototype.saveAsync = function () {
    this.saveCount++;
    var snapshot = this.getAll();
    try { global.localStorage.setItem('lp-mock-settings', JSON.stringify(snapshot)); } catch (e) { /* private mode */ }
    return Promise.resolve(snapshot);
  };
  MockSettings.prototype._restore = function () {
    try {
      var raw = global.localStorage.getItem('lp-mock-settings');
      if (raw) this._v = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  };

  var worksheet = new MockWorksheet();
  var settings = new MockSettings();
  settings._restore();

  global.tableau = {
    extensions: {
      initializeAsync: function () {
        return new Promise(function (res) { setTimeout(res, 0); });
      },
      worksheetContent: { worksheet: worksheet },
      settings: settings,
      environment: { mode: 'authoring', apiVersion: '1.17.0', tableauVersion: 'mock' },
      ui: {
        displayDialogAsync: function () { return Promise.reject(new Error('not implemented in mock')); }
      }
    },
    TableauEventType: {
      SummaryDataChanged: 'summary-data-changed',
      FilterChanged: 'filter-changed',
      ParameterChanged: 'parameter-changed',
      MarkSelectionChanged: 'mark-selection-changed',
      SettingsChanged: 'settings-changed',
      WorksheetFormattingChanged: 'worksheet-formatting-changed'
    },
    SelectOptions: {
      Simple: 'select-options-simple',
      Toggle: 'select-options-toggle'
    },
    MarkType: { VizExtension: 'viz-extension' }
  };

  /* Handles the dev toolbar reaches for. */
  global.LP_MOCK = {
    worksheet: worksheet,
    settings: settings,
    setFixture: function (key) {
      worksheet._fixtureKey = key;
      worksheet._emit('summary-data-changed');
    },
    setEncoding: function (id, fieldName) {
      if (!fieldName) worksheet._encodings[id] = null;
      else worksheet._encodings[id] = { name: fieldName, fieldId: 'f-' + fieldName };
      worksheet._emit('summary-data-changed');
    },
    setBackground: function (hex) {
      worksheet.backgroundColor = hex;
      worksheet._emit('summary-data-changed');
    },
    clearSettings: function () {
      settings._v = {};
      try { global.localStorage.removeItem('lp-mock-settings'); } catch (e) { /* ignore */ }
      global.location.reload();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
