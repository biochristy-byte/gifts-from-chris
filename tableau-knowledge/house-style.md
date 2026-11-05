# Tableau dashboard house style (35 rules)

Distilled from reading the published workbooks (XML and thumbnails) of two
dashboard designers, one who teaches and one who dazzles, plus two conference
talks and a year of a public Tableau channel. Everything here came from real
files and real builds, not from general Tableau advice. Hand this file to Claude
before it designs a page: "read tableau-knowledge/house-style.md first."

The two styles in one line each:

- **The teacher.** Fixed 1600x1000 canvas, one navy title bar, white bold
  centered 22 pt, named colorblind-safe palettes, 1 to 4 charts per tab, many
  tabs, an instruction sentence wherever an interaction is not obvious, and a
  credit caption at the bottom.
- **The dazzler.** The visual shell (background, title, icons) is baked as a PNG
  outside Tableau. Real sheets sit on it as translucent glass panels, everything
  is nested tiled `layout-flow`, almost nothing floats, and the wow comes from
  parameter actions, dynamic zone visibility and toggle buttons, not from fonts.

## Layout and structure

| # | Rule |
|---|---|
| 1 | Fixed canvas, never automatic: `sizing-mode='fixed'`. One size for the whole workbook. |
| 2 | One title treatment, repeated without variation on every page: full-width colored bar, bold, white, one font and size. |
| 3 | Structure with nested `layout-flow` containers, fixed-pixel children inside percentage parents. Avoid floating zones. |
| 4 | Margins 4 inner, 8 outer, `border-style='none'`. Separation is whitespace and background blocks, not strokes. |
| 5 | 1 to 4 charts per page. A complex analysis becomes more pages, never a denser page. |
| 15 | Author a Phone `devicelayout` (`sizing-mode='vscroll'`) for every dashboard, or build a separate 375-wide dashboard. Drop it only on purpose. |
| 17 | Name each tab after what it shows. A teaching workbook gets a build-summary recap tab. |

## Color, type, background

| # | Rule |
|---|---|
| 6 | Cap categorical color at 4 to 6 per view. More categories means a highlight or a set action, not more hues. |
| 7 | Type hierarchy by size and greyscale only (`#000000 #333333 #555555 #757575 #898989`, 7 to 18 pt, 22 pt title) plus 1 or 2 semantic accents. Do not change fonts to add interest. |
| 8 | A full-bleed background image at zone 0 (`type-v2='bitmap'`, `w=h=100000`) is the highest-payoff single move, and it can be generated from Python. |
| 9 | Panels are translucent fills over that art (8-digit hex such as `#f5f5f584`) with real rounded corners where Tableau renders them. Adjoining zones take opposite corners so a split panel reads as one pill. |
| 10 | Bake anything Tableau cannot render (script-font titles, signatures, icons) as a PNG image zone. Ship light and dark variants of each icon. |
| 18 | Colorblind-safe named palettes (`color_blind_10_0`) for categorical color. A hand-authored multi-stop palette only when the mood needs it. Never a manually stepped gradient for a continuous measure. |
| 19 | Mood board before design. Collect reference images and pull palette, fonts, banners and textures from them. |
| 20 | Build the background art FIRST, before charts exist. It sets the feel early. |
| 21 | Custom shape marks for hand-made texture. A shape keeps its opacity AND color, so a highlighter circle looks like marker ink. Dual axis gives two layers; use map layers when you need more. |
| 22 | Chart form must match the theme: a lollipop instead of a bar for a hand-drawn feel, faint gray "pencil" lines for context, one highlighter-colored line for the focus. |

## Labels, text, honesty

| # | Rule |
|---|---|
| 11 | Direct-label bar and line ends in the format the reader will quote ("$79.81K"), on top of the axis, not instead of it. |
| 12 | One plain instruction sentence wherever an interaction is not discoverable ("Select Region to filter:", "Hover for detail"). |
| 13 | A headline number that moves with a filter goes in a bolded inline sentence, not a static KPI tile: "**32,700** within **6 km** of **the stadium**". |
| 14 | Credit the data source and any borrowed technique in a small italic caption at the bottom. |
| 28 | Bake minor text (nav hints, hover tips) into the background image. Keep essential labels as real text for accessibility. |
| 29 | Show the analytic depth. Hidden math reads as "out of thin air": give the method a visible home, a short line or a recap panel. |
| 34 | **Text contrast is 7:1 at a minimum (WCAG AAA), never just 4.5:1.** Every word against the ground it actually sits on: card, title band, nav pill, bar, heat cell, tooltip box. Compute it, never eyeball it, and gate it in the build with a control that must fail. If a data color cannot reach 7:1 as text, set its TEXT in a lighter or darker step of the same hue and keep the mark color. |
| 35 | **No text under 10 pt**, legends at 11 pt with a 13 pt swatch. Size every row header and label column for its longest label at that size. Public draws type at about two thirds of Desktop's size, so 8 pt reads as fine print. |

