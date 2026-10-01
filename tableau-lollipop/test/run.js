/* Headless tests for the parts that do not need a DOM: number formatting,
 * axis tick selection, colour maths, and settings coercion.
 *
 * Settings coercion matters more than it looks. Tableau persists every setting
 * as a string, so "14" must come back as the number 14 and "false" as the
 * boolean false. Getting that wrong produces a chart that is correct on first
 * draw and wrong after a workbook reopen, which is the worst kind of bug.
 *
 * Run: npm test
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'js');
const sandbox = { console, window: undefined };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['settings-schema.js', 'palettes.js', 'format.js']) {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
}
const { schema, palettes, format } = sandbox.LP;

let pass = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) pass++;
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`);
}
function near(name, actual, expected, tol) {
  if (Math.abs(actual - expected) <= (tol === undefined ? 1e-9 : tol)) pass++;
  else failures.push(`${name}\n    expected ~${expected}\n    actual    ${actual}`);
}
function ok(name, cond, detail) {
  if (cond) pass++;
  else failures.push(`${name}${detail ? '\n    ' + detail : ''}`);
}

/* ------------------------------------------------------------ formatting */

const base = schema.resolve({});
const plain = Object.assign({}, base, { numStyle: 'plain', numAutoDecimals: false, numDecimals: 0 });

check('plain integer with separator', format.number(1234567, plain), '1,234,567');
check('plain respects decimals', format.number(12.3456, Object.assign({}, plain, { numDecimals: 2 })), '12.35');
check('separator can be switched off',
  format.number(1234567, Object.assign({}, plain, { numThousands: false })), '1234567');
check('negative keeps its sign', format.number(-4820, plain), '-4,820');
check('zero renders as zero', format.number(0, plain), '0');

const compact = Object.assign({}, base, { numStyle: 'compact', numAutoDecimals: true });
check('compact thousands', format.number(84210, compact), '84.2K');
check('compact millions', format.number(4830000, compact), '4.8M');
check('compact billions', format.number(2.4e9, compact), '2.4B');
check('compact drops a trailing zero', format.number(500000, compact), '500K');
check('compact leaves small numbers alone', format.number(840, compact), '840');

const cur = Object.assign({}, base, { numStyle: 'currency', numAutoDecimals: false, numDecimals: 2, numCurrency: '$' });
check('currency positive', format.number(1234.5, cur), '$1,234.50');
check('currency negative puts the sign first', format.number(-99.25, cur), '-$99.25');

const pct = Object.assign({}, base, { numStyle: 'percent', numAutoDecimals: false, numDecimals: 1 });
check('percent scales by 100', format.number(0.942, pct), '94.2%');

const affix = Object.assign({}, plain, { numPrefix: '~', numSuffix: ' beds' });
check('prefix and suffix wrap the number', format.number(120, affix), '~120 beds');

check('auto switches to compact above ten thousand',
  format.number(84210, Object.assign({}, base, { numStyle: 'auto' })), '84.2K');
check('auto stays plain below ten thousand',
  format.number(9999, Object.assign({}, base, { numStyle: 'auto', numAutoDecimals: false, numDecimals: 0 })), '9,999');

check('non numeric yields empty string', format.number(null, plain), '');
check('NaN yields empty string', format.number(NaN, plain), '');
check('Infinity yields empty string', format.number(Infinity, plain), '');

/* ------------------------------------------------------------ axis ticks */

let t = format.ticks(0, 100, 5);
check('ticks cover a clean range', [t.min, t.max], [0, 100]);
ok('ticks land on round steps', t.ticks.every(v => Math.abs(v % t.step) < 1e-9), JSON.stringify(t.ticks));

t = format.ticks(0, 84210, 5);
ok('ticks span the data maximum', t.max >= 84210, `max=${t.max}`);
ok('tick count stays sensible', t.ticks.length >= 3 && t.ticks.length <= 14, `n=${t.ticks.length}`);

t = format.ticks(-3980, 5310, 5);
ok('negative domain includes zero', t.ticks.some(v => v === 0), JSON.stringify(t.ticks));
ok('negative domain reaches the minimum', t.min <= -3980, `min=${t.min}`);

t = format.ticks(42, 42, 5);
ok('a flat domain still produces a usable range', t.max > t.min, `${t.min}..${t.max}`);

t = format.ticks(0, 0, 5);
ok('an all-zero domain does not hang or collapse', t.max > t.min && t.ticks.length >= 2, JSON.stringify(t));

