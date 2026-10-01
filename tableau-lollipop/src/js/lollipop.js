/* Lollipop Viz Extension - entry point.
 *
 * Binds the Tableau worksheet to the renderer and the settings panel:
 *   - reads the Marks card encodings declared in lollipop.trex
 *   - pulls summary data through the paged reader
 *   - persists every setting into the workbook via tableau.extensions.settings
 *   - pushes selection and hover back into Tableau
 *
 * Everything that touches the Tableau API is wrapped so that an API shape we
 * did not anticipate degrades to a still-drawing chart instead of a blank
 * rectangle. Failures are surfaced in the console with an LP prefix.
 */
(function (global) {
  'use strict';

  var schema = global.LP.schema;
  var SETTINGS_PREFIX = 'lollipop.';

  var state = {
    worksheet: null,
    renderer: null,
    panel: null,
    settings: schema.resolve({}),
    model: { rows: [], catName: '', valueName: '' },
    saveTimer: null,
    resizeTimer: null,
    ready: false
  };

  function log () {
    if (global.console && console.warn) console.warn.apply(console, ['[LP]'].concat([].slice.call(arguments)));
  }

  /* ------------------------------------------------------------- settings */

  function readStoredSettings () {
    var stored = {};
    try {
      var all = global.tableau.extensions.settings.getAll();
      Object.keys(all).forEach(function (k) {
        if (k.indexOf(SETTINGS_PREFIX) === 0) stored[k.slice(SETTINGS_PREFIX.length)] = all[k];
      });
    } catch (e) { log('could not read settings', e); }
    return schema.resolve(stored);
  }

  function persist (key, value) {
    try {
      global.tableau.extensions.settings.set(SETTINGS_PREFIX + key, String(value));
    } catch (e) { log('could not stage setting', key, e); }
    if (state.saveTimer) clearTimeout(state.saveTimer);
    /* Batch rapid stepper clicks into one workbook write. */
    state.saveTimer = setTimeout(function () {
      state.saveTimer = null;
      try {
        var p = global.tableau.extensions.settings.saveAsync();
        if (p && p.catch) p.catch(function (e) { log('saveAsync rejected', e); });
      } catch (e) { log('saveAsync threw', e); }
    }, 400);
  }

  function setSetting (key, value) {
    state.settings[key] = schema.coerce(key, value);
    persist(key, state.settings[key]);
    redraw();
  }

  function resetSettings () {
    state.settings = schema.resolve({});
    Object.keys(schema.DEFAULTS).forEach(function (k) { persist(k, state.settings[k]); });
    redraw();
  }

  function replaceAllSettings (obj) {
    Object.keys(schema.DEFAULTS).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        state.settings[k] = schema.coerce(k, obj[k]);
        persist(k, state.settings[k]);
      }
    });
    redraw();
  }

  /* ----------------------------------------------------------------- data */

  /* Map manifest encoding ids to the fields the author dropped on them. */
  function readEncodings (worksheet) {
    return worksheet.getVisualSpecificationAsync().then(function (spec) {
      var map = {};
      if (!spec || !spec.marksSpecifications) return map;
      var idx = spec.activeMarksSpecificationIndex;
      if (idx === undefined || idx === null || idx < 0) return map;
      var card = spec.marksSpecifications[idx];
      if (!card || !card.encodings) return map;
      card.encodings.forEach(function (enc) {
        /* Keep the first field per encoding; the manifest caps each at one. */
        if (!map[enc.id]) map[enc.id] = enc.field;
      });
      return map;
    });
  }

  function fieldName (f) {
    if (!f) return null;
    return f.name || f.fieldName || f.fieldId || null;
  }

  /* Read every page of summary data into plain rows keyed by column name. */
  function readSummary (worksheet) {
    return worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true })
      .then(function (reader) {
        var pages = [];
        var chain = Promise.resolve();
        for (var i = 0; i < reader.pageCount; i++) {
          (function (p) {
            chain = chain.then(function () {
              return reader.getPageAsync(p).then(function (page) { pages.push(page); });
            });
          })(i);
        }
        return chain.then(function () {
          var cols = pages.length ? pages[0].columns : [];
          var names = cols.map(function (c) { return c.fieldName; });
          var rows = [];
          pages.forEach(function (page) {
            page.data.forEach(function (r) {
              var obj = {};
              for (var c = 0; c < names.length; c++) {
                obj[names[c]] = r[c] ? (r[c].value !== undefined ? r[c].value : r[c].formattedValue) : null;
              }
              obj.__fmt = {};
              for (var c2 = 0; c2 < names.length; c2++) {
                obj.__fmt[names[c2]] = r[c2] ? r[c2].formattedValue : '';
              }
              rows.push(obj);
            });
          });
          return reader.releaseAsync().then(function () { return { rows: rows, columns: names }; })
            .catch(function () { return { rows: rows, columns: names }; });
        });
      });
  }

  function buildModel (worksheet) {
    return Promise.all([readSummary(worksheet), readEncodings(worksheet)])
      .then(function (res) {
        var data = res[0], enc = res[1];
        var catField = fieldName(enc.category);
        var valField = fieldName(enc.value);
        var colField = fieldName(enc.color);
        var labField = fieldName(enc.label);

        /* If the author has not filled the shelves, fall back to the first
         * string column and first numeric column so the chart still draws. */
        if (!catField || data.columns.indexOf(catField) < 0) {
          catField = data.columns.find(function (c) {
            return data.rows.length && typeof data.rows[0][c] === 'string';
          }) || data.columns[0];
        }
        if (!valField || data.columns.indexOf(valField) < 0) {
          valField = data.columns.find(function (c) {
            return data.rows.length && typeof data.rows[0][c] === 'number';
          }) || data.columns[1];
        }

        var rows = [];
        data.rows.forEach(function (r, i) {
          var v = Number(r[valField]);
          if (!isFinite(v)) return;
          rows.push({
            cat: r[catField] === null || r[catField] === undefined ? '(blank)' : String(r[catField]),
            value: v,
            colorKey: colField ? r[colField] : null,
            labelField: labField ? (r.__fmt[labField] || r[labField]) : null,
            /* Tuple ids for viz extensions are 1-based row indices into the
             * summary data. Confirm against Tableau Desktop before relying on
             * selection round-tripping. */
            tupleId: i + 1
          });
        });

        var bg = '#ffffff';
        try { if (worksheet.backgroundColor) bg = worksheet.backgroundColor; } catch (e) { /* not fatal */ }

        return {
          rows: rows,
          catName: catField || 'Category',
          valueName: valField || 'Value',
          worksheetBg: bg,
          hasColor: !!colField,
          hasLabel: !!labField,
          emptyMessage: data.rows.length
            ? 'No numeric values to plot. Put a measure on the Value shelf.'
            : 'Drop a dimension on Category and a measure on Value.'
        };
      });
  }

  /* ----------------------------------------------------------- Tableau out */

  function pushSelection (tupleIds, additive) {
    if (!state.worksheet || !state.settings.selectEnabled) return;
    try {
      var mode = additive ? 'select-options-toggle' : 'select-options-simple';
      var p = state.worksheet.selectTuplesAsync(tupleIds, mode);
      if (p && p.catch) p.catch(function (e) { log('selectTuplesAsync rejected', e); });
    } catch (e) { log('selectTuplesAsync threw', e); }
  }

  var lastHover = null;
  function pushHover (tupleId) {
    if (!state.worksheet || !state.settings.tooltipEnabled) return;
    if (tupleId === lastHover) return;
    lastHover = tupleId;
    try {
      /* A null/0 tuple clears the native tooltip. */
      var p = state.worksheet.hoverTupleAsync(tupleId === null ? 0 : tupleId);
      if (p && p.catch) p.catch(function () { /* hover is cosmetic, stay quiet */ });
    } catch (e) { /* hover is cosmetic */ }
  }

  /* --------------------------------------------------------------- render */

  function redraw () {
    if (!state.renderer) return;
    state.renderer.draw(state.model, state.settings, {
      onSelect: pushSelection,
      onHover: pushHover
    });
    /* The panel's own colours come after the draw, because "Match chart" needs
     * the background the renderer actually resolved. */
    if (state.panel) state.panel.applyAppearance(state.settings, state.renderer.chartBg);
  }

  /* Refreshes are serialized, for two reasons that both bite in Tableau:
   *
   *   1. A worksheet allows only one open DataTableReader at a time, so two
   *      overlapping reads make the second one fail outright.
   *   2. Without ordering, a slow earlier read can resolve after a fast later
   *      one and overwrite fresh data with stale data. A filter changed twice
   *      in quick succession would leave the chart showing the wrong answer,
   *      silently and without an error.
   *
   * So at most one read is in flight; any request arriving during it collapses
   * into a single follow-up run once it finishes. The last request always wins.
   */
  var refreshing = false;
  var refreshQueued = false;

  function refreshData () {
    if (!state.worksheet) return Promise.resolve();
    if (refreshing) { refreshQueued = true; return Promise.resolve(); }
    refreshing = true;

    var done = function () {
      refreshing = false;
      if (refreshQueued) { refreshQueued = false; return refreshData(); }
      return undefined;
    };

    return buildModel(state.worksheet).then(function (m) {
      state.model = m;
      redraw();
    }, function (e) {
      log('data refresh failed', e);
      state.model = { rows: [], emptyMessage: 'Could not read data from this worksheet.' };
      redraw();
    }).then(done, done);
  }

  /* ----------------------------------------------------------------- boot */

  function mount (worksheet) {
    state.worksheet = worksheet;
    state.settings = readStoredSettings();

    var root = document.getElementById('lp-root');
    var chart = document.getElementById('lp-chart');
    state.renderer = new global.LP.Renderer(chart);
    state.panel = new global.LP.Panel(root, {
      get: function () { return state.settings; },
      set: setSetting,
      reset: resetSettings,
      replaceAll: replaceAllSettings
    });
    /* Theme it once up front, so the panel is never briefly the wrong colour
     * between mounting and the first draw. */
    state.panel.applyAppearance(state.settings, null);

    /* Resize: debounce so a drag does not queue a hundred redraws, but keep
     * the delay short enough that the chart feels attached to the handle. */
    global.addEventListener('resize', function () {
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function () { state.resizeTimer = null; redraw(); }, 60);
    });

    if (worksheet && worksheet.addEventListener) {
      var T = global.tableau.TableauEventType || {};
      [T.SummaryDataChanged, T.FilterChanged, T.ParameterChanged].forEach(function (evt) {
        if (!evt) return;
        try { worksheet.addEventListener(evt, refreshData); } catch (e) { log('listener failed for', evt, e); }
      });
      if (T.WorksheetFormattingChanged) {
        try { worksheet.addEventListener(T.WorksheetFormattingChanged, refreshData); } catch (e) { /* optional */ }
      }
    }

    state.ready = true;
    return refreshData();
  }

  function boot () {
    if (!global.tableau || !global.tableau.extensions) {
      log('Tableau Extensions API not present');
      return;
    }
    global.tableau.extensions.initializeAsync().then(function () {
      var wc = global.tableau.extensions.worksheetContent;
      if (!wc || !wc.worksheet) {
        log('no worksheetContent: this build must be loaded as a viz extension, not a dashboard extension');
        return;
      }
      return mount(wc.worksheet);
    }).catch(function (e) {
      log('initializeAsync failed', e);
      var chart = document.getElementById('lp-chart');
      if (chart) {
        chart.innerHTML = '';
        var d = document.createElement('div');
        d.className = 'lp-empty';
        d.textContent = 'This extension could not start. Check the browser console for details.';
        chart.appendChild(d);
      }
    });
  }

  /* Exposed so the development harness can drive the same code path. */
  global.LP = global.LP || {};
  global.LP.app = {
    boot: boot,
    mount: mount,
    refreshData: refreshData,
    redraw: redraw,
    state: state
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
