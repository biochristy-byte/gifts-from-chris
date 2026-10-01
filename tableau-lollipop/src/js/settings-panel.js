/* Lollipop Viz Extension - settings panel.
 *
 * A gear button sits at the top right of the extension. Clicking it slides in
 * a panel whose entire contents are generated from settings-schema.js.
 *
 * Deliberately no sliders. Every numeric option is a stepper with typed entry,
 * because chart tuning needs exact values and a slider cannot give you 12.5px
 * reliably. Segmented buttons are used wherever there are four or fewer
 * choices so the current state is readable without opening a menu.
 */
(function (global) {
  'use strict';

  var schema = global.LP.schema;
  var pal = global.LP.palettes;

  function h (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  var ICONS = {
    gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4a7.6 7.6 0 0 1-.1 1.2l2 1.6-1.9 3.3-2.5-1a7.6 7.6 0 0 1-2 1.2l-.4 2.6h-3.8l-.4-2.6a7.6 7.6 0 0 1-2-1.2l-2.5 1L2 14.8l2-1.6a7.6 7.6 0 0 1 0-2.4L2 9.2l1.9-3.3 2.5 1a7.6 7.6 0 0 1 2-1.2l.4-2.6h3.8l.4 2.6c.7.3 1.4.7 2 1.2l2.5-1L21.4 9l-2 1.6c.1.4.1.8.1 1.4z',
    close: 'M6 6l12 12M18 6L6 18',
    reset: 'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'
  };

  function icon (name, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size || 16);
    svg.setAttribute('height', size || 16);
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name]);
    p.setAttribute('fill', name === 'close' ? 'none' : 'currentColor');
    if (name === 'close') {
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round');
    }
    svg.appendChild(p);
    return svg;
  }

  /* ------------------------------------------------------------- controls */

  /* Controls repaint their OWN state on change rather than waiting for the
   * panel to rebuild. The panel only rebuilds when a change can reveal or hide
   * other controls, so without this a switch or a segmented button would keep
   * showing its old value even though the chart had already changed. */
  function buildToggle (opt, value, onChange) {
    var wrap = h('button', 'lp-switch' + (value ? ' on' : ''));
    wrap.type = 'button';
    wrap.setAttribute('role', 'switch');
    wrap.setAttribute('aria-checked', value ? 'true' : 'false');
    wrap.appendChild(h('span', 'lp-switch-knob'));
    var cur = value;
    wrap.addEventListener('click', function () {
      cur = !cur;
      wrap.classList.toggle('on', cur);
      wrap.setAttribute('aria-checked', cur ? 'true' : 'false');
      onChange(cur);
    });
    return wrap;
  }

  function buildNumber (opt, value, onChange) {
    var wrap = h('div', 'lp-stepper');
    var minus = h('button', 'lp-step', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'Decrease ' + opt.label);
    var input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    if (opt.min !== undefined) input.min = opt.min;
    if (opt.max !== undefined) input.max = opt.max;
    input.step = opt.step || 1;
    input.setAttribute('aria-label', opt.label);
    var plus = h('button', 'lp-step', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'Increase ' + opt.label);

    function clampSet (v) {
      var n = parseFloat(v);
      if (!isFinite(n)) n = opt.def;
      if (opt.min !== undefined) n = Math.max(opt.min, n);
      if (opt.max !== undefined) n = Math.min(opt.max, n);
      /* Kill floating point crumbs from repeated 0.5 steps. */
      n = Math.round(n * 1000) / 1000;
      input.value = n;
      onChange(n);
    }
    minus.addEventListener('click', function () { clampSet(parseFloat(input.value) - (opt.step || 1)); });
    plus.addEventListener('click', function () { clampSet(parseFloat(input.value) + (opt.step || 1)); });
    input.addEventListener('change', function () { clampSet(input.value); });

    wrap.appendChild(minus);
    wrap.appendChild(input);
    if (opt.unit) wrap.appendChild(h('span', 'lp-unit', opt.unit));
    wrap.appendChild(plus);
    return wrap;
  }

  function buildColor (opt, value, onChange) {
    var wrap = h('div', 'lp-color');
    var sw = document.createElement('input');
    sw.type = 'color';
    sw.value = value;
    sw.setAttribute('aria-label', opt.label);
    var hex = document.createElement('input');
    hex.type = 'text';
    hex.className = 'lp-hex';
    hex.value = value;
    hex.spellcheck = false;
    hex.setAttribute('aria-label', opt.label + ' hex value');

    sw.addEventListener('input', function () { hex.value = sw.value; onChange(sw.value); });
    hex.addEventListener('change', function () {
      var v = hex.value.trim();
      if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { sw.value = v; hex.value = v; onChange(v); }
      else { hex.value = sw.value; }
    });
    wrap.appendChild(sw);
    wrap.appendChild(hex);
    return wrap;
  }

  function buildSegmented (opt, value, onChange) {
    var wrap = h('div', 'lp-seg');
    wrap.setAttribute('role', 'radiogroup');
    var buttons = [];
    opt.choices.forEach(function (c) {
      var b = h('button', 'lp-seg-btn' + (c.value === value ? ' on' : ''), c.label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', c.value === value ? 'true' : 'false');
      b.addEventListener('click', function () {
        buttons.forEach(function (other) {
          var on = other === b;
          other.classList.toggle('on', on);
          other.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        onChange(c.value);
      });
      buttons.push(b);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function buildSelect (opt, value, onChange) {
    var sel = document.createElement('select');
    sel.className = 'lp-select';
    sel.setAttribute('aria-label', opt.label);
    opt.choices.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.value;
      o.textContent = c.label;
      if (c.value === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }

  function buildText (opt, value, onChange) {
    var i = document.createElement('input');
    i.type = 'text';
    i.className = 'lp-text';
    i.value = value || '';
    i.placeholder = opt.placeholder || '';
    i.setAttribute('aria-label', opt.label);
    i.addEventListener('change', function () { onChange(i.value); });
    return i;
  }

  var BUILDERS = {
    toggle: buildToggle, number: buildNumber, color: buildColor,
    segmented: buildSegmented, select: buildSelect, text: buildText
  };

  /* ---------------------------------------------------------------- panel */

  function Panel (host, opts) {
    this.host = host;
    this.get = opts.get;           /* () => settings object */
    this.set = opts.set;           /* (key, value) => void, triggers redraw */
    this.reset = opts.reset;       /* () => void */
    this.replaceAll = opts.replaceAll; /* (obj) => void */
    this.open = false;
    this.filter = '';
    this.collapsed = {};
    this._build();
  }

  Panel.prototype._build = function () {
    var self = this;

    var gear = h('button', 'lp-gear at-tr');
    gear.type = 'button';
    gear.title = 'Chart settings';
    gear.setAttribute('aria-label', 'Open chart settings');
    gear.appendChild(icon('gear', 17));
    gear.addEventListener('click', function () { self.toggle(); });
    this.gear = gear;

    var scrim = h('div', 'lp-scrim');
    scrim.addEventListener('click', function () { self.toggle(false); });
    this.scrim = scrim;

    var panel = h('aside', 'lp-panel');
    panel.setAttribute('aria-label', 'Chart settings');

    var head = h('div', 'lp-panel-head');
    head.appendChild(h('div', 'lp-panel-title', 'Chart settings'));
    var closeBtn = h('button', 'lp-iconbtn');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.appendChild(icon('close', 15));
    closeBtn.addEventListener('click', function () { self.toggle(false); });
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'lp-search';
    search.placeholder = 'Find a setting';
    search.setAttribute('aria-label', 'Find a setting');
    search.addEventListener('input', function () {
      self.filter = search.value.trim().toLowerCase();
      self.refresh();
    });
    panel.appendChild(search);

    var body = h('div', 'lp-panel-body');
    panel.appendChild(body);
    this.body = body;

    var foot = h('div', 'lp-panel-foot');
    var resetBtn = h('button', 'lp-btn', 'Reset all');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () {
      if (self._confirming) { self.reset(); self._confirming = false; resetBtn.textContent = 'Reset all'; resetBtn.classList.remove('danger'); self.refresh(); }
      else { self._confirming = true; resetBtn.textContent = 'Tap again to confirm'; resetBtn.classList.add('danger');
        setTimeout(function () { self._confirming = false; resetBtn.textContent = 'Reset all'; resetBtn.classList.remove('danger'); }, 3500); }
    });
    var copyBtn = h('button', 'lp-btn', 'Copy settings');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      var json = JSON.stringify(self.get(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
          copyBtn.textContent = 'Copied';
          setTimeout(function () { copyBtn.textContent = 'Copy settings'; }, 1600);
        }, function () { self._fallbackCopy(json, copyBtn); });
      } else self._fallbackCopy(json, copyBtn);
    });
    var pasteBtn = h('button', 'lp-btn', 'Paste settings');
    pasteBtn.type = 'button';
    pasteBtn.addEventListener('click', function () {
      var raw = global.prompt('Paste a settings JSON block to apply it.');
      if (!raw) return;
      try {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') { self.replaceAll(obj); self.refresh(); }
      } catch (e) {
        pasteBtn.textContent = 'Not valid JSON';
        setTimeout(function () { pasteBtn.textContent = 'Paste settings'; }, 2000);
      }
    });
    foot.appendChild(resetBtn);
    foot.appendChild(copyBtn);
    foot.appendChild(pasteBtn);
    panel.appendChild(foot);

    this.panel = panel;
    this.host.appendChild(gear);
    this.host.appendChild(scrim);
    this.host.appendChild(panel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.open) self.toggle(false);
    });

    this.refresh();
  };

  Panel.prototype._fallbackCopy = function (text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); btn.textContent = 'Copied'; }
    catch (e) { btn.textContent = 'Copy failed'; }
    document.body.removeChild(ta);
    setTimeout(function () { btn.textContent = 'Copy settings'; }, 1600);
  };

  /* Paint the panel's own appearance: theme colours as CSS custom properties,
   * plus the handful of things that are geometry rather than colour.
   *
   * Called on every redraw, not only when the panel is open, because the gear
   * has a size, a corner and an idle opacity of its own. The variables go on
   * the host element rather than :root so the extension never reaches outside
   * its own subtree, and so the stylesheet's own :root block stays the
   * fallback if this is somehow never called.
   *
   * `chartBg` is the background the renderer actually resolved, which is what
   * "Match chart" has to match. Passing it in keeps the renderer and the panel
   * from each guessing at it separately and disagreeing.
   */
  Panel.prototype.applyAppearance = function (s, chartBg) {
    var host = this.host;
    var vars = pal.panelVars(s, chartBg);
    Object.keys(vars).forEach(function (k) { host.style.setProperty(k, vars[k]); });

    host.style.setProperty('--lp-panel-w', (s.panelWidth || 318) + 'px');
    host.style.setProperty('--lp-gear-size', (s.gearSize || 28) + 'px');
    host.style.setProperty('--lp-gear-idle', String(s.gearIdleOpacity === undefined ? 0.35 : s.gearIdleOpacity));

    this.panel.classList.toggle('side-left', s.panelSide === 'left');
    this.scrim.classList.toggle('no-dim', s.panelDim === false);

    var corner = s.gearCorner || 'tr';
    ['tr', 'tl', 'br', 'bl'].forEach(function (c) {
      this.gear.classList.toggle('at-' + c, c === corner);
    }, this);
  };

  Panel.prototype.toggle = function (force) {
    this.open = force === undefined ? !this.open : !!force;
    this.panel.classList.toggle('open', this.open);
    this.scrim.classList.toggle('open', this.open);
    this.gear.classList.toggle('active', this.open);
    this.gear.setAttribute('aria-label', this.open ? 'Close chart settings' : 'Open chart settings');
    if (this.open) this.refresh();
  };

  Panel.prototype.refresh = function () {
    var self = this;
    var s = this.get();
    var body = this.body;
    var scrollTop = body.scrollTop;
    body.innerHTML = '';
    var shown = 0;

    schema.GROUPS.forEach(function (grp) {
      var visible = grp.options.filter(function (o) {
        if (!schema.isVisible(o, s)) return false;
        if (!self.filter) return true;
        return (o.label + ' ' + grp.label + ' ' + (o.help || '')).toLowerCase().indexOf(self.filter) >= 0;
      });
      if (!visible.length) return;
      shown += visible.length;

      var sec = h('section', 'lp-group');
      var isCollapsed = !!self.collapsed[grp.id] && !self.filter;
      var head = h('button', 'lp-group-head' + (isCollapsed ? ' collapsed' : ''));
      head.type = 'button';
      head.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      head.appendChild(h('span', 'lp-group-name', grp.label));
      head.appendChild(h('span', 'lp-group-caret', '›'));
      head.addEventListener('click', function () {
        self.collapsed[grp.id] = !self.collapsed[grp.id];
        self.refresh();
      });
      sec.appendChild(head);

      if (!isCollapsed) {
        var list = h('div', 'lp-group-body');
        visible.forEach(function (opt) {
          var row = h('div', 'lp-row' + (opt.type === 'toggle' ? ' inline' : ''));
          var lab = h('label', 'lp-row-label', opt.label);
          row.appendChild(lab);
          var ctrl = BUILDERS[opt.type](opt, s[opt.key], function (v) {
            self.set(opt.key, v);
            /* Re-render the panel only when the change can reveal or hide
             * other controls, so typing in a text field does not fight focus. */
            var gates = schema.GROUPS.some(function (g2) {
              return g2.options.some(function (o2) { return o2.when && o2.when.key === opt.key; });
            });
            if (gates) self.refresh();
          });
          ctrl.classList.add('lp-ctrl');
          row.appendChild(ctrl);
          if (opt.help) row.appendChild(h('div', 'lp-help', opt.help));
          list.appendChild(row);
        });
        sec.appendChild(list);
      }
      body.appendChild(sec);
    });

    if (!shown) body.appendChild(h('div', 'lp-empty-search', 'No setting matches "' + this.filter + '".'));
    body.scrollTop = scrollTop;
  };

  global.LP = global.LP || {};
  global.LP.Panel = Panel;
})(typeof window !== 'undefined' ? window : globalThis);
