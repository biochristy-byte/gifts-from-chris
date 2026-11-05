# Technique library: charts, interactions and calc pitfalls

Distilled from 39 recent videos of Andy Kriebel's public VizWiz channel
(youtube.com/@VizWiz), read as auto-caption transcripts, plus the recurring
techniques from a full pass over Tableau's chart types. Credit and go watch
the originals. Check this page before building any chart or interaction.

## The five recurring moves

Most advanced Tableau charts are one of these: dual axis with synchronized axes,
a `MIN(0)` or `MIN(1)` placeholder measure, table calcs with Compute Using set on
purpose, negating a measure for a diverging layout, and disaggregating so every
row is its own mark. [reference/TABLEAU_MASTERY.md](reference/TABLEAU_MASTERY.md)
has the full catalogue (40+ chart types, 20+ advanced custom vizzes, maps,
interactivity, calcs, performance, shortcuts).

## Highest-value techniques for a generator pipeline

- **Map layers as a drawing canvas.** A helper point table (rectangle = 5 rows,
  semicircle arc = 180, waffle = 100) plus `MAKEPOINT(row, col)` or
  `MAKEPOINT(-offset, weekday)` on a flat grid, background map off (needs two or
  more layers first, or a 100% washout). Rescale values with
  `SUM(x)/SUM({SUM(x)})` because map layers cannot use table calcs. Disable
  Selection on every layer. Covers big bar, L-bar, donut, waffle, gauge (trig
  x/y), marginal histogram, calendar heat map. Precompute the point tables in
  Python.
- **Dynamic zone visibility, string-state flavor.** `[show X] = [param]="X"`
  booleans work as well as the integer pattern. Five ingredients: a parameter, a
  boolean calc, the objects to toggle, a container, a parameter action. Build and
  test as a worksheet action first. A mobile KPI accordion: the text calc sits on
  Detail of the clickable mark layer, and the dehighlight filter action targets
  the SHEET with Show all values, F = T.
- **Dashboard-level actions.** A set action made from the Worksheet menu does
  nothing once the sheet is on a dashboard. It must live under Dashboard >
  Actions with the dashboard as source. Matters for XML injection.
- **Zoom with no extension.** Reference line value `IF [zoomy]="no" THEN 0 END`,
  Include Zero off. A reference line with aggregation "Total" is hidden on
  grand-total columns.
- **Two values in one parameter** (a two-click date range): test `LEN(param)=10`,
  append the clicked date, split with `LEFT`/`RIGHT` 10 wrapped in `DATE()`.
- **Drill with set actions.** `IF [set] THEN [Sub-Category] ELSE "" END`. A
  year-to-month filter: `{FIXED: SUM(INT([Year Set]))}=0 OR [Year Set]`. Sticky
  highlight fix: a dummy field plus the toolbar highlighter, or a never-matching
  true/false filter action.
- **Hexbin:** `HEXBINX/HEXBINY` scaled by a 0.005 to 0.1 adjuster parameter.
- **Quadrant:** `WINDOW_AVG` flags, and use `NOT` rather than `=FALSE`.
- **Rounded bar with inside labels:** a thick line plus a transparent Gantt layer.
- **Sparkline:** independent axis, no zero, hide headers and dividers.
- **Viz in tooltip:** replace the "all fields" filter with only the hover key.

## Calc pitfalls (silent wrong numbers)

- **Aggregate BEFORE you divide.** A row-level `[SO]/[AB]` gets summed (19,000%
  instead of 20%). Every rate you inject is `SUM(a)/SUM(b)`.
- **Lock table calcs to Specific Dimensions**, or moving a pill breaks them.
- **Fixed LODs ignore dimension filters** unless the filter is added to context.
- **Bars always start at zero.**
- **Never join individual-level and aggregate-level data.** It double-counts.
  Keep them on separate sheets. Prefer a weight column to duplicating rows.
- **Filter order of operations:** extract, context, dimension, FIXED, measure,
  table calc. Know where your filter sits.

## Design opinions that confirm or tension with the house rules

- Confirms rules 5, 6, 11, 12, 22: a "rule of four" charts per page, a neutral
  palette plus one focus color, series-colored end-of-line labels instead of a
  legend, a 9 to 10 pt italic instruction line, rename every action, avoid Hover
  as an action trigger.
- Layout: one root container floated at 0,0 sized to the dashboard, nested tiled
  children, 10 px outer padding, pinned title and divider heights, "Distribute
  contents evenly". This tensions with rule 3 (avoid floats) and rule 4 (8 px
  outer padding): pick per project.
- He deletes the Phone layout and builds a separate 375-wide dashboard instead.
- He writes titles as questions. Worth a mock; not adopted.

## Data prep habits

- Tidy shape: one variable per column, one observation per row, a single grain
  per output file.
- Code free text ONCE into a fixed taxonomy through an editable lookup file, so a
  human can fix it in Excel and re-run. Route the unsure to a `needs_review` flag.
- Tag grain with an `is_individual_level` or `data_grain` flag.
- If you must show a rate, precompute the numerator and denominator so
  `SUM(weight)` just works for the analyst; nobody should need survey-weighting
  math to count.
- Precompute geometry in Python (trig for wedges, Venn x/y from radius).
- A word cloud is a scatter placed by a layout script. Tableau's packed Text-mark
  cloud cannot hold a gutter, and mark size on a scatter is a narrow font band, so
  carry one label run per font size with each run's field on Text.
