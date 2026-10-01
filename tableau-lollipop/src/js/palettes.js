/* Lollipop Viz Extension - colour palettes and colour maths.
 *
 * Categorical palettes are colourblind-conscious by default. The ramp helpers
 * interpolate in linear-light sRGB rather than naively in gamma space, so a
 * light-to-dark ramp does not go muddy through the middle.
 */
(function (global) {
  'use strict';

  var PALETTES = {
    /* Tableau's colour blind safe ten. */
    colorblind10: ['#1170aa', '#fc7d0b', '#a3acb9', '#57606c', '#5fa2ce',
      '#c85200', '#7b848f', '#a3cce9', '#ffbc79', '#c8d0d9'],
    tableau10: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
      '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
    muted9: ['#4c78a8', '#f58518', '#e45756', '#72b7b2', '#54a24b',
      '#eeca3b', '#b279a2', '#ff9da6', '#9d755d'],
    warm8: ['#7f1d1d', '#b91c1c', '#dc2626', '#ea580c', '#f97316',
      '#f59e0b', '#d97706', '#92400e'],
    cool8: ['#0c4a6e', '#075985', '#0369a1', '#0284c7', '#0ea5e9',
      '#38bdf8', '#7dd3fc', '#155e75']
  };

  function clamp (n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  function hexToRgb (hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex (r, g, b) {
    var f = function (v) {
      var s = Math.round(clamp(v, 0, 255)).toString(16);
      return s.length === 1 ? '0' + s : s;
    };
    return '#' + f(r) + f(g) + f(b);
  }

  /* sRGB 0-255 to linear-light 0-1 and back. */
  function toLinear (c) {
    var v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function fromLinear (v) {
    var c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return c * 255;
  }

  /* Interpolate two hex colours at t in [0,1], in linear light. */
  function mix (fromHex, toHex, t) {
    t = clamp(t, 0, 1);
    var a = hexToRgb(fromHex), b = hexToRgb(toHex);
    var r = fromLinear(toLinear(a.r) + (toLinear(b.r) - toLinear(a.r)) * t);
    var g = fromLinear(toLinear(a.g) + (toLinear(b.g) - toLinear(a.g)) * t);
    var bl = fromLinear(toLinear(a.b) + (toLinear(b.b) - toLinear(a.b)) * t);
    return rgbToHex(r, g, bl);
  }

  /* WCAG relative luminance. */
  function luminance (hex) {
    var c = hexToRgb(hex);
    return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
  }

  /* Contrast ratio between two colours, 1 to 21. */
  function contrast (a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Pick black or white text for the strongest contrast on `bg`. */
  function readableOn (bg) {
    return contrast(bg, '#ffffff') >= contrast(bg, '#000000') ? '#ffffff' : '#000000';
  }

  /* Stable categorical assignment: same key always gets the same colour for a
   * given ordered key list, so re-sorting the chart does not reshuffle hues. */
  function categorical (paletteName, keys) {
    var pal = PALETTES[paletteName] || PALETTES.colorblind10;
    var map = {};
    keys.forEach(function (k, i) { map[k] = pal[i % pal.length]; });
    return map;
  }

  function darken (hex, amount) { return mix(hex, '#000000', amount); }
  function lighten (hex, amount) { return mix(hex, '#ffffff', amount); }

  /* ------------------------------------------------- settings panel theme */

  function isHex (v) { return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '')); }
  function hex (v, fallback) { return isHex(v) ? String(v) : fallback; }

  /* Hex plus an alpha, for the two places that genuinely need translucency:
   * the idle gear sitting over the chart, and the scrim behind the panel. */
  function rgba (hexStr, a) {
    var c = hexToRgb(hexStr);
    return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')';
  }

  /* Fade `ink` toward `surface` until the contrast ratio lands on `target`.
   *
   * A fixed mix cannot do this job. `mix` interpolates in linear light, which
   * is right for a colour ramp and badly wrong for grey text: a 38% mix of
   * near-black into white lands at 2.4:1, well under the 4.5:1 a reader needs.
   * Solving for the ratio instead means secondary text is legible on white, on
   * navy, and on whatever a workbook's background happens to be.
   *
   * Contrast falls monotonically as t goes 0 to 1, so a bisection is exact
   * enough in 24 steps and cannot get stuck. If there is no room to fade, the
   * original colour is returned rather than something unreadable.
   */
  function fadeToContrast (ink, surface, target) {
    if (contrast(ink, surface) <= target) return ink;
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var t = (lo + hi) / 2;
      if (contrast(mix(ink, surface, t), surface) > target) lo = t;
      else hi = t;
    }
    return mix(ink, surface, lo);
  }

  var PANEL_PRESETS = {
    light: { surface: '#ffffff', ink: '#1b1f24' },
    dark: { surface: '#20262e', ink: '#eef1f5' }
  };

  /* Every colour in the settings panel, derived from one surface and one ink.
   *
   * Returned as a map of CSS custom property name to value, so applying a
   * theme is a loop of setProperty and nothing else knows the maths. Pure, so
   * the headless tests can check contrast without a browser.
   *
   *   light / dark    fixed presets
   *   match           takes the chart background, picks readable ink for it
   *   custom          both colours come from the settings
   *
   * The two derived greys (soft ink, hairline) are mixes of ink into surface
   * rather than fixed greys, which is what keeps the panel legible on a dark
   * navy or a warm cream instead of only on white.
   */
  function panelVars (s, chartBg) {
    var theme = (s && s.panelTheme) || 'light';
    var surface, ink;

    if (theme === 'custom') {
      surface = hex(s.panelBg, '#ffffff');
      /* An explicitly picked text colour is honoured as picked. */
      ink = hex(s.panelText, readableOn(surface));
    } else if (theme === 'match') {
      surface = hex(chartBg, '#ffffff');
      /* Nobody chose this pair, so it has to be readable by construction.
       * Pure black or white on a light or dark surface is harsh, so step it
       * back 8% toward the surface, but only while that still clears WCAG AA
       * for body text. On a mid tone there is no contrast to spare, so the
       * pure colour is kept and legibility beats softness. */
      var pure = readableOn(surface);
      var softened = mix(pure, surface, 0.08);
      ink = contrast(softened, surface) >= 4.5 ? softened : pure;
    } else {
      var preset = PANEL_PRESETS[theme] || PANEL_PRESETS.light;
      surface = preset.surface;
      ink = preset.ink;
    }

    /* What decides the chrome is which way the ink runs, not how dark the
     * surface is. A mid grey reads as "dark" by luminance but takes black
     * text, and treating it as dark lifted the second surface toward the
     * ink, which quietly cost the derived greys a point of contrast. */
    var inkIsLight = luminance(ink) > luminance(surface);
    var surfaceIsDark = luminance(surface) < 0.35;
    var accent = hex(s && s.panelAccent, '#1170aa');

    /* Group headers and the footer sit on surface-2, which is always a step
     * toward the ink. That makes it the harder background of the two, so the
     * greys are solved against it rather than against the panel surface.
     * Solved against the surface instead, secondary text measured 4.37 on a
     * group header: under the floor, on the row a reader looks at most. */
    var surface2 = inkIsLight ? lighten(surface, 0.07) : darken(surface, 0.035);

    return {
      '--lp-surface': surface,
      '--lp-surface-2': surface2,
      '--lp-surface-3': inkIsLight ? lighten(surface, 0.14) : darken(surface, 0.08),
      '--lp-field': inkIsLight ? lighten(surface, 0.04) : '#ffffff',
      '--lp-ink': ink,
      /* Each of these is a contrast target, not a mix amount:
       *   4.8  secondary text, just over the 4.5 floor for body text
       *   2.2  scrollbar thumb and an off switch, easy to see furniture
       *   1.35 hairline rules, present but not loud */
      '--lp-ink-soft': fadeToContrast(ink, surface2, 4.8),
      '--lp-line': fadeToContrast(ink, surface2, 1.35),
      '--lp-thumb': fadeToContrast(ink, surface2, 2.2),
      '--lp-switch-off': fadeToContrast(ink, surface2, 2.0),
      '--lp-knob': inkIsLight ? '#e8ecf1' : '#ffffff',
      '--lp-accent': accent,
      '--lp-accent-ink': readableOn(accent),
      /* Whichever red is easier to read on this particular surface. */
      '--lp-danger': contrast('#ff7a6b', surface) > contrast('#c0392b', surface)
        ? '#ff7a6b' : '#c0392b',
      '--lp-gear-bg': rgba(surface, 0.72),
      '--lp-scrim': rgba(surfaceIsDark ? '#000000' : '#14181e', surfaceIsDark ? 0.34 : 0.12),
      '--lp-shadow': surfaceIsDark
        ? '0 6px 26px rgba(0, 0, 0, 0.45)'
        : '0 6px 24px rgba(16, 22, 30, 0.18)'
    };
  }

  global.LP = global.LP || {};
  global.LP.palettes = {
    PALETTES: PALETTES,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    mix: mix,
    luminance: luminance,
    contrast: contrast,
    readableOn: readableOn,
    categorical: categorical,
    darken: darken,
    lighten: lighten,
    rgba: rgba,
    fadeToContrast: fadeToContrast,
    PANEL_PRESETS: PANEL_PRESETS,
    panelVars: panelVars
  };
})(typeof window !== 'undefined' ? window : globalThis);
