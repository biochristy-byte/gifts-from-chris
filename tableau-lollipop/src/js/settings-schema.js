/* Lollipop Viz Extension - settings schema.
 *
 * Single source of truth for every option: its default, its control type and
 * the group it belongs to. The settings panel UI is generated from this, and
 * the renderer reads the resolved values. Add an option here and it appears in
 * the panel automatically.
 *
 * Control types:
 *   toggle     boolean on/off
 *   number     numeric stepper (min/max/step/unit). Never a slider.
 *   color      colour swatch + hex field
 *   segmented  2-4 mutually exclusive choices, rendered as a button row
 *   select     longer choice list, rendered as a dropdown
 *   text       free text
 *
 * `when` gates visibility on another option's value, so the panel hides
 * controls that cannot apply.
 */
(function (global) {
  'use strict';

  var FONT_STACKS = [
    { value: 'Tableau Book, Benton Sans, Arial, sans-serif', label: 'Tableau Book' },
    { value: 'Tableau Medium, Benton Sans, Arial, sans-serif', label: 'Tableau Medium' },
    { value: 'Segoe UI, system-ui, sans-serif', label: 'Segoe UI' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: 'Helvetica Neue, Helvetica, Arial, sans-serif', label: 'Helvetica Neue' },
    { value: 'Trebuchet MS, Tahoma, sans-serif', label: 'Trebuchet MS' },
    { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
    { value: 'Tahoma, Verdana, sans-serif', label: 'Tahoma' },
    { value: 'Georgia, Times New Roman, serif', label: 'Georgia' },
    { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
    { value: 'Courier New, Courier, monospace', label: 'Courier New' }
  ];

  var SHAPES = [
    { value: 'circle', label: 'Circle' },
    { value: 'ring', label: 'Ring' },
    { value: 'square', label: 'Square' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'star', label: 'Star' },
    { value: 'hexagon', label: 'Hexagon' }
  ];

  /* Each group renders as a collapsible section in the panel. */
  var GROUPS = [
    {
      id: 'layout',
      label: 'Layout',
      icon: 'grid',
      options: [
        { key: 'orientation', label: 'Orientation', type: 'segmented', def: 'horizontal',
          choices: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }],
          help: 'Horizontal runs sticks left to right, with categories down the side.' },
        { key: 'sort', label: 'Sort', type: 'select', def: 'value-desc',
          choices: [
            { value: 'none', label: 'Data order' },
            { value: 'value-desc', label: 'Value, high to low' },
            { value: 'value-asc', label: 'Value, low to high' },
            { value: 'cat-asc', label: 'Category, A to Z' },
            { value: 'cat-desc', label: 'Category, Z to A' }
          ] },
        { key: 'baseline', label: 'Stick starts at', type: 'segmented', def: 'zero',
          choices: [{ value: 'zero', label: 'Zero' }, { value: 'min', label: 'Minimum' }],
          help: 'Zero is the truthful default. Minimum exaggerates differences.' },
        { key: 'categoryGap', label: 'Category spacing', type: 'number', def: 40, min: 0, max: 90, step: 5, unit: '%' },
        { key: 'padTop', label: 'Padding top', type: 'number', def: 16, min: 0, max: 200, step: 2, unit: 'px' },
        { key: 'padRight', label: 'Padding right', type: 'number', def: 24, min: 0, max: 200, step: 2, unit: 'px' },
        { key: 'padBottom', label: 'Padding bottom', type: 'number', def: 16, min: 0, max: 200, step: 2, unit: 'px' },
        { key: 'padLeft', label: 'Padding left', type: 'number', def: 16, min: 0, max: 200, step: 2, unit: 'px' }
      ]
    },
    {
      id: 'stick',
      label: 'Stick',
      icon: 'line',
      options: [
        { key: 'stickShow', label: 'Show stick', type: 'toggle', def: true },
        { key: 'stickColorMode', label: 'Colour source', type: 'segmented', def: 'fixed',
          choices: [{ value: 'fixed', label: 'Fixed' }, { value: 'matchBall', label: 'Match ball' }],
          when: { key: 'stickShow', is: true } },
        { key: 'stickColor', label: 'Stick colour', type: 'color', def: '#9aa5b1',
          when: { key: 'stickColorMode', is: 'fixed' } },
        { key: 'stickWidth', label: 'Thickness', type: 'number', def: 2, min: 0.5, max: 24, step: 0.5, unit: 'px',
          when: { key: 'stickShow', is: true } },
        { key: 'stickStyle', label: 'Line style', type: 'select', def: 'solid',
          choices: [
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'dotted', label: 'Dotted' },
            { value: 'dashdot', label: 'Dash dot' }
          ],
          when: { key: 'stickShow', is: true } },
        { key: 'stickCap', label: 'End cap', type: 'segmented', def: 'round',
          choices: [{ value: 'butt', label: 'Flat' }, { value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }],
          when: { key: 'stickShow', is: true } },
        { key: 'stickOpacity', label: 'Opacity', type: 'number', def: 100, min: 5, max: 100, step: 5, unit: '%',
          when: { key: 'stickShow', is: true } }
      ]
    },
    {
      id: 'ball',
      label: 'Ball',
      icon: 'dot',
      options: [
        { key: 'ballShow', label: 'Show ball', type: 'toggle', def: true },
        { key: 'ballShape', label: 'Shape', type: 'select', def: 'circle', choices: SHAPES,
          when: { key: 'ballShow', is: true } },
        { key: 'ballColorMode', label: 'Colour source', type: 'segmented', def: 'fixed',
          choices: [
            { value: 'fixed', label: 'Fixed' },
            { value: 'field', label: 'By field' },
            { value: 'scale', label: 'By value' }
          ],
          help: 'By field uses the Colour shelf. By value ramps light to dark across the measure.',
          when: { key: 'ballShow', is: true } },
        { key: 'ballColor', label: 'Ball colour', type: 'color', def: '#d64545',
          when: { key: 'ballColorMode', is: 'fixed' } },
        { key: 'ballPalette', label: 'Palette', type: 'select', def: 'colorblind10',
          choices: [
            { value: 'colorblind10', label: 'Colourblind safe 10' },
            { value: 'tableau10', label: 'Tableau 10' },
            { value: 'muted9', label: 'Muted 9' },
            { value: 'warm8', label: 'Warm 8' },
            { value: 'cool8', label: 'Cool 8' }
          ],
          when: { key: 'ballColorMode', is: 'field' } },
        { key: 'ballRampFrom', label: 'Ramp start', type: 'color', def: '#dbe4ee',
          when: { key: 'ballColorMode', is: 'scale' } },
        { key: 'ballRampTo', label: 'Ramp end', type: 'color', def: '#1f4e79',
          when: { key: 'ballColorMode', is: 'scale' } },
        { key: 'ballSize', label: 'Size', type: 'number', def: 14, min: 2, max: 80, step: 1, unit: 'px',
          when: { key: 'ballSizeByValue', is: false } },
        { key: 'ballSizeByValue', label: 'Size by value', type: 'toggle', def: false,
          when: { key: 'ballShow', is: true } },
        { key: 'ballSizeMin', label: 'Smallest', type: 'number', def: 8, min: 2, max: 60, step: 1, unit: 'px',
          when: { key: 'ballSizeByValue', is: true } },
        { key: 'ballSizeMax', label: 'Largest', type: 'number', def: 28, min: 4, max: 90, step: 1, unit: 'px',
          when: { key: 'ballSizeByValue', is: true } },
        { key: 'ballStrokeWidth', label: 'Border width', type: 'number', def: 0, min: 0, max: 10, step: 0.5, unit: 'px',
          when: { key: 'ballShow', is: true } },
        { key: 'ballStrokeColor', label: 'Border colour', type: 'color', def: '#ffffff',
          when: { key: 'ballShow', is: true } },
        { key: 'ballOpacity', label: 'Opacity', type: 'number', def: 100, min: 5, max: 100, step: 5, unit: '%',
          when: { key: 'ballShow', is: true } },
        { key: 'ballShadow', label: 'Drop shadow', type: 'toggle', def: false,
          when: { key: 'ballShow', is: true } }
      ]
    },
    {
      id: 'label',
      label: 'Ball label',
      icon: 'text',
      options: [
        { key: 'labelShow', label: 'Show label', type: 'toggle', def: true },
        { key: 'labelSource', label: 'Label text', type: 'select', def: 'value',
          choices: [
            { value: 'value', label: 'The measure value' },
            { value: 'category', label: 'The category name' },
            { value: 'field', label: 'The Label shelf field' },
            { value: 'catvalue', label: 'Category and value' }
          ],
          when: { key: 'labelShow', is: true } },
        { key: 'labelPosition', label: 'Position', type: 'select', def: 'outside',
          choices: [
            { value: 'outside', label: 'Past the ball' },
            { value: 'inside', label: 'Inside the ball' },
            { value: 'before', label: 'Before the ball' },
            { value: 'above', label: 'Above the ball' },
            { value: 'below', label: 'Below the ball' }
          ],
          when: { key: 'labelShow', is: true } },
        { key: 'labelFont', label: 'Font', type: 'select', def: FONT_STACKS[0].value, choices: FONT_STACKS,
          when: { key: 'labelShow', is: true } },
        { key: 'labelSize', label: 'Font size', type: 'number', def: 12, min: 6, max: 48, step: 1, unit: 'pt',
          when: { key: 'labelShow', is: true } },
        { key: 'labelWeight', label: 'Weight', type: 'segmented', def: '600',
          choices: [{ value: '400', label: 'Regular' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' }],
          when: { key: 'labelShow', is: true } },
        { key: 'labelColor', label: 'Text colour', type: 'color', def: '#333333',
          when: { key: 'labelShow', is: true } },
        { key: 'labelAutoContrast', label: 'Auto contrast inside ball', type: 'toggle', def: true,
          help: 'Flips label text to white or black so it stays readable on the ball colour.',
          when: { key: 'labelPosition', is: 'inside' } },
        { key: 'labelHalo', label: 'Halo behind text', type: 'toggle', def: false,
          when: { key: 'labelShow', is: true } },
        { key: 'labelHaloColor', label: 'Halo colour', type: 'color', def: '#ffffff',
          when: { key: 'labelHalo', is: true } },
        { key: 'labelOffset', label: 'Gap from ball', type: 'number', def: 8, min: 0, max: 60, step: 1, unit: 'px',
          when: { key: 'labelShow', is: true } }
      ]
    },
    {
      id: 'number',
      label: 'Number format',
      icon: 'hash',
      options: [
        { key: 'numStyle', label: 'Style', type: 'select', def: 'auto',
          choices: [
            { value: 'auto', label: 'Automatic' },
            { value: 'plain', label: 'Plain number' },
            { value: 'compact', label: 'Compact (12.4K)' },
            { value: 'currency', label: 'Currency' },
            { value: 'percent', label: 'Percent' },
            { value: 'scientific', label: 'Scientific' }
          ] },
        { key: 'numDecimals', label: 'Decimal places', type: 'number', def: 0, min: 0, max: 6, step: 1 },
        { key: 'numAutoDecimals', label: 'Choose decimals automatically', type: 'toggle', def: true },
        { key: 'numThousands', label: 'Thousands separator', type: 'toggle', def: true },
        { key: 'numCurrency', label: 'Currency symbol', type: 'text', def: '$',
          when: { key: 'numStyle', is: 'currency' } },
        { key: 'numPrefix', label: 'Prefix', type: 'text', def: '' },
        { key: 'numSuffix', label: 'Suffix', type: 'text', def: '' }
      ]
    },
    {
      id: 'axis',
      label: 'Axes and grid',
      icon: 'axis',
      options: [
        { key: 'catAxisShow', label: 'Show category axis', type: 'toggle', def: true },
        { key: 'valAxisShow', label: 'Show value axis', type: 'toggle', def: true },
        { key: 'axisFont', label: 'Axis font', type: 'select', def: FONT_STACKS[0].value, choices: FONT_STACKS },
        { key: 'axisSize', label: 'Axis font size', type: 'number', def: 11, min: 6, max: 32, step: 1, unit: 'pt' },
        { key: 'axisColor', label: 'Axis text colour', type: 'color', def: '#555555' },
        { key: 'catMaxChars', label: 'Trim category text at', type: 'number', def: 28, min: 4, max: 120, step: 1, unit: 'chars',
          when: { key: 'catAxisShow', is: true } },
        { key: 'axisLineShow', label: 'Show axis line', type: 'toggle', def: true },
        { key: 'axisLineColor', label: 'Axis line colour', type: 'color', def: '#d4d4d4',
          when: { key: 'axisLineShow', is: true } },
        { key: 'gridShow', label: 'Show gridlines', type: 'toggle', def: true },
        { key: 'gridColor', label: 'Gridline colour', type: 'color', def: '#ececec',
          when: { key: 'gridShow', is: true } },
        { key: 'gridStyle', label: 'Gridline style', type: 'segmented', def: 'solid',
          choices: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }],
          when: { key: 'gridShow', is: true } },
        { key: 'gridCount', label: 'Target gridline count', type: 'number', def: 5, min: 2, max: 14, step: 1,
          when: { key: 'gridShow', is: true } },
        { key: 'valAxisTitle', label: 'Value axis title', type: 'text', def: '' },
        { key: 'catAxisTitle', label: 'Category axis title', type: 'text', def: '' }
      ]
    },
    {
      id: 'background',
      label: 'Background and border',
      icon: 'square',
      options: [
        { key: 'bgMode', label: 'Background', type: 'segmented', def: 'inherit',
          choices: [
            { value: 'inherit', label: 'From Tableau' },
            { value: 'fixed', label: 'Pick one' },
            { value: 'transparent', label: 'None' }
          ],
          help: 'From Tableau matches the worksheet background so the extension blends in.' },
        { key: 'bgColor', label: 'Background colour', type: 'color', def: '#ffffff',
          when: { key: 'bgMode', is: 'fixed' } },
        { key: 'borderShow', label: 'Show border', type: 'toggle', def: false },
        { key: 'borderColor', label: 'Border colour', type: 'color', def: '#d4d4d4',
          when: { key: 'borderShow', is: true } },
        { key: 'borderWidth', label: 'Border width', type: 'number', def: 2, min: 0.5, max: 12, step: 0.5, unit: 'px',
          when: { key: 'borderShow', is: true } },
        { key: 'borderRadius', label: 'Corner radius', type: 'number', def: 15, min: 0, max: 60, step: 1, unit: 'px',
          when: { key: 'borderShow', is: true } }
      ]
    },
    {
      id: 'panel',
      label: 'Settings panel',
      icon: 'gear',
      options: [
        { key: 'panelTheme', label: 'Panel theme', type: 'segmented', def: 'light',
          choices: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'match', label: 'Match chart' },
            { value: 'custom', label: 'Pick' }
          ],
          help: 'Match takes the chart background and picks readable text for it.' },
        { key: 'panelBg', label: 'Panel background', type: 'color', def: '#ffffff',
          when: { key: 'panelTheme', is: 'custom' } },
        { key: 'panelText', label: 'Panel text', type: 'color', def: '#1b1f24',
          when: { key: 'panelTheme', is: 'custom' },
          help: 'Borders, labels and the scrollbar are all mixed from this and the background.' },
        { key: 'panelAccent', label: 'Panel accent', type: 'color', def: '#1170aa',
          help: 'Switches that are on, the selected segment, and focus rings.' },
        { key: 'panelSide', label: 'Panel opens from', type: 'segmented', def: 'right',
          choices: [
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' }
          ] },
        { key: 'panelWidth', label: 'Panel width', type: 'number', def: 318, min: 240, max: 560, step: 2, unit: 'px',
          help: 'Capped at 92% of the viz, so a narrow worksheet still shows the chart.' },
        { key: 'panelDim', label: 'Dim chart behind panel', type: 'toggle', def: true },
        { key: 'gearCorner', label: 'Gear corner', type: 'select', def: 'tr',
          choices: [
            { value: 'tr', label: 'Top right' },
            { value: 'tl', label: 'Top left' },
            { value: 'br', label: 'Bottom right' },
            { value: 'bl', label: 'Bottom left' }
          ] },
        { key: 'gearSize', label: 'Gear size', type: 'number', def: 28, min: 18, max: 48, step: 1, unit: 'px' },
        { key: 'gearIdleOpacity', label: 'Gear when not hovered', type: 'number', def: 0.35, min: 0.05, max: 1, step: 0.05,
          help: 'Fades the gear until the pointer is over the viz. It never goes fully invisible, because it is the only way back into these settings.' }
      ]
    },
    {
      id: 'interaction',
      label: 'Interaction',
      icon: 'cursor',
      options: [
        { key: 'selectEnabled', label: 'Click to select marks', type: 'toggle', def: true,
          help: 'Sends the selection back to Tableau so other sheets filter and highlight.' },
        { key: 'tooltipEnabled', label: 'Show Tableau tooltip on hover', type: 'toggle', def: true },
        { key: 'hoverGrow', label: 'Grow ball on hover', type: 'toggle', def: true },
        { key: 'dimUnselected', label: 'Dim unselected marks', type: 'toggle', def: true },
        { key: 'animate', label: 'Animate changes', type: 'toggle', def: true },
        { key: 'animDuration', label: 'Animation length', type: 'number', def: 450, min: 80, max: 1600, step: 50, unit: 'ms',
          when: { key: 'animate', is: true } }
      ]
    }
  ];

  /* Flatten to a key -> option map and a defaults object. */
  var BY_KEY = {};
  var DEFAULTS = {};
  GROUPS.forEach(function (g) {
    g.options.forEach(function (o) {
      o.group = g.id;
      BY_KEY[o.key] = o;
      DEFAULTS[o.key] = o.def;
    });
  });

  /* Coerce a stored string back to the option's real type. Tableau settings
   * persist as strings, so every read has to go through this. */
  function coerce (key, raw) {
    var opt = BY_KEY[key];
    if (!opt) return raw;
    if (raw === undefined || raw === null || raw === '') return opt.def;
    switch (opt.type) {
      case 'toggle':
        return raw === true || raw === 'true';
      case 'number': {
        var n = parseFloat(raw);
        if (!isFinite(n)) return opt.def;
        if (opt.min !== undefined) n = Math.max(opt.min, n);
        if (opt.max !== undefined) n = Math.min(opt.max, n);
        return n;
      }
      case 'color':
        return /^#[0-9a-f]{6}$/i.test(String(raw)) ? String(raw) : opt.def;
      case 'segmented':
      case 'select': {
        var ok = opt.choices.some(function (c) { return c.value === raw; });
        return ok ? raw : opt.def;
      }
      default:
        return String(raw);
    }
  }

  /* Build a full settings object from whatever Tableau has stored. */
  function resolve (stored) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = coerce(k, stored ? stored[k] : undefined);
    });
    return out;
  }

  /* Is this option currently applicable, given the rest of the settings? */
  function isVisible (opt, settings) {
    if (!opt.when) return true;
    return settings[opt.when.key] === opt.when.is;
  }

  global.LP = global.LP || {};
  global.LP.schema = {
    GROUPS: GROUPS,
    BY_KEY: BY_KEY,
    DEFAULTS: DEFAULTS,
    FONT_STACKS: FONT_STACKS,
    coerce: coerce,
    resolve: resolve,
    isVisible: isVisible
  };
})(typeof window !== 'undefined' ? window : globalThis);