## Interactivity

| # | Rule |
|---|---|
| 16 | Interactivity ranked by payoff: a list parameter plus a change-parameter action on a KPI card, dynamic zone visibility for metric toggles, `tsc:brush` highlight, `tsc:tsl-filter` with `auto-clear='true'` for toggle buttons (duplicate selected and unselected sheets). |
| 24 | One integer state parameter drives a guided story page: every dynamic-zone-visibility calc, any state-dependent filter and the background overlays read it. ONE parameter action on clickable headers sets it (an accordion). |
| 30 | Draw shapes with map layers: a helper point table plus `MAKEPOINT`, background map off, Selection disabled per layer, precomputed in Python. Waffle, gauge, donut, calendar heat map. |
| 31 | Interaction state may be a string parameter (`[param]="X"` booleans) as well as an integer. Set actions for a dashboard live under Dashboard > Actions, not on the sheet. |
| 32 | Aggregate before dividing: every rate is `SUM(a)/SUM(b)`. Lock table calcs to Specific Dimensions. |
| 33 | Rename every action, clear with "Show all values", never trigger on Hover. |

## Story and process

| # | Rule |
|---|---|
| 23 | Four-question design test: is it clean, does it add rather than distract, is it accessible, can it be built fast? Cut the ideas that fail. |
| 25 | A presented story is about 3 pages: hook, intro with the big question, analysis, answer. Fold extra pages into one with dynamic zone visibility. |
| 26 | A story is not a list of facts. It has a beginning, a middle, and an ending that is NOT immediately obvious. Informational is fine, but say which one it is. |
| 27 | Do the thinking in Prep or Python: precompute metrics as flags, map messy categories to a clean list, split into several tiny single-purpose data sources (one per chart), and precompute geometry (Venn x/y from radius by trig). No filtering, renaming or formatting should happen in Tableau. |

## Local departures worth copying

- **Tableau's own rounded borders are feature-flagged** and may never render. If you
  want rounded cards, bake the card (fill, shadow, 15 px corners, 2 px border)
  into the page PNG and make the sheets on it `#00000000`.
- **Fonts on Tableau Public** are limited to Tableau's own plus the web-safe set
  (Arial, Comic Sans, Courier New, Georgia, Lucida Sans Unicode, Tahoma, Times
  New Roman, Trebuchet MS, Verdana). Any other headline face falls back on the web.
  The safe Tableau set is `Tableau Book`, `Light`, `Semibold`, `Bold`, `Medium`.
- **Count text may take a darker step than its mark.** Bars stay the spec red
  while their counts are set in a darker red that clears the contrast bar, so the
  same color still means the same thing on the marks.

## Speed (live builds and rehearsed demos)

- Reuse finished sheets by copy plus filter. Keep calculations in a text file to
  paste in. Keep each data source chart-ready.
- Marks-card shortcuts: Alt+Shift+O color, I size, C columns, S detail, R rows.
- Rehearse the full build repeatedly. A first run took 50 minutes against a 20
  minute limit.
- Cut order when time runs out: conclusion block, metric explanations, tooltip
  formatting, chart styling.

## Dashboards that talk to AI agents (Tableau Cloud and Next business preferences)

Notes from a conference talk on writing a business-preferences file for
Tableau's agents. Useful for any agent context file you write.

- It is the last mile, not the main meal. Clean labels and descriptions,
  governed calculations and hidden noise fields come FIRST. Rules last.
- Cloud: one `.md` file per dashboard, each rule begins with `# `, at most 50
  rules and 8,000 characters, and the dashboard must be published. Next: one per
  semantic model, 30,000 characters. Field descriptions: 255 characters on Next;
  Cloud may stop absorbing past about 150.
- Rules cover meaning, policy thresholds, interpretation defaults and behavior
  ("never fabricate", "no unsupported assumptions"). NEVER put math or
  formatting in a rule: a `TO_CHAR` rule turned a number into text.
- Agents follow filters left on a dashboard, so tell them to clear filters.
  Command rather than narrate.
- Watch for invented thresholds, double-counted totals and silently dropped
  filters. Keep independent tallies to check against.
- Have a second LLM audit the rule file for conflicts and ambiguity.

## Where the rules came from

| Source | Rules |
|---|---|
| A Tableau instructor's published workbooks | 1, 2, 4, 5, 6, 11 to 15, 17 |
| A dashboard designer's published workbooks | 3, 7 to 10, 16, 18 |
| An Iron Viz 2026 winner's conference talk | 19 to 29 |
| Andy Kriebel's VizWiz channel (see [technique-library.md](technique-library.md)) | 30 to 33 |
| A reader's feedback that gray notes looked washed out (they passed AA at 6.3:1) | 34, 35 |
