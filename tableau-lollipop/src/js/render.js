/* Lollipop Viz Extension - SVG renderer.
 *
 * Draws a lollipop chart: a thin stick from the baseline to the value, capped
 * by a shaped "ball" that can carry a label.
 *
 * Animation is done with requestAnimationFrame tweening rather than CSS
 * transitions, because CSS cannot transition SVG geometry attributes (x2, cy,
 * d) in every engine. Tweening positions ourselves guarantees a smooth move on
 * every frame instead of a snap in some browsers and a glide in others.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var fmt = global.LP.format;
  var pal = global.LP.palettes;

  function el (name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* Accurate text width via a shared 2D context. Reused, never re-created. */
  var _ctx = null;
  function measure (text, font, sizePt) {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    _ctx.font = '' + sizePt + 'px ' + font;
    return _ctx.measureText(String(text === null || text === undefined ? '' : text)).width;
  }

  function dashArray (style, w) {
    switch (style) {
      case 'dashed': return (w * 3) + ',' + (w * 2.5);
      case 'dotted': return (w * 0.1) + ',' + (w * 2);
      case 'dashdot': return (w * 3) + ',' + (w * 2) + ',' + (w * 0.1) + ',' + (w * 2);
      default: return null;
    }
  }

  /* Build a mark shape centred on the origin. `size` is the full diameter. */
  function shapeNode (kind, size, fill, stroke, strokeW) {
    var r = size / 2;
    var node;
    switch (kind) {
      case 'square':
        node = el('rect', { x: -r, y: -r, width: size, height: size });
        break;
      case 'diamond':
        node = el('polygon', { points: [0, -r, r, 0, 0, r, -r, 0].join(' ') });
        break;
      case 'triangle': {
        var h = r * 1.15;
        node = el('polygon', { points: [0, -h, r, h * 0.72, -r, h * 0.72].join(' ') });
        break;
      }
      case 'hexagon': {
        var pts = [];
        for (var i = 0; i < 6; i++) {
          var a = Math.PI / 180 * (60 * i - 30);
          pts.push((r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2));
        }
        node = el('polygon', { points: pts.join(' ') });
        break;
      }
      case 'star': {
        var sp = [];
        for (var j = 0; j < 10; j++) {
          var rad = j % 2 === 0 ? r : r * 0.45;
          var ang = Math.PI / 180 * (36 * j - 90);
          sp.push((rad * Math.cos(ang)).toFixed(2), (rad * Math.sin(ang)).toFixed(2));
        }
        node = el('polygon', { points: sp.join(' ') });
        break;
      }
      case 'ring':
        node = el('circle', { r: Math.max(0.5, r - Math.max(1.5, size * 0.18) / 2) });
        node.setAttribute('fill', 'none');
        node.setAttribute('stroke', fill);
        node.setAttribute('stroke-width', Math.max(1.5, size * 0.18));
        return node;
      default:
        node = el('circle', { r: r });
    }
    node.setAttribute('fill', fill);
    if (strokeW > 0) {
      node.setAttribute('stroke', stroke);
      node.setAttribute('stroke-width', strokeW);
    }
    return node;
  }

  function easeInOutCubic (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ---------------------------------------------------------------- model */

  function sortRows (rows, mode) {
    var r = rows.slice();
    switch (mode) {
      case 'value-desc': r.sort(function (a, b) { return b.value - a.value; }); break;
      case 'value-asc': r.sort(function (a, b) { return a.value - b.value; }); break;
      case 'cat-asc': r.sort(function (a, b) { return String(a.cat).localeCompare(String(b.cat)); }); break;
      case 'cat-desc': r.sort(function (a, b) { return String(b.cat).localeCompare(String(a.cat)); }); break;
      default: break;
    }
    return r;
  }

  function labelText (row, s) {
    switch (s.labelSource) {
      case 'category': return String(row.cat);
      case 'field': return row.labelField !== undefined && row.labelField !== null && row.labelField !== ''
        ? String(row.labelField) : fmt.number(row.value, s);
      case 'catvalue': return String(row.cat) + ': ' + fmt.number(row.value, s);
      default: return fmt.number(row.value, s);
    }
  }

  function ballColorFor (row, s, colorMap, vmin, vmax) {
    if (s.ballColorMode === 'field' && row.colorKey !== undefined && row.colorKey !== null) {
      return colorMap[row.colorKey] || s.ballColor;
    }
    if (s.ballColorMode === 'scale') {
      var span = vmax - vmin;
      var t = span === 0 ? 0.5 : (row.value - vmin) / span;
      return pal.mix(s.ballRampFrom, s.ballRampTo, t);
    }
    return s.ballColor;
  }

  function ballSizeFor (row, s, vmin, vmax) {
    if (!s.ballSizeByValue) return s.ballSize;
    var span = vmax - vmin;
    var t = span === 0 ? 1 : (row.value - vmin) / span;
    /* Area-proportional, so a value twice as big looks twice as big rather
     * than four times as big. */
    var aMin = Math.PI * Math.pow(s.ballSizeMin / 2, 2);
    var aMax = Math.PI * Math.pow(s.ballSizeMax / 2, 2);
    var area = aMin + (aMax - aMin) * t;
    return 2 * Math.sqrt(area / Math.PI);
  }

  /* --------------------------------------------------------------- render */

  function Renderer (root) {
    this.root = root;
    this.prev = {};          /* cat -> { pos, ballPos, size } for tweening */
    this.raf = null;
    this.hovered = null;
    this.selected = {};
  }

  Renderer.prototype.destroy = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.root.innerHTML = '';
  };

  Renderer.prototype.draw = function (model, s, api) {
    var self = this;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }

    var W = this.root.clientWidth || 600;
    var H = this.root.clientHeight || 400;
    this.root.innerHTML = '';

    /* Background and border live on the host element so they cover the
     * whole extension area, including outside the plot. */
    var host = this.root;
    if (s.bgMode === 'transparent') host.style.background = 'transparent';
    else if (s.bgMode === 'fixed') host.style.background = s.bgColor;
    else host.style.background = model.worksheetBg || '#ffffff';

    /* What a label actually sits on, for contrast decisions. A worksheet
     * colour can arrive as rgba() or a keyword, neither of which the contrast
     * maths accepts, so anything not a plain hex falls back to white. */
    var chartBg = s.bgMode === 'fixed' ? s.bgColor
      : (s.bgMode === 'transparent' ? '#ffffff' : (model.worksheetBg || '#ffffff'));
    if (!/^#[0-9a-f]{6}$/i.test(chartBg)) chartBg = '#ffffff';
    /* Published so the settings panel can match it. Set before the empty-data
     * early return, so an empty chart still themes the panel correctly. */
    this.chartBg = chartBg;

    host.style.border = s.borderShow ? (s.borderWidth + 'px solid ' + s.borderColor) : 'none';
    host.style.borderRadius = s.borderShow ? (s.borderRadius + 'px') : '0';

    var rows = sortRows(model.rows, s.sort);
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'lp-empty';
      empty.textContent = model.emptyMessage || 'Drop a dimension on Category and a measure on Value.';
      host.appendChild(empty);
      return;
    }

    var horiz = s.orientation === 'horizontal';

    /* Tweening interpolates one coordinate per mark. Flipping orientation
     * changes which axis that coordinate belongs to, so a remembered x would
     * be animated as a y and every mark would fly in from a nonsense place.
     * Drop the history whenever the axis it was measured against changes. */
    var layoutKey = s.orientation + '|' + s.baseline;
    if (this.layoutKey !== layoutKey) { this.prev = {}; this.layoutKey = layoutKey; }

    /* Value domain. */
    var vals = rows.map(function (r) { return r.value; });
    var dataMin = Math.min.apply(null, vals);
    var dataMax = Math.max.apply(null, vals);
    var lo = s.baseline === 'zero' ? Math.min(0, dataMin) : dataMin;
    var hi = Math.max(dataMax, lo);
    var scaleInfo = fmt.ticks(lo, hi, s.gridCount);
    var vMin = scaleInfo.min, vMax = scaleInfo.max;
    if (vMin === vMax) vMax = vMin + 1;

    /* The value a stick grows out of. Needed before margins, because which
     * side of it a mark falls on decides which side its label overhangs. */
    var baseVal = s.baseline === 'zero' ? Math.max(vMin, Math.min(0, vMax)) : vMin;

    var colorKeys = [];
    rows.forEach(function (r) {
      if (r.colorKey !== undefined && r.colorKey !== null && colorKeys.indexOf(r.colorKey) < 0) colorKeys.push(r.colorKey);
    });
    var colorMap = pal.categorical(s.ballPalette, colorKeys);

    /* Largest ball, needed so edge marks are not clipped. */
    var maxBall = 0;
    rows.forEach(function (r) { maxBall = Math.max(maxBall, ballSizeFor(r, s, dataMin, dataMax)); });
    var ballPad = maxBall / 2 + s.ballStrokeWidth + (s.ballShadow ? 4 : 0);

    /* ---- margins: measured, not guessed ---- */
    var catFont = s.axisFont, catSize = s.axisSize;
    var catW = 0;
    if (s.catAxisShow) {
      rows.forEach(function (r) {
        catW = Math.max(catW, measure(fmt.trim(r.cat, s.catMaxChars), catFont, catSize));
      });
    }
    var valLabelW = 0;
    if (s.valAxisShow) {
      scaleInfo.ticks.forEach(function (t) {
        valLabelW = Math.max(valLabelW, measure(fmt.number(t, s), catFont, catSize));
      });
    }

    /* Room for labels, measured per side. A negative value puts its label on
     * the opposite side of the baseline from a positive one, so reserving
     * space on only one side clips every negative label. */
    var roomL = 0, roomR = 0, roomT = 0, roomB = 0;
    if (s.labelShow && s.labelPosition !== 'inside') {
      var lineH = s.labelSize * 1.35;
      rows.forEach(function (r) {
        var w = measure(labelText(r, s), s.labelFont, s.labelSize);
        var away = r.value >= baseVal;
        var pos = s.labelPosition;
        if (horiz) {
          if (pos === 'above') roomT = Math.max(roomT, lineH);
          else if (pos === 'below') roomB = Math.max(roomB, lineH);
          else {
            /* 'before' points back toward the baseline, 'outside' away. */
            var toRight = (pos === 'outside') ? away : !away;
            if (toRight) roomR = Math.max(roomR, w);
            else roomL = Math.max(roomL, w);
          }
        } else {
          var up = (pos === 'below') ? false
            : (pos === 'above') ? true
              : ((pos === 'outside') ? away : !away);
          if (up) roomT = Math.max(roomT, lineH);
          else roomB = Math.max(roomB, lineH);
          /* A wide label on the first or last category overhangs sideways. */
          roomL = Math.max(roomL, w / 2);
          roomR = Math.max(roomR, w / 2);
        }
      });
      var gap = s.labelOffset + 6;
      if (roomL) roomL += gap;
      if (roomR) roomR += gap;
      if (roomT) roomT += gap;
      if (roomB) roomB += gap;
    }

    /* Start from whichever is larger, the ball overhang or the label
     * overhang, then add axis furniture on the sides that carry it. */
    var m = {
      top: s.padTop + Math.max(ballPad, roomT),
      right: s.padRight + Math.max(ballPad, roomR),
      bottom: s.padBottom + Math.max(ballPad, roomB),
      left: s.padLeft + Math.max(ballPad, roomL)
    };
    var axisSpace = catSize * 1.9;
    var titleSpace = catSize * 1.7;
    if (horiz) {
      if (s.catAxisShow) m.left += catW + 10;
      if (s.catAxisTitle) m.left += titleSpace;
      if (s.valAxisShow) m.bottom += axisSpace;
      if (s.valAxisTitle) m.bottom += titleSpace;
    } else {
      if (s.valAxisShow) m.left += valLabelW + 10;
      if (s.valAxisTitle) m.left += titleSpace;
      if (s.catAxisShow) m.bottom += axisSpace;
      if (s.catAxisTitle) m.bottom += titleSpace;
    }

    var plotW = Math.max(10, W - m.left - m.right);
    var plotH = Math.max(10, H - m.top - m.bottom);

    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'lp-svg' });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Lollipop chart of ' + (model.valueName || 'value') + ' by ' + (model.catName || 'category'));

    if (s.ballShadow) {
      var defs = el('defs');
      var filt = el('filter', { id: 'lp-shadow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
      filt.appendChild(el('feDropShadow', { dx: 0, dy: 1.5, stdDeviation: 2, 'flood-color': '#000000', 'flood-opacity': 0.28 }));
      defs.appendChild(filt);
      svg.appendChild(defs);
    }

    /* ---- scales ---- */
    var band = (horiz ? plotH : plotW) / rows.length;
    var gapFrac = s.categoryGap / 100;
    function catPos (i) { return (horiz ? m.top : m.left) + band * (i + 0.5); }
    function valPos (v) {
      var t = (v - vMin) / (vMax - vMin);
      return horiz ? (m.left + t * plotW) : (m.top + plotH - t * plotH);
    }
    var basePos = valPos(baseVal);

    /* ---- grid ---- */
    if (s.gridShow) {
      var g = el('g', { class: 'lp-grid' });
      scaleInfo.ticks.forEach(function (t) {
        var p = valPos(t);
        var ln = horiz
          ? el('line', { x1: p, y1: m.top, x2: p, y2: m.top + plotH })
          : el('line', { x1: m.left, y1: p, x2: m.left + plotW, y2: p });
        ln.setAttribute('stroke', s.gridColor);
        ln.setAttribute('stroke-width', 1);
        var da = dashArray(s.gridStyle, 1);
        if (da) { ln.setAttribute('stroke-dasharray', da); ln.setAttribute('stroke-linecap', 'round'); }
        g.appendChild(ln);
      });
      svg.appendChild(g);
    }

    /* ---- axes ---- */
    if (s.axisLineShow) {
      var ax = el('g', { class: 'lp-axisline' });
      var base = horiz
        ? el('line', { x1: basePos, y1: m.top, x2: basePos, y2: m.top + plotH })
        : el('line', { x1: m.left, y1: basePos, x2: m.left + plotW, y2: basePos });
      base.setAttribute('stroke', s.axisLineColor);
      base.setAttribute('stroke-width', 1.5);
      ax.appendChild(base);
      svg.appendChild(ax);
    }

    var axText = el('g', { class: 'lp-axistext' });
    axText.setAttribute('font-family', s.axisFont);
    axText.setAttribute('font-size', s.axisSize);
    axText.setAttribute('fill', s.axisColor);

    if (s.valAxisShow) {
      scaleInfo.ticks.forEach(function (t) {
        var p = valPos(t);
        var tx = horiz
          ? el('text', { x: p, y: m.top + plotH + s.axisSize * 1.4, 'text-anchor': 'middle' })
          : el('text', { x: m.left - 8, y: p + s.axisSize * 0.36, 'text-anchor': 'end' });
        tx.textContent = fmt.number(t, s);
        axText.appendChild(tx);
      });
    }

    if (s.catAxisShow) {
      rows.forEach(function (r, i) {
        var p = catPos(i);
        var tx = horiz
          ? el('text', { x: m.left - 10, y: p + s.axisSize * 0.36, 'text-anchor': 'end' })
          : el('text', { x: p, y: m.top + plotH + s.axisSize * 1.4, 'text-anchor': 'middle' });
        tx.textContent = fmt.trim(r.cat, s.catMaxChars);
        tx.setAttribute('class', 'lp-cat');
        tx.setAttribute('data-tuple', r.tupleId);
        axText.appendChild(tx);
      });
    }

    /* Titles sit in the space reserved for them: along the bottom edge, or
     * rotated up the left edge. */
    var titleY = H - s.padBottom - 3;
    var titleX = s.padLeft + catSize * 0.9;
    function bottomTitle (txt) {
      return el('text', { x: m.left + plotW / 2, y: titleY, 'text-anchor': 'middle' });
    }
    function leftTitle () {
      return el('text', {
        x: titleX, y: m.top + plotH / 2, 'text-anchor': 'middle',
        transform: 'rotate(-90 ' + titleX + ' ' + (m.top + plotH / 2) + ')'
      });
    }
    if (s.valAxisTitle) {
      var vt = horiz ? bottomTitle() : leftTitle();
      vt.textContent = s.valAxisTitle;
      vt.setAttribute('font-weight', '600');
      axText.appendChild(vt);
    }
    if (s.catAxisTitle) {
      var ct = horiz ? leftTitle() : bottomTitle();
      ct.textContent = s.catAxisTitle;
      ct.setAttribute('font-weight', '600');
      axText.appendChild(ct);
    }
    svg.appendChild(axText);

    /* ---- marks ---- */
    var marksG = el('g', { class: 'lp-marks' });
    var anySelected = Object.keys(this.selected).length > 0;
    var built = [];

    rows.forEach(function (r, i) {
      var cp = catPos(i);
      var vp = valPos(r.value);
      var size = ballSizeFor(r, s, dataMin, dataMax);
      var fill = ballColorFor(r, s, colorMap, dataMin, dataMax);
      var stickCol = s.stickColorMode === 'matchBall' ? fill : s.stickColor;

      var isSel = !!self.selected[r.tupleId];
      var dim = s.dimUnselected && anySelected && !isSel;

      var g = el('g', { class: 'lp-mark' + (dim ? ' lp-dim' : '') });
      g.setAttribute('data-tuple', r.tupleId);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'listitem');
      g.setAttribute('aria-label', r.cat + ', ' + fmt.number(r.value, s));

      /* stick */
      var stick = null;
      if (s.stickShow) {
        stick = horiz
          ? el('line', { x1: basePos, y1: cp, x2: vp, y2: cp })
          : el('line', { x1: cp, y1: basePos, x2: cp, y2: vp });
        stick.setAttribute('stroke', stickCol);
        stick.setAttribute('stroke-width', s.stickWidth);
        stick.setAttribute('stroke-linecap', s.stickCap);
        stick.setAttribute('stroke-opacity', s.stickOpacity / 100);
        var sda = dashArray(s.stickStyle, s.stickWidth);
        if (sda) stick.setAttribute('stroke-dasharray', sda);
        stick.setAttribute('class', 'lp-stick');
        g.appendChild(stick);
      }

      /* ball */
      var wrap = null, scaleG = null;
      if (s.ballShow) {
        wrap = el('g', { class: 'lp-ball-wrap' });
        scaleG = el('g', { class: 'lp-ball-scale' });
        var sh = shapeNode(s.ballShape, size, fill, s.ballStrokeColor, s.ballStrokeWidth);
        sh.setAttribute('opacity', s.ballOpacity / 100);
        if (s.ballShadow) sh.setAttribute('filter', 'url(#lp-shadow)');
        scaleG.appendChild(sh);
        wrap.appendChild(scaleG);
        wrap.setAttribute('transform', 'translate(' + (horiz ? vp : cp) + ',' + (horiz ? cp : vp) + ')');
        g.appendChild(wrap);
      }

      /* label */
      var lab = null;
      if (s.labelShow) {
        var txt = labelText(r, s);
        var lx, ly, anchor;
        var away = r.value >= baseVal;
        var off = s.labelOffset + size / 2;
        if (s.labelPosition === 'inside') {
          lx = horiz ? vp : cp; ly = (horiz ? cp : vp) + s.labelSize * 0.35; anchor = 'middle';
        } else if (s.labelPosition === 'above') {
          lx = horiz ? vp : cp; ly = (horiz ? cp : vp) - off - 2; anchor = 'middle';
        } else if (s.labelPosition === 'below') {
          lx = horiz ? vp : cp; ly = (horiz ? cp : vp) + off + s.labelSize; anchor = 'middle';
        } else if (s.labelPosition === 'before') {
          if (horiz) { lx = vp - (away ? off : -off); ly = cp + s.labelSize * 0.35; anchor = away ? 'end' : 'start'; }
          else { lx = cp; ly = vp + (away ? off + s.labelSize : -off - 2); anchor = 'middle'; }
        } else { /* outside */
          if (horiz) { lx = vp + (away ? off : -off); ly = cp + s.labelSize * 0.35; anchor = away ? 'start' : 'end'; }
          else { lx = cp; ly = vp - (away ? off + 2 : -off - s.labelSize); anchor = 'middle'; }
        }
        lab = el('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'lp-label' });
        lab.setAttribute('font-family', s.labelFont);
        lab.setAttribute('font-size', s.labelSize);
        lab.setAttribute('font-weight', s.labelWeight);
        var col = s.labelColor;
        if (s.labelPosition === 'inside' && s.labelAutoContrast) {
          /* A ring is hollow, so text placed inside it sits on the chart
           * background rather than on the mark colour. Contrasting against the
           * ring would pick white text on a white background. */
          col = pal.readableOn(s.ballShape === 'ring' ? chartBg : fill);
        }
        lab.setAttribute('fill', col);
        if (s.labelHalo) {
          lab.setAttribute('stroke', s.labelHaloColor);
          lab.setAttribute('stroke-width', Math.max(2, s.labelSize * 0.22));
          lab.setAttribute('stroke-linejoin', 'round');
          lab.setAttribute('paint-order', 'stroke fill');
        }
        lab.textContent = txt;
        g.appendChild(lab);
      }

      marksG.appendChild(g);
      built.push({ row: r, g: g, stick: stick, wrap: wrap, cp: cp, vp: vp, size: size });
    });

    svg.appendChild(marksG);
    host.appendChild(svg);

    /* ---- interaction ---- */
    marksG.addEventListener('mousemove', function (e) {
      var g = e.target.closest ? e.target.closest('.lp-mark') : null;
      var id = g ? Number(g.getAttribute('data-tuple')) : null;
      if (id !== self.hovered) {
        if (self.hovered !== null) {
          var old = marksG.querySelector('.lp-mark[data-tuple="' + self.hovered + '"]');
          if (old) old.classList.remove('lp-hover');
        }
        self.hovered = id;
        if (g && s.hoverGrow) g.classList.add('lp-hover');
        if (api && api.onHover) api.onHover(id, e);
      }
    });
    marksG.addEventListener('mouseleave', function (e) {
      if (self.hovered !== null) {
        var old = marksG.querySelector('.lp-mark[data-tuple="' + self.hovered + '"]');
        if (old) old.classList.remove('lp-hover');
      }
      self.hovered = null;
      if (api && api.onHover) api.onHover(null, e);
    });
    marksG.addEventListener('click', function (e) {
      if (!s.selectEnabled) return;
      var g = e.target.closest ? e.target.closest('.lp-mark') : null;
      if (!g) return;
      var id = Number(g.getAttribute('data-tuple'));
      var additive = e.ctrlKey || e.metaKey || e.shiftKey;
      if (additive) { if (self.selected[id]) delete self.selected[id]; else self.selected[id] = true; }
      else {
        var only = Object.keys(self.selected).length === 1 && self.selected[id];
        self.selected = {};
        if (!only) self.selected[id] = true;
      }
      if (api && api.onSelect) api.onSelect(Object.keys(self.selected).map(Number), additive);
      self.draw(model, s, api);
    });
    marksG.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var g = e.target.closest ? e.target.closest('.lp-mark') : null;
      if (!g) return;
      e.preventDefault();
      g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    /* ---- entry / change animation ---- */
    if (s.animate) {
      var dur = s.animDuration;
      var start = null;
      var from = built.map(function (b) {
        var p = self.prev[b.row.cat];
        return p !== undefined ? p : basePos;
      });
      var to = built.map(function (b) { return b.vp; });
      var changed = from.some(function (f, i) { return Math.abs(f - to[i]) > 0.5; });
      if (changed) {
        var step = function (ts) {
          if (start === null) start = ts;
          var t = Math.min(1, (ts - start) / dur);
          var e2 = easeInOutCubic(t);
          for (var i = 0; i < built.length; i++) {
            var b = built[i];
            var v = from[i] + (to[i] - from[i]) * e2;
            if (b.stick) {
              if (horiz) b.stick.setAttribute('x2', v);
              else b.stick.setAttribute('y2', v);
            }
            if (b.wrap) b.wrap.setAttribute('transform', 'translate(' + (horiz ? v : b.cp) + ',' + (horiz ? b.cp : v) + ')');
          }
          if (t < 1) self.raf = requestAnimationFrame(step);
          else { self.raf = null; self.syncLabels(built, s, horiz); }
        };
        /* Start marks at their old position so frame one is not a jump. */
        for (var k = 0; k < built.length; k++) {
          var b0 = built[k];
          if (b0.stick) { if (horiz) b0.stick.setAttribute('x2', from[k]); else b0.stick.setAttribute('y2', from[k]); }
          if (b0.wrap) b0.wrap.setAttribute('transform', 'translate(' + (horiz ? from[k] : b0.cp) + ',' + (horiz ? b0.cp : from[k]) + ')');
        }
        this.raf = requestAnimationFrame(step);
      }
    }

    this.prev = {};
    built.forEach(function (b) { self.prev[b.row.cat] = b.vp; });
    this.lastBuilt = built;
  };

  /* Labels are positioned from final values, so they need no per-frame work.
   * This hook exists for future label tweening without changing callers. */
  Renderer.prototype.syncLabels = function () { /* no-op, labels are final-positioned */ };

  Renderer.prototype.setSelected = function (ids) {
    this.selected = {};
    (ids || []).forEach(function (i) { this.selected[i] = true; }, this);
  };

  global.LP = global.LP || {};
  global.LP.Renderer = Renderer;
  global.LP.renderUtil = { measure: measure, shapeNode: shapeNode, dashArray: dashArray };
})(typeof window !== 'undefined' ? window : globalThis);