t = format.ticks(0.796, 0.942, 5);
ok('small decimal domain gets fine steps', t.step <= 0.05, `step=${t.step}`);

ok('ticks never run away', format.ticks(0, 1e12, 5).ticks.length < 100);

/* ------------------------------------------------------------- trimming */

check('short text is untouched', format.trim('Emergency', 28), 'Emergency');
check('long text gets an ellipsis', format.trim('Department of Cardiothoracic and Vascular Surgery', 20),
  'Department of Cardi…');
check('null becomes empty', format.trim(null, 10), '');

/* --------------------------------------------------------------- colour */

check('mix at zero returns the start', palettes.mix('#000000', '#ffffff', 0), '#000000');
check('mix at one returns the end', palettes.mix('#000000', '#ffffff', 1), '#ffffff');
ok('mix clamps past the ends', palettes.mix('#000000', '#ffffff', 5) === '#ffffff');
near('white luminance is one', palettes.luminance('#ffffff'), 1, 1e-6);
near('black luminance is zero', palettes.luminance('#000000'), 0, 1e-6);
near('black on white is the maximum contrast', palettes.contrast('#000000', '#ffffff'), 21, 0.01);
check('dark background takes white text', palettes.readableOn('#1f4e79'), '#ffffff');
check('light background takes black text', palettes.readableOn('#dbe4ee'), '#000000');
ok('auto contrast always clears the WCAG body threshold', (function () {
  return Object.keys(palettes.PALETTES).every(p =>
    palettes.PALETTES[p].every(c => palettes.contrast(c, palettes.readableOn(c)) >= 4.5));
})(), 'a palette colour has no readable text colour at 4.5:1');

const cm = palettes.categorical('colorblind10', ['a', 'b', 'c']);
check('categorical assigns in palette order', [cm.a, cm.b, cm.c],
  ['#1170aa', '#fc7d0b', '#a3acb9']);
ok('categorical wraps past the palette length', (function () {
  const keys = Array.from({ length: 13 }, (_, i) => 'k' + i);
  const m = palettes.categorical('colorblind10', keys);
  return m.k0 === m.k10;
})());

/* ------------------------------------------------------ settings coercion */

check('a stored numeric string becomes a number', schema.coerce('ballSize', '14'), 14);
check('a stored true becomes a boolean', schema.coerce('ballShow', 'true'), true);
check('a stored false becomes a boolean', schema.coerce('ballShow', 'false'), false);
ok('false is not truthy after a round trip', schema.coerce('stickShow', 'false') === false);
check('an out of range number is clamped high', schema.coerce('ballSize', '9999'), 80);
check('an out of range number is clamped low', schema.coerce('ballSize', '-5'), 2);
check('garbage falls back to the default', schema.coerce('ballSize', 'wat'), schema.DEFAULTS.ballSize);
check('a bad colour falls back', schema.coerce('ballColor', 'red'), schema.DEFAULTS.ballColor);
check('a good colour survives', schema.coerce('ballColor', '#12ab34'), '#12ab34');
check('an unknown choice falls back', schema.coerce('orientation', 'sideways'), 'horizontal');
check('a known choice survives', schema.coerce('orientation', 'vertical'), 'vertical');
check('an empty value falls back to the default', schema.coerce('labelSize', ''), schema.DEFAULTS.labelSize);

const resolved = schema.resolve({ ballSize: '22', ballShow: 'false' });
check('resolve applies stored values', [resolved.ballSize, resolved.ballShow], [22, false]);
ok('resolve fills every declared key',
  Object.keys(schema.DEFAULTS).every(k => resolved[k] !== undefined));
ok('resolve of nothing equals the defaults',
  JSON.stringify(schema.resolve({})) === JSON.stringify(schema.DEFAULTS));

/* --------------------------------------------------------- schema health */

