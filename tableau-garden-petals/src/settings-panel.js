/* Settings panel. Schema-driven: every option is one row in SCHEMA, the panel is built
   from it, and each change is applied live and saved through onChange(path, value). */
(function (global) {
  'use strict';

  var PRESETS = {
    peach:  { label: 'Peach (Makeover Monday)', c: { bg: '#fdf3ec', stage: '#ffffff', ink: '#1b2a2e', ink2: '#4a5c61', stem: '#3d9a66', coast: '#c9b8a8', land: '#f6e9df', bee: '#f2b21d', frost: '#5fc3ee' } },
    garden: { label: 'Garden light', c: { bg: '#eef4f1', stage: '#f8fbf9', ink: '#122427', ink2: '#41575b', stem: '#3d9a66', coast: '#9fbcb2', land: '#e3ede8', bee: '#f2b21d', frost: '#5fc3ee' } },
    night:  { label: 'Garden night', c: { bg: '#0a1619', stage: '#0d1d21', ink: '#e7f3ef', ink2: '#a8c2bd', stem: '#5cc489', coast: '#3a5e64', land: '#12292e', bee: '#ffc83d', frost: '#aeeaff' } },
    paper:  { label: 'Plain paper', c: { bg: '#ffffff', stage: '#ffffff', ink: '#222222', ink2: '#555555', stem: '#5a8f6b', coast: '#bbbbbb', land: '#f0f0f0', bee: '#e0a800', frost: '#6fc3e6' } }
  };
  var FONTS = ['Poppins', 'Figtree', 'Bricolage Grotesque', 'Georgia', 'Trebuchet MS', 'Verdana', 'Tahoma', 'Arial'];
  var TABS = ['Layout', 'Petals', 'Values', 'Reference', 'Tooltip', 'Bloom', 'Effects', 'Title', 'Colors', 'Fonts', 'Fields'];
  var yn = function (a) { return a; };

  /* tab, section, path, label, type, options... */
  var SCHEMA = [
    { tab: 'Layout', sec: 'View', path: 'layout.mode', label: 'Arrange flowers as', type: 'select', opts: [['grid', 'Grid, like the original'], ['garden', 'Garden map, placed by location'], ['alt', 'Altitude, height = score']],
      help: 'Garden map places each flower at its country on an invisible world map. Altitude stands each flower at its longitude with its height set by Score.' },
    { tab: 'Layout', sec: 'Grid', path: 'layout.fit', label: 'Fit', type: 'select', opts: [['scroll', 'Fixed flower size, scroll'], ['fit', 'Fit everything on screen'], ['columns', 'Set number of columns']], when: function (s) { return s.layout.mode === 'grid'; } },
    { tab: 'Layout', sec: 'Grid', path: 'layout.columns', label: 'Columns', type: 'number', min: 1, max: 30, step: 1, when: function (s) { return s.layout.mode === 'grid' && s.layout.fit === 'columns'; } },
    { tab: 'Layout', sec: 'Grid', path: 'layout.colGap', label: 'Column gap', type: 'number', min: 0, max: 80, step: 2, unit: 'px', when: function (s) { return s.layout.mode === 'grid'; } },
    { tab: 'Layout', sec: 'Grid', path: 'layout.rowGap', label: 'Row gap', type: 'number', min: 0, max: 60, step: 2, unit: 'px', when: function (s) { return s.layout.mode === 'grid'; } },
    { tab: 'Layout', sec: 'Grid', path: 'layout.align', label: 'Align', type: 'select', opts: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], when: function (s) { return s.layout.mode === 'grid'; } },
    { tab: 'Layout', sec: 'View', path: 'layout.viewBar', label: 'Show the quick view bar on the chart', type: 'check', help: 'The Grid, Garden map and Altitude buttons, plus Glow and Wilt toggles, above the chart.' },
    { tab: 'Layout', sec: 'Size', path: 'layout.flowerSize', label: 'Flower size', type: 'number', min: 40, max: 260, step: 5, unit: 'px', help: 'In the map and altitude views this sets the head size; 110 is automatic.' },
    { tab: 'Layout', sec: 'Map and altitude', path: 'layout.nudge', label: 'Nudge crowded flowers apart', type: 'check', when: function (s) { return s.layout.mode !== 'grid'; }, help: 'Stems stay rooted at the true location while the blooms move apart.' },
    { tab: 'Layout', sec: 'Order', path: 'layout.sort', label: 'Sort flowers', type: 'select', opts: [['score-desc', 'Score, high to low'], ['score-asc', 'Score, low to high'], ['name-asc', 'Name, A to Z'], ['name-desc', 'Name, Z to A'], ['group', 'Group, then score'], ['none', 'Data order']] },
    { tab: 'Layout', sec: 'Order', path: 'layout.limit', label: 'Show only the first', type: 'number', min: 0, max: 300, step: 1, help: '0 shows every flower. Otherwise only the first N in sort order.' },
    { tab: 'Layout', sec: 'Labels', path: 'layout.under', label: 'Under each flower', type: 'select', opts: [['name-score', 'Name and score'], ['name', 'Name'], ['none', 'Nothing']] },
    { tab: 'Layout', sec: 'Labels', path: 'layout.center', label: 'Center', type: 'select', opts: [['dot', 'Small dot'], ['none', 'Nothing']] },

    { tab: 'Petals', sec: 'Shape', path: 'petals.width', label: 'Width', type: 'number', min: 15, max: 60, step: 1, unit: '%' },
    { tab: 'Petals', sec: 'Shape', path: 'petals.tip', label: 'Tip', type: 'select', opts: [['pointed', 'Pointed'], ['round', 'Round']] },
    { tab: 'Petals', sec: 'Shape', path: 'petals.start', label: 'Start angle', type: 'number', min: 0, max: 345, step: 15, unit: '°', help: '90 puts the first petal at the top.' },
    { tab: 'Petals', sec: 'Shape', path: 'petals.direction', label: 'Direction', type: 'select', opts: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise']] },
    { tab: 'Petals', sec: 'Shape', path: 'petals.opacity', label: 'Opacity', type: 'number', min: 20, max: 100, step: 5, unit: '%' },
    { tab: 'Petals', sec: 'Shape', path: 'petals.outline', label: 'Outline', type: 'select', opts: [['none', 'None'], ['white', 'White'], ['dark', 'Dark']] },
    { tab: 'Petals', sec: 'Scale', path: 'petals.scale', label: 'Full length is', type: 'select', opts: [['shared', 'The largest value in the data'], ['own', 'Each petal’s own largest value'], ['fixed', 'A fixed value']] },
    { tab: 'Petals', sec: 'Scale', path: 'petals.fixed', label: 'Fixed value', type: 'number', min: 0.01, max: 100000, step: 0.01, when: function (s) { return s.petals.scale === 'fixed'; } },
    { tab: 'Petals', sec: 'Scale', path: 'petals.floor', label: 'Smallest petal', type: 'number', min: 0, max: 20, step: 1, unit: '%', help: 'A floor so tiny values still show as a sliver.' },
    { tab: 'Petals', sec: 'Center', path: 'petals.dot', label: 'Dot size', type: 'number', min: 0, max: 30, step: 1, unit: '%' },
    { tab: 'Petals', sec: 'Center', path: 'petals.dotColor', label: 'Dot color', type: 'color' },
    { tab: 'Petals', sec: 'Each petal', path: 'petals.list', label: '', type: 'petals', help: 'Rename a petal for the legend and tooltips, pick its color, or move it around the flower.' },

    { tab: 'Values', sec: 'Number format', path: 'values.format', label: 'Format', type: 'select', opts: [['pct0', 'Percent, no decimals (42%)'], ['pct1', 'Percent, one decimal (42.3%)'], ['num0', 'Number, no decimals'], ['num1', 'Number, one decimal'], ['num2', 'Number, two decimals'], ['raw', 'As is']],
      help: 'Percent formats expect values between 0 and 1.' },
    { tab: 'Values', sec: 'Number format', path: 'values.prefix', label: 'Prefix', type: 'text' },
    { tab: 'Values', sec: 'Number format', path: 'values.suffix', label: 'Suffix', type: 'text' },

    { tab: 'Reference', sec: 'Outline', path: 'reference.show', label: 'Draw a reference outline', type: 'check', help: 'Needs a field on Detail with the reference value for each petal, such as OECD Value. See the Fields tab.' },
    { tab: 'Reference', sec: 'Outline', path: 'reference.label', label: 'Name for the outline', type: 'text', help: 'Blank uses the reference field’s name.' },
    { tab: 'Reference', sec: 'Outline', path: 'reference.color', label: 'Color', type: 'color' },
    { tab: 'Reference', sec: 'Outline', path: 'reference.width', label: 'Line width', type: 'number', min: 0.5, max: 4, step: 0.5, unit: 'px' },

    { tab: 'Tooltip', sec: 'Hover tooltip', path: 'tooltip.mode', label: 'Shows', type: 'select', opts: [['auto', 'Scores if available, else petals'], ['scores', 'Scores only (Science, Math, Reading)'], ['petals', 'Petal values only'], ['both', 'Scores and petal values']],
      help: 'Scores come from fields named like Science, Math and Reading. Drop them on Detail, or pick them on the Fields tab. The close-up bloom always shows the petals.' },
    { tab: 'Bloom', sec: 'Close-up', path: 'bloom.on', label: 'Click to bloom', type: 'check', help: 'Opens a flower up close on click.' },
    { tab: 'Bloom', sec: 'Close-up', path: 'bloom.size', label: 'Size', type: 'number', min: 40, max: 100, step: 5, unit: '%' },
    { tab: 'Bloom', sec: 'Close-up', path: 'bloom.bg', label: 'Background', type: 'color' },
    { tab: 'Bloom', sec: 'Close-up', path: 'bloom.accent', label: 'Accent', type: 'color' },
    { tab: 'Bloom', sec: 'Close-up', path: 'bloom.dim', label: 'Dim the chart', type: 'number', min: 0, max: 100, step: 5, unit: '%' },
    { tab: 'Bloom', sec: 'Text', path: 'bloom.title', label: 'Title', type: 'text', help: 'Placeholders: {flower} {group} {score} {reference}.' },
    { tab: 'Bloom', sec: 'Text', path: 'bloom.subtitle', label: 'Subtitle', type: 'text' },
    { tab: 'Bloom', sec: 'Text', path: 'bloom.centerScore', label: 'Show the score in the center', type: 'check' },
    { tab: 'Bloom', sec: 'Labels', path: 'bloom.labels', label: 'Label each petal', type: 'check' },
    { tab: 'Bloom', sec: 'Labels', path: 'bloom.labelContent', label: 'Label shows', type: 'select', opts: [['name-value', 'Name and value'], ['name', 'Name'], ['value', 'Value']] },
    { tab: 'Bloom', sec: 'Labels', path: 'bloom.labelSize', label: 'Label size', type: 'number', min: 0, max: 20, step: 1, unit: 'px', help: '0 sizes labels automatically.' },
    { tab: 'Bloom', sec: 'Labels', path: 'bloom.key', label: 'Name the reference outline under the flower', type: 'check' },
    { tab: 'Bloom', sec: 'Labels', path: 'bloom.arrows', label: 'Arrow keys step through flowers', type: 'check' },

    { tab: 'Effects', sec: 'Glow', path: 'effects.frost', label: 'Make a flower glow when a petal is high', type: 'check', help: 'Lights up the flower and the watched petal when its value reaches the level below.' },
    { tab: 'Effects', sec: 'Glow', path: 'effects.glowStyle', label: 'Style', type: 'select', opts: [['glow', 'Soft glow'], ['frost', 'Frosted edge with sparkles'], ['both', 'Glow and frost']], when: function (s) { return s.effects.frost; } },
    { tab: 'Effects', sec: 'Glow', path: 'effects.frostPetal', label: 'Petal to watch', type: 'petalpick', when: function (s) { return s.effects.frost; } },
    { tab: 'Effects', sec: 'Glow', path: 'effects.frostAt', label: 'At or above', type: 'number', min: 0, max: 100, step: 1, unit: '%', when: function (s) { return s.effects.frost; }, help: 'Percent for values between 0 and 1, raw value otherwise.' },
    { tab: 'Effects', sec: 'Wilt', path: 'effects.wilt', label: 'Wilt flagged flowers', type: 'check', help: 'Droops the petals and drops one for any flower whose Caution field says Yes, True or 1.' },
    { tab: 'Effects', sec: 'Twins', path: 'effects.twins', label: 'Shape twins with bees', type: 'check', help: 'Hover a flower in the map or altitude view and bees fly to the three countries with the most similar petal shape.' },
    { tab: 'Effects', sec: 'Map', path: 'effects.coast', label: 'Coastline', type: 'select', opts: [['peek', 'Peek on load, then dissolve'], ['on', 'Keep faintly visible'], ['off', 'Never show']] },
    { tab: 'Effects', sec: 'Motion', path: 'effects.breeze', label: 'Gentle sway', type: 'check' },
    { tab: 'Effects', sec: 'Motion', path: 'effects.names', label: 'Names on the map', type: 'select', opts: [['auto', 'When zoomed in'], ['all', 'Always'], ['none', 'Only the selected flower']] },

    { tab: 'Title', sec: 'Title', path: 'title.show', label: 'Show the title and legend', type: 'check' },
    { tab: 'Title', sec: 'Title', path: 'title.text', label: 'Title text', type: 'textarea', help: 'Press Enter to start a second line. Blank uses the worksheet name.' },
    { tab: 'Title', sec: 'Title', path: 'title.size', label: 'Size', type: 'number', min: 12, max: 48, step: 1, unit: 'px' },

    { tab: 'Colors', sec: 'Preset', path: '', label: 'Start from', type: 'preset' },
    { tab: 'Colors', sec: 'Surfaces', path: 'colors.bg', label: 'Page', type: 'color' },
    { tab: 'Colors', sec: 'Surfaces', path: 'colors.stage', label: 'Chart area', type: 'color' },
    { tab: 'Colors', sec: 'Text', path: 'colors.ink', label: 'Text', type: 'color' },
    { tab: 'Colors', sec: 'Text', path: 'colors.ink2', label: 'Secondary text', type: 'color' },
    { tab: 'Colors', sec: 'Legend and instructions', path: 'colors.legendInk', label: 'Legend text', type: 'color', auto: true, help: 'The petal key at the top right. Automatic uses the main text color.' },
    { tab: 'Colors', sec: 'Legend and instructions', path: 'colors.hintInk', label: 'Instruction text', type: 'color', auto: true, help: 'The tip at the bottom left of the chart.' },
    { tab: 'Colors', sec: 'Garden', path: 'colors.stem', label: 'Stems', type: 'color' },
    { tab: 'Colors', sec: 'Garden', path: 'colors.land', label: 'Land (coastline peek)', type: 'color' },
    { tab: 'Colors', sec: 'Garden', path: 'colors.coast', label: 'Coastline', type: 'color' },
    { tab: 'Colors', sec: 'Garden', path: 'colors.bee', label: 'Bees', type: 'color' },
    { tab: 'Colors', sec: 'Garden', path: 'colors.frost', label: 'Glow', type: 'color' },

    { tab: 'Fonts', sec: 'Sizes', path: 'fonts.uiSize', label: 'Legend and instructions', type: 'number', min: 10, max: 20, step: 0.5, unit: 'px', help: 'At 144 DPI, 13px reads like 10pt.' },
    { tab: 'Fonts', sec: 'Sizes', path: 'fonts.labelSize', label: 'Flower names', type: 'number', min: 10, max: 20, step: 0.5, unit: 'px' },
    { tab: 'Fonts', sec: 'Fonts', path: 'fonts.body', label: 'Body', type: 'select', opts: FONTS.map(function (f) { return [f, f]; }) },
    { tab: 'Fonts', sec: 'Fonts', path: 'fonts.title', label: 'Title', type: 'select', opts: FONTS.map(function (f) { return [f, f]; }), help: 'Poppins, Figtree and Bricolage Grotesque load from Google Fonts. The rest are on every PC.' },

    { tab: 'Fields', sec: 'Matched by name', path: 'fields.ref', label: 'Reference value', type: 'fieldpick', help: 'Tableau allows four shelves of its own (Flower, Petal, Length, Score). Drop the rest on Detail. They are matched by field name, or pick one here to override.' },
    { tab: 'Fields', sec: 'Matched by name', path: 'fields.group', label: 'Group (bloom title)', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Matched by name', path: 'fields.rank', label: 'Rank', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Matched by name', path: 'fields.color', label: 'Petal color (hex)', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Matched by name', path: 'fields.caution', label: 'Caution flag (wilt)', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Scores for the tooltip', path: 'fields.sci', label: 'Science', type: 'fieldpick', help: 'Defaults to the Score shelf.' },
    { tab: 'Fields', sec: 'Scores for the tooltip', path: 'fields.math', label: 'Math', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Scores for the tooltip', path: 'fields.read', label: 'Reading', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Location', path: 'fields.lat', label: 'Latitude', type: 'fieldpick', help: 'Without these two, the map looks each flower’s name up in a built-in list of about 200 countries.' },
    { tab: 'Fields', sec: 'Location', path: 'fields.lon', label: 'Longitude', type: 'fieldpick' },
    { tab: 'Fields', sec: 'Diagnostics', path: '', label: '', type: 'diag' }
  ];

  function getp(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setp(o, path, v) { var ks = path.split('.'), t = o; for (var i = 0; i < ks.length - 1; i++) t = t[ks[i]]; t[ks[ks.length - 1]] = v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CSS = [
    '.gs-gear{position:absolute;right:14px;top:8px;z-index:40;width:32px;height:32px;border-radius:50%;border:1px solid rgba(0,0,0,.18);background:#fff;color:#333;font-size:17px;line-height:1;cursor:pointer;opacity:.55;transition:opacity .15s}',
    '.gs-gear:hover,.gs-gear:focus-visible{opacity:1}',
    '.gs-panel{position:absolute;top:8px;right:8px;width:380px;height:min(640px,calc(100% - 16px));min-width:250px;min-height:150px;max-width:calc(100% - 8px);max-height:calc(100% - 8px);resize:both;overflow:hidden;border-radius:14px;z-index:50;background:#f7f7fb;color:#1c2330;box-shadow:0 10px 36px rgba(0,0,0,.32);display:flex;flex-direction:column;font:13px/1.45 Poppins,system-ui,sans-serif}',
    '.gs-panel[hidden]{display:none!important}',
    '.gs-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 6px 16px;cursor:grab;touch-action:none;user-select:none}.gs-top.drag{cursor:grabbing}.gs-top h2{font-size:15px;margin:0;flex:1}.gs-top .gs-x{cursor:pointer}',
    '.gs-panel.min{height:auto!important;min-height:0;resize:none}.gs-panel.min .gs-tabs,.gs-panel.min .gs-body,.gs-panel.min .gs-foot{display:none}',
    '.gs-x{border:1px solid #cdd2dd;background:#fff;border-radius:8px;padding:4px 12px;cursor:pointer;font:600 12px Poppins,sans-serif;color:#1c2330}',
    '.gs-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:6px 16px 10px}',
    '.gs-tabs button{border:1px solid #cdd2dd;background:#fff;color:#1c2330;border-radius:999px;padding:4px 12px;font:500 12px Poppins,sans-serif;cursor:pointer}',
    '.gs-tabs button[aria-selected="true"]{background:#2a76d2;border-color:#2a76d2;color:#fff}',
    '.gs-body{flex:1;overflow:auto;padding:4px 16px 16px;border-top:1px solid #e3e6ee;background:#fff}',
    '.gs-sec{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2a76d2;font-weight:700;margin:16px 0 6px}',
    '.gs-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:4px 10px;align-items:center;margin:7px 0}',
    '.gs-row label{color:#394154}',
    '.gs-row .full{grid-column:1/3}',
    '.gs-help{grid-column:1/3;font-size:11.5px;color:#6a7488}',
    '.gs-row textarea{box-sizing:border-box;width:100%;border:1px solid #cdd2dd;border-radius:8px;padding:6px 8px;font:inherit;background:#fff;color:#1c2330;resize:vertical;min-width:0}.gs-row select,.gs-row input[type=text],.gs-row input[type=number]{box-sizing:border-box;width:100%;border:1px solid #cdd2dd;border-radius:8px;padding:6px 8px;font:inherit;background:#fff;color:#1c2330;min-width:0}',
    '.gs-num{display:flex;gap:8px;align-items:center}.gs-num input[type=number]{flex:1;min-width:0;box-sizing:border-box;border:1px solid #cdd2dd;border-radius:8px;padding:5px 8px;font:13px Poppins,sans-serif}.gs-num output{min-width:24px;font-variant-numeric:tabular-nums;color:#394154}',
    '.gs-row input[type=color]{width:46px;height:28px;border:1px solid #cdd2dd;border-radius:6px;padding:0;background:#fff}',
    '.gs-row input[type=checkbox]{width:16px;height:16px;accent-color:#2a76d2}',
    '.gs-pet{display:grid;grid-template-columns:minmax(0,1fr) 34px 28px 28px;gap:6px;align-items:center;grid-column:1/3}',
    '.gs-pet input[type=text]{padding:5px 7px}.gs-pet button{border:1px solid #cdd2dd;background:#fff;border-radius:6px;height:28px;cursor:pointer;font-size:13px;color:#1c2330}',
    '.gs-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid #e3e6ee;background:#f7f7fb}',
    '.gs-paste{display:flex;gap:8px;padding:8px 14px 0}.gs-paste textarea{flex:1;box-sizing:border-box;border:1px solid #cdd2dd;border-radius:8px;padding:6px 8px;font:12px monospace;min-width:0}.gs-link{border:0;background:none;color:#b3261e;font:600 12px Poppins,sans-serif;cursor:pointer;padding:6px 0}',
    '.gs-btn{border:1px solid #cdd2dd;background:#fff;border-radius:8px;padding:6px 12px;font:600 12px Poppins,sans-serif;cursor:pointer;color:#1c2330}',
    '.gs-diag{grid-column:1/3;white-space:pre-wrap;font:11px/1.5 Consolas,monospace;background:#f1f3f8;border-radius:8px;padding:10px;max-height:300px;overflow:auto;color:#1c2330}',
    '.gs-panel button:focus-visible,.gs-panel select:focus-visible,.gs-panel input:focus-visible{outline:2px solid #2a76d2;outline-offset:1px}'
  ].join('\n');

  function create(host, api) {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var pasteOn = false;
    var gear = document.createElement('button'); gear.className = 'gs-gear'; gear.type = 'button'; gear.title = 'Petal chart settings'; gear.setAttribute('aria-label', 'Open settings'); gear.innerHTML = '&#9881;';
    var panel = document.createElement('div'); panel.className = 'gs-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Petal chart settings');
    host.appendChild(gear); host.appendChild(panel);
    var tab = 'Layout', diagOn = false;

    function render() {
      var s = api.get(), info = api.info(), html = '';
      html += '<div class="gs-top" title="Drag to move"><h2>&#8942;&#8942; Petal Chart Settings</h2><button class="gs-x" data-x="min" type="button" aria-label="' + (panel.classList.contains('min') ? 'Expand' : 'Shrink') + '">' + (panel.classList.contains('min') ? '&#9633;' : '&#8211;') + '</button><button class="gs-x" data-x="close" type="button">Close</button></div>';
      html += '<div class="gs-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-tab="' + t + '" aria-selected="' + (t === tab) + '">' + t + '</button>'; }).join('') + '</div>';
      html += '<div class="gs-body">';
      var lastSec = '';
      SCHEMA.filter(function (r) { return r.tab === tab; }).forEach(function (r) {
        if (r.when && !r.when(s)) return;
        if (r.sec !== lastSec) { html += '<div class="gs-sec">' + esc(r.sec) + '</div>'; lastSec = r.sec; }
        html += '<div class="gs-row">' + control(r, s, info) + (r.help ? '<div class="gs-help">' + esc(r.help) + '</div>' : '') + '</div>';
      });
      html += '</div>' + (pasteOn ? '<div class="gs-paste"><textarea id="gs-pastebox" rows="3" placeholder="Paste copied settings here"></textarea><button class="gs-btn" data-x="pasteapply" type="button">Apply</button></div><div class="gs-help" id="gs-pastemsg"></div>' : '') + '<div class="gs-foot"><button class="gs-link" data-x="reset" type="button">Reset to defaults</button><button class="gs-btn" data-x="paste" type="button">Paste settings</button><button class="gs-btn" data-x="copy" type="button">Copy settings</button></div>';
      var keepScroll = panel.querySelector('.gs-body'); var sc = keepScroll ? keepScroll.scrollTop : 0;
      panel.innerHTML = html;
      var b = panel.querySelector('.gs-body'); if (b) b.scrollTop = sc;
    }

    function control(r, s, info) {
      var v = r.path ? getp(s, r.path) : null, id = 'gs-' + r.path.replace(/\./g, '-');
      var lab = r.label ? '<label for="' + id + '">' + esc(r.label) + '</label>' : '';
      switch (r.type) {
        case 'select': return lab + '<select id="' + id + '" data-p="' + r.path + '">' + r.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
        case 'number': return lab + '<div class="gs-num"><input type="number" id="' + id + '" data-p="' + r.path + '" data-t="num" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + v + '"><output>' + (r.unit || '') + '</output></div>';
        case 'check': return '<label class="full" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="' + id + '" data-p="' + r.path + '"' + (v ? ' checked' : '') + '> ' + esc(r.label) + '</label>';
        case 'color': return lab + '<div style="display:flex;gap:8px;align-items:center"><input type="color" id="' + id + '" data-p="' + r.path + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(v) ? v : (r.auto ? s.colors.ink : '#000000')) + '">' + (r.auto ? '<span style="color:#6a7488">' + (v ? 'Custom' : 'Automatic') + '</span>' + (v ? '<button type="button" class="gs-btn" data-auto="' + r.path + '">Use automatic</button>' : '') : '') + '</div>';
        case 'textarea': return lab + '<textarea id="' + id + '" data-p="' + r.path + '" rows="2">' + esc(v) + '</textarea>';
        case 'text': return lab + '<input type="text" id="' + id + '" data-p="' + r.path + '" value="' + esc(v) + '">';
        case 'preset': return lab + '<select data-preset="1" id="gs-preset"><option value="">Choose...</option>' + Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + esc(PRESETS[k].label) + '</option>'; }).join('') + '</select>';
        case 'fieldpick': return lab + '<select id="' + id + '" data-p="' + r.path + '"><option value="">Auto' + (autoName(info, r.path) ? ' (' + esc(autoName(info, r.path)) + ')' : ' (none found)') + '</option>' +
          info.columns.map(function (c) { return '<option value="' + esc(c) + '"' + (c === v ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>';
        case 'petalpick': return lab + '<select id="' + id + '" data-p="' + r.path + '"><option value="">Choose a petal</option>' + info.petals.map(function (p) { return '<option value="' + esc(p.src) + '"' + (p.src === v ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>';
        case 'petals': return info.petals.length ? info.petals.map(function (p, i) {
          return '<div class="gs-pet"><input type="text" data-pn="' + i + '" value="' + esc(p.name) + '" aria-label="Petal name"><input type="color" data-pc="' + i + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888888') + '" aria-label="Petal color"><button type="button" data-pu="' + i + '" aria-label="Move up">↑</button><button type="button" data-pd="' + i + '" aria-label="Move down">↓</button></div>';
        }).join('') + '<div class="full"><button class="gs-btn" type="button" data-x="petalreset">Reset names, colors and order</button></div>' : '<div class="gs-help">Add a dimension to the Petal shelf first.</div>';
        case 'diag': return '<div class="full"><button class="gs-btn" type="button" data-x="diag">' + (diagOn ? 'Hide' : 'Show') + ' diagnostics</button> <button class="gs-btn" type="button" data-x="diagcopy">Copy</button></div>' + (diagOn ? '<div class="gs-diag" id="gs-diag">' + esc(api.diagnostics()) + '</div>' : '');
      }
      return '';
    }
    function autoName(info, path) { return (info.auto && info.auto[path.split('.')[1]]) || ''; }

    function petalList(info) { return info.petals.map(function (p) { return { src: p.src, name: p.name, color: p.color }; }); }

    panel.addEventListener('input', function (e) {
      var t = e.target, p = t.dataset.p;
      if (t.dataset.pn != null || t.dataset.pc != null) {
        var info = api.info(), list = petalList(info), i = +(t.dataset.pn != null ? t.dataset.pn : t.dataset.pc);
        if (t.dataset.pn != null) list[i].name = t.value; else list[i].color = t.value;
        api.set('petals.list', list); return;
      }
      if (!p) return;
      var v;
      if (t.type === 'checkbox') v = t.checked; else if (t.dataset.t === 'num') { v = parseFloat(t.value); if (isNaN(v)) return; }
      else v = t.value;
      api.set(p, v);
    });
    panel.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.preset && t.value) { Object.keys(PRESETS[t.value].c).forEach(function (k) { api.set('colors.' + k, PRESETS[t.value].c[k], true); }); api.commit(); render(); return; }
      if (t.tagName === 'SELECT' || t.type === 'checkbox') render();
    });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
      if (b.dataset.pu != null || b.dataset.pd != null) {
        var list = petalList(api.info()), i = +(b.dataset.pu != null ? b.dataset.pu : b.dataset.pd), j = b.dataset.pu != null ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return; var tmp = list[i]; list[i] = list[j]; list[j] = tmp; api.set('petals.list', list); render(); return;
      }
      if (b.dataset.auto) { api.set(b.dataset.auto, ''); render(); return; }
      var x = b.dataset.x;
      if (x === 'close') panel.hidden = true;
      else if (x === 'min') { panel.classList.toggle('min'); render(); }
      else if (x === 'reset') { api.reset(); render(); }
      else if (x === 'petalreset') { api.set('petals.list', []); render(); }
      else if (x === 'copy') { var txt = JSON.stringify(api.get(), null, 2); var ok = false; try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta); } catch (err) { ok = false; } if (!ok) { try { navigator.clipboard.writeText(txt); ok = true; } catch (err2) { ok = false; } } b.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(function () { b.textContent = 'Copy settings'; }, 1400); }
      else if (x === 'paste') { pasteOn = !pasteOn; render(); }
      else if (x === 'pasteapply') {
        var box = panel.querySelector('#gs-pastebox'), msg = panel.querySelector('#gs-pastemsg'), obj;
        try { obj = JSON.parse(box.value); } catch (err) { msg.textContent = 'That is not valid settings text.'; return; }
        var walk = function (o, pre) { Object.keys(o).forEach(function (k) { var v = o[k], pth = pre ? pre + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, pth); else api.set(pth, v, true); }); };
        walk(obj, ''); api.commit(); pasteOn = false; render();
      }
      else if (x === 'diag') { diagOn = !diagOn; render(); }
      else if (x === 'diagcopy') { try { navigator.clipboard.writeText(api.diagnostics()); b.textContent = 'Copied'; } catch (err) { b.textContent = 'Copy failed'; } setTimeout(function () { b.textContent = 'Copy'; }, 1400); }
    });
    var drag = null;
    panel.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.gs-top'); if (!h || e.target.closest('button')) return;
      var pr = panel.getBoundingClientRect(), hr = host.getBoundingClientRect();
      drag = { dx: e.clientX - pr.left, dy: e.clientY - pr.top, hx: hr.left, hy: hr.top, hw: hr.width, hh: hr.height, h: h };
      h.classList.add('drag'); try { h.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault();
    });
    panel.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = panel.offsetWidth, hh = panel.offsetHeight;
      var x = Math.min(drag.hw - 40, Math.max(40 - w, e.clientX - drag.hx - drag.dx)), y = Math.max(0, Math.min(drag.hh - hh, e.clientY - drag.hy - drag.dy));
      panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.right = 'auto';
    });
    function endDrag() { if (!drag) return; drag.h.classList.remove('drag'); drag = null; }
    panel.addEventListener('pointerup', endDrag); panel.addEventListener('pointercancel', endDrag);
    gear.addEventListener('click', function () { panel.hidden = !panel.hidden; if (!panel.hidden) render(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) panel.hidden = true; });
    return { render: function () { if (!panel.hidden) render(); }, open: function () { panel.hidden = false; render(); }, panel: panel, gear: gear, schema: SCHEMA };
  }
  global.GardenSettingsUI = { create: create, SCHEMA: SCHEMA, PRESETS: PRESETS };
})(window);