const allKeys = Object.keys(schema.DEFAULTS);
ok('every option has a unique key', allKeys.length === new Set(allKeys).size);
ok('every option declares a default', allKeys.every(k => schema.DEFAULTS[k] !== undefined));
ok('every gate points at a real option', (function () {
  return schema.GROUPS.every(g => g.options.every(o => !o.when || schema.BY_KEY[o.when.key] !== undefined));
})(), 'a `when` clause names an option that does not exist');
ok('every gate tests a reachable value', (function () {
  return schema.GROUPS.every(g => g.options.every(o => {
    if (!o.when) return true;
    const target = schema.BY_KEY[o.when.key];
    if (target.type === 'toggle') return typeof o.when.is === 'boolean';
    if (target.choices) return target.choices.some(c => c.value === o.when.is);
    return true;
  }));
})(), 'a `when` clause tests a value the target option can never hold');
ok('every choice option defaults to one of its own choices', (function () {
  return schema.GROUPS.every(g => g.options.every(o =>
    !o.choices || o.choices.some(c => c.value === o.def)));
})());
ok('every number option has a default inside its own bounds', (function () {
  return schema.GROUPS.every(g => g.options.every(o =>
    o.type !== 'number' || (o.def >= o.min && o.def <= o.max)));
})());
ok('every colour default is a six digit hex', (function () {
  return schema.GROUPS.every(g => g.options.every(o =>
    o.type !== 'color' || /^#[0-9a-f]{6}$/i.test(o.def)));
})());
ok('the panel exposes a usable number of options', allKeys.length >= 50, `${allKeys.length} options`);

/* ------------------------------------------------- settings panel theming */

/* The panel's own colours are derived, not hardcoded, so the thing worth
 * testing is that every derivation stays readable. A settings panel you
 * cannot read is worse than one that is the wrong colour. */

const THEME_KEYS = ['--lp-surface', '--lp-surface-2', '--lp-surface-3', '--lp-field',
  '--lp-ink', '--lp-ink-soft', '--lp-line', '--lp-thumb', '--lp-switch-off',
  '--lp-knob', '--lp-accent', '--lp-accent-ink', '--lp-danger', '--lp-gear-bg',
  '--lp-scrim', '--lp-shadow'];

const lightVars = palettes.panelVars(base, '#ffffff');
ok('panel theme returns every variable the stylesheet uses',
  THEME_KEYS.every(k => lightVars[k] !== undefined),
  THEME_KEYS.filter(k => lightVars[k] === undefined).join(', '));
check('default panel theme is the light surface', lightVars['--lp-surface'], '#ffffff');
check('default panel accent is the Tableau blue', lightVars['--lp-accent'], '#1170aa');
check('white accent text on the default accent', lightVars['--lp-accent-ink'], '#ffffff');

const darkVars = palettes.panelVars(Object.assign({}, base, { panelTheme: 'dark' }), '#ffffff');
ok('dark theme darkens the surface',
  palettes.luminance(darkVars['--lp-surface']) < 0.1, darkVars['--lp-surface']);
ok('dark theme text is readable on it',
  palettes.contrast(darkVars['--lp-ink'], darkVars['--lp-surface']) >= 7,
  `contrast ${palettes.contrast(darkVars['--lp-ink'], darkVars['--lp-surface']).toFixed(2)}`);
ok('dark theme lifts its own fields above the surface',
  palettes.luminance(darkVars['--lp-field']) > palettes.luminance(darkVars['--lp-surface']));
ok('dark theme brightens the danger colour',
  palettes.luminance(darkVars['--lp-danger']) > palettes.luminance(lightVars['--lp-danger']));

/* Match mode has to work on a background nobody vetted, which is the case
 * that actually breaks: a mid grey is the worst input for naive maths. */
['#ffffff', '#000000', '#7f7f7f', '#1f3864', '#fff4d6', '#0b3b2e', '#e8e8e8'].forEach(bg => {
  const v = palettes.panelVars(Object.assign({}, base, { panelTheme: 'match' }), bg);
  check(`match mode adopts ${bg}`, v['--lp-surface'], bg);
  ok(`match mode stays readable on ${bg}`,
    palettes.contrast(v['--lp-ink'], v['--lp-surface']) >= 4.5,
    `contrast ${palettes.contrast(v['--lp-ink'], v['--lp-surface']).toFixed(2)}`);
  ok(`match mode keeps a visible hairline on ${bg}`,
    palettes.contrast(v['--lp-line'], v['--lp-surface']) > 1.08,
    `contrast ${palettes.contrast(v['--lp-line'], v['--lp-surface']).toFixed(3)}`);
  ok(`match mode keeps soft text weaker than full text on ${bg}`,
    palettes.contrast(v['--lp-ink-soft'], v['--lp-surface'])
      < palettes.contrast(v['--lp-ink'], v['--lp-surface']));
});

/* Secondary text is the one that silently fails. A fixed mix of near-black
 * into white lands at 2.4:1, so every theme is checked against the 4.5:1 floor
 * for body text rather than against a mix amount. */
[['light', '#ffffff'], ['dark', '#ffffff'], ['match', '#ffffff'], ['match', '#000000'],
 ['match', '#7f7f7f'], ['match', '#1f3864'], ['match', '#fff4d6']].forEach(([theme, bg]) => {
  const v = palettes.panelVars(Object.assign({}, base, { panelTheme: theme }), bg);
  /* Checked on both surfaces, because help text and group headers sit on the
   * second one and that is the harder of the two. */
  ok(`secondary text clears AA in ${theme} on ${bg}`,
    palettes.contrast(v['--lp-ink-soft'], v['--lp-surface']) >= 4.5,
    `contrast ${palettes.contrast(v['--lp-ink-soft'], v['--lp-surface']).toFixed(2)}`);
  ok(`secondary text clears AA on the group header in ${theme} on ${bg}`,
    palettes.contrast(v['--lp-ink-soft'], v['--lp-surface-2']) >= 4.5,
    `contrast ${palettes.contrast(v['--lp-ink-soft'], v['--lp-surface-2']).toFixed(2)}`);
  ok(`the scrollbar thumb is visible in ${theme} on ${bg}`,
    palettes.contrast(v['--lp-thumb'], v['--lp-surface']) >= 1.9);
  ok(`hairlines stay quieter than text in ${theme} on ${bg}`,
    palettes.contrast(v['--lp-line'], v['--lp-surface'])
      < palettes.contrast(v['--lp-ink-soft'], v['--lp-surface']));
});
/* The result is quantised to 8 bit hex, so it lands on the first step at or
 * above the target and never below it. Erring upward is the safe direction. */
ok('fading lands just above its target, never under', (function () {
  const c = palettes.contrast(palettes.fadeToContrast('#000000', '#ffffff', 4.8), '#ffffff');
  return c >= 4.8 && c < 4.9;
})());
check('fading returns the colour untouched when there is no room to fade',
  palettes.fadeToContrast('#777777', '#808080', 4.8), '#777777');

const custom = palettes.panelVars(Object.assign({}, base, {
  panelTheme: 'custom', panelBg: '#2b1b3d', panelText: '#ffd9a0', panelAccent: '#ffcc00'
}), '#ffffff');
check('custom background is used verbatim', custom['--lp-surface'], '#2b1b3d');
check('custom text colour is honoured exactly', custom['--lp-ink'], '#ffd9a0');
check('a light accent takes dark text', custom['--lp-accent-ink'], '#000000');
ok('custom mode still derives a hairline between the two',
  custom['--lp-line'] !== custom['--lp-surface'] && custom['--lp-line'] !== custom['--lp-ink']);

/* Nothing the user can type should be able to produce an invalid colour. */
const junk = palettes.panelVars({
  panelTheme: 'custom', panelBg: 'red', panelText: '', panelAccent: 'rgb(1,2,3)'
}, null);
check('a non-hex background falls back to white', junk['--lp-surface'], '#ffffff');
check('a missing text colour is chosen for contrast', junk['--lp-ink'], '#000000');
check('a non-hex accent falls back to the default', junk['--lp-accent'], '#1170aa');
const unknown = palettes.panelVars({ panelTheme: 'nonsense' }, null);
check('an unknown theme name degrades to light', unknown['--lp-surface'], '#ffffff');
ok('every emitted colour is a colour CSS can parse', (function () {
  const cases = [lightVars, darkVars, custom, junk, unknown];
  return cases.every(v => THEME_KEYS.filter(k => k !== '--lp-shadow').every(k =>
    /^#[0-9a-f]{6}$/i.test(v[k]) || /^rgba\(\d+, \d+, \d+, [\d.]+\)$/.test(v[k])));
})());

check('opacity coerces off a stored string', schema.coerce('gearIdleOpacity', '0.35'), 0.35);
check('an out of range opacity is clamped', schema.coerce('gearIdleOpacity', '4'), 1);
check('panel width coerces off a stored string', schema.coerce('panelWidth', '420'), 420);
check('an unknown gear corner falls back', schema.coerce('gearCorner', 'middle'), 'tr');
check('a stored panel theme survives the round trip', schema.coerce('panelTheme', 'match'), 'match');
ok('the panel background only shows in custom mode',
  !schema.isVisible(schema.BY_KEY.panelBg, base)
  && schema.isVisible(schema.BY_KEY.panelBg, Object.assign({}, base, { panelTheme: 'custom' })));

/* ------------------------------------------------------------------ done */

const total = pass + failures.length;
if (failures.length) {
  console.error(`\nFAIL  ${failures.length} of ${total}\n`);
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  process.exit(1);
}
console.log(`\nPASS  ${pass} of ${total} assertions\n`);
console.log(`  settings options: ${allKeys.length} across ${schema.GROUPS.length} groups`);
