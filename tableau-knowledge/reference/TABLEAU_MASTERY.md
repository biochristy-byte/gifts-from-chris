# Tableau Mastery Reference (self-taught, June 2026)

Exhaustive reference on chart types, maps, marks, analytics, interactivity, formatting,
and calculations. Built from help.tableau.com, Trailhead, Flerlage Twins, The Information
Lab, Playfair Data, The Data School. Companion to TABLEAU_REFERENCE.md (the .twb/.twbx
file format) and README.md (a generator pipeline that injects charts into a Tableau-authored template, see ../buildout-pipeline.md).

---

## 0. THE FIVE RECURRING TECHNIQUES (unlock ~everything advanced)

1. **Dual axis + Synchronize.** Drag a measure to Rows/Cols twice, right-click 2nd axis > Dual Axis, right-click > Synchronize Axis. Foundation for donut, lollipop, dumbbell, bump, pareto, combo, layered maps. Secondary measure draws on top.
2. **`MIN(0)` / `MIN(1)` placeholder axis.** A constant pill makes a layer with no real measure (donut rings, lollipop stems, label layers).
3. **Compute Using direction** (table calcs). The make-or-break setting. Checked = addressing = direction the calc moves; unchecked = partitioning = where it restarts. Wrong direction = "my numbers look wrong."
4. **Negate a measure** (`-SUM([x])`) for waterfall Size, diverging bars, population pyramids.
5. **Disaggregate** (Analysis > uncheck Aggregate Measures, or add a dim to Detail) for scatter, box plot, jitter, point maps. They silently collapse to one mark otherwise.

Plus for deep-custom viz: **data densification** (cross-join real data to a tiny "model" table with a join key + integer index, then bin the index to trigger densification, walk with INDEX()) and **trig** (`X = r*COS(RADIANS(θ))`, `Y = r*SIN(RADIANS(θ))`, `PI()` for radians).

---

## 1. CHART TYPE CATALOG

Conventions: Cols/Rows shelves; Marks = Color/Size/Label/Detail/Shape/Path/Angle.

### In "Show Me" (field combos needed)
| Chart | Dims | Meas | Build |
|-------|------|------|-------|
| Text table / crosstab | 1+ | 1+ | dim Rows + dim Cols + measure on Text |
| Heat map | 1+ | 1-2 | dims Rows/Cols, Square mark, measure on Color (2nd on Size) |
| Highlight table | 1+ | 1 | crosstab + same measure on Color |
| Symbol map | 1 geo | 0-2 | double-click geo; measure on Size/Color |
| Filled map | 1 geo | 1 | double-click geo; mark Map; measure on Color (use ratios) |
| Pie | 1+ | 1 | Pie mark; dim Color, measure Angle (<=6 slices) |
| Horizontal bar | 1+ | 1+ | measure Cols, dim Rows, Bar |
| Stacked bar | 1+ | 1+ | bar + 2nd dim on Color |
| Side-by-side bar | 1+ | 1+ | dim Cols + dim Cols/Color |
| Treemap | 1+ | 1-2 | dim Detail, measure Size, Square (2nd measure Color) |
| Circle / side-by-side circle | 1+ | 1+ | Circle mark |
| Line (continuous) | 0+ | 1+ | green date Cols, measure Rows, Line |
| Line (discrete) | 0+ | 1+ | blue date Cols, measure Rows, Line |
| Dual line / dual combo | 0+ | 2 | 2 measures, dual axis (combo = bar+line) |
| Area / stacked area | 0+ | 1+ | date Cols, measure Rows, Area (+dim Color stacks) |
| Scatter | 0+ | 2-4 | measure Cols + measure Rows, dim on Detail to disaggregate |
| Histogram | 0 | 1 | Create Bins; bin Cols, CNT Rows, Bar |
| Box-and-whisker | 0+ | 1 | disaggregate + Analytics > Box Plot |
| Gantt | 0+ | 0-1 | date Cols, dim Rows, Gantt Bar, duration on Size |
| Bullet graph | 0-1 | 2 | one measure bar, other becomes ref line |
| Packed bubbles | 1+ | 1 | dim Detail, measure Size, Circle |

Automatic mark resolves: **Dim+Dim->Text, Meas+Meas->Shape, Dim+Meas->Bar, Date+Meas->Line.**

### NOT in Show Me (hand-build via dual-axis / table calc / placeholder)
- **Donut**: two `MIN(1)` axes, dual; top = white Circle shrunk to carve hole; bottom = Pie.
- **Lollipop**: measure on Rows twice; Bar (thin stem) + Circle (head); dual + sync.
- **Dumbbell/DNA**: measure Cols, category Rows; Line layer (pair dim on Path) + Circle layer; dual+sync.
- **Slope**: 2-point line; discrete period (filtered to 2) Cols, measure Rows, category Color.
- **Bump**: date Cols, `RANK()` Rows (Compute Using category), Line+Circle dual; reverse rank axis.
- **Jitter/dot plot**: disaggregate; `INDEX()` or `RANDOM()` on the spreading axis (hidden).
- **Waterfall**: dim Cols sorted, measure Rows > Quick Table Calc Running Total, Gantt Bar mark, Size = `-SUM([x])` (negative), color by sign.
- **Pareto**: sort desc; measure bars + dual line; line = Running Total **primary** + Percent of Total **secondary**; add 80% ref line.
- **Funnel**: stage dim Rows sorted desc, measure Cols, Bar (symmetric = negate half-value).
- **Sparklines**: tiny line per row; hide axes; independent row axes; end-point dot via dual circle.
- **Small multiples**: `Cols=(INDEX()-1)%n`, `Rows=INT((INDEX()-1)/n)`, both discrete, Compute Using category.
- **Control chart**: line + Average ref line + `WINDOW_AVG +/- [k]*WINDOW_STDEV` band; color outliers; `[k]` parameter.
- **Diverging bar / population pyramid**: signed measure (negate one side), color by sign, center baseline.
- **KPI/BAN**: measure on Text, Text mark, huge font, hide everything; one sheet per number.

---

## 2. ADVANCED / CUSTOM VIZ (deep cuts)

All rely on densification (model table + bin + INDEX) and/or trig. Templates downloadable from Flerlage Twins / Toan Hoang (open the .twbx, read the calcs).

- **Sankey**: densify each flow to ~49 points over `t` (-6..6); curve = sigmoid `1/(1+EXP(1)^-t)` (or sine `(SIN(t)+1)/2`, smoother); position via RUNNING_SUM of size; Polygon mark, `t`(bin) on Path. Node columns = Gantt bars on dual axis.
- **Chord**: nodes on a circle via `x=COS(rank/n*2*PI())`, `y=SIN(...)`; chords = quadratic Bezier `((1-t)^2*p1)+(2t(1-t)*p2)+(t^2*p3)`, midpoint pulled to center; Line, `t` on Path.
- **Network graph**: compute X/Y outside Tableau (Gephi ForceAtlas / NetworkX / D3), bring back as coordinate table; Line edges under Circle nodes (dual axis).
- **Radial bar / racetrack**: angle per category -> RADIANS; `X=r*COS`, `Y=r*SIN`; Method A = self-union 2-point Line; Method B = densified arcs.
- **Polygon custom shapes**: ordered closed point set with Polygon ID + Point ID (Path); or spatial `MAKEPOINT`/`MAKELINE`.
- **Hexbin**: `HEXBINX([x]*ratio,[y]*ratio)/ratio`, `HEXBINY(...)`; ratio parameter = hex size; hexagon shape or true polygon hexes.
- **Curved O-D map**: densify route to 100 points; Wendy Shijia sigmoid for CurveX/CurveY (assign Longitude/Latitude roles); Line, Point on Path. Straight = `MAKELINE(MAKEPOINT(o),MAKEPOINT(d))`.
- **Sunburst / nested donut**: concentric polygon rings, pivot hierarchy long + densify; trig (angle,radius)->X/Y. Newer: map-layer donut rings (no polygons).
- **Calendar heatmap**: weekday Cols, week-of-month Rows (`DATEPART('week') - {FIXED MONTH: MIN(DATEPART('week'))}`), Square Color.
- **Marimekko**: width = `{FIXED [col]:SUM([x])}` on Size; X = Running Sum of width (continuous Cols); height = % of Total Rows; dims on Detail.
- **Barcode/strip**: continuous measure Cols, category Rows, Gantt Bar (thin tick), granular dim on Detail, low opacity.
- **Bar chart race**: date on Pages, bars sorted by measure, enable viz animations.
- **Sheet swapping (2022.3+)**: string parameter + one Boolean calc per chart (`[param]="Bar"`); all sheets in one container; per-zone Layout > Control visibility using value.
- **Connected scatterplot**: X meas Cols, Y meas Rows, date continuous on Path; Line + Circle dual.
- **Word cloud**: word dim on Text, Text mark, frequency on Size (native auto-pack).
- **Sparkline+BAN table**: line per row + endpoint dot calc (`IF MAX(date)=WINDOW_MAX(MAX(date)) THEN SUM([x])`); BAN as adjacent text.

---

## 3. MAPS

### Geographic roles
Country/Region, State/Province, County, City, Zip/Postcode, Area Code, CBSA/MSA, Congressional District, Airport, NUTS, Lat, Long. Assign: data-type icon / right-click > Geographic Role. Globe icon = recognized; auto-creates Latitude(generated)/Longitude(generated). Own coords: set roles Latitude/Longitude, drag as **Dimension** (not Measure, or points collapse to one).
- **Ambiguous locations**: map lower-right "N unknown" > Edit Locations; set State "From field" to disambiguate; or enter lat/long.
- **Custom geocoding**: Map > Geocoding > Import Custom Geocoding (folder of CSVs, lat/long as reals w/ a decimal; re-import replaces all).
- **Hierarchy**: drag Country onto State onto City to drill + disambiguate.

### Map types
- **Symbol/point**: double-click geo; Circle. **Proportional symbol**: + measure on Size (stepped color).
- **Filled/choropleth**: double-click polygon role; mark Map; measure on Color. Use **ratios**, not raw counts.
- **Density/heatmap**: plot Long/Lat + ID on Detail; mark = Density; Color (10 palettes + Intensity), Size (radius).
- **Dual-axis map**: two Latitude(generated) on Rows > Dual Axis > Synchronize; one Filled, one symbol/pie (pre-2020.4 layering).
- **Hexbin map**: `Hex Long = HEXBINX([Lon]*ratio,[Lat]*ratio)/ratio`; plot Hex Long x Hex Lat, hexagon shape, Color = COUNT.
- **Flow/path**: Path ID on Detail, order field on Path shelf, Line mark.
- **Origin-Destination**: `MAKELINE` (both endpoints in a row), or Line Group + Order on Path.

### Spatial functions
`MAKEPOINT(lat,long,[SRID])` (NOT generated lat/long), `MAKELINE(p1,p2)` (great-circle), `DISTANCE(p1,p2,'km')`, `BUFFER(geom,d,'km')`, `AREA(poly,'km')`, `LENGTH`, `INTERSECTS`, `INTERSECTION`, `DIFFERENCE`, `OUTLINE`, `SHAPETYPE`, `VALIDATE`. Spatial join: Data Source > Intersects operator.

### Spatial files
Shapefile (.shp+.shx+.dbf+.prj or .zip), File Geodatabase (.gdb), MapInfo (.TAB/.MID/.MIF), KML, GeoJSON, TopoJSON. Connect > To a File > Spatial file. Creates a Geometry field. All reproject to WGS84; one geometry type per connection.

### Map LAYERS (2020.4+, the marks-layer feature)
Drag a geo field to "Add a Marks Layer" (top-left). Each layer = own Color/Size/mark-type. Controls: rename, reorder (drag), hide (eye icon), Disable Selection (pure background), remove. Published viewer toggle: Map > Map Options > Layer Control.

### Map customization (background, different from marks-layers)
- **Map > Map Layers pane**: Background Style (Normal/Light/Dark/Streets/Outdoors/Satellite), Washout slider, layer checkboxes (streets, borders, zip boundaries...), **US Data Layers** (ACS Census demographic choropleth by State/County/Zip/Block Group).
- **Map > Background Maps**: None / Offline (~4 zoom levels) / Tableau / Add WMS / Add Mapbox.
- **Map > Map Options**: pan/zoom lock, map scale, units, search, view toolbar, radial-selection distance.
- **Custom territories**: select marks > Group icon, or Geographic Role > Create from. **Background images**: Map > Background Images for floorplans (own X/Y coordinate space).
- **Selection**: rectangular/radial(measures distance)/lasso; double-click zoom, Shift+double-click out.

---

## 4. MARKS CARD

### Mark types
Automatic, Bar, Line (exposes Path: Linear/Step/Jump; patterns 2023.2+), Area, Square, Circle, Shape, Text, Map(polygon), Pie (exposes Angle), Gantt Bar (Size=length), Polygon (Path), Density (Color+Intensity, no legend/label), Line(path).

### Properties (Size/Shape/Angle = 1 field; Color/Label/Detail/Tooltip = multiple)
- **Color**: discrete dim->categorical palette; continuous measure->gradient. Palettes: Categorical / Sequential / Diverging. Edit Colors: Stepped, Reversed, Use Full Range, Advanced start/end/center. Effects: Opacity, Mark Border, Mark Halo, Markers (line points). Colorblind palette = blue/orange; avoid red-green.
- **Size**: scales circles/squares/shapes/text; bar/Gantt width; line thickness; polygons can't resize. Edit Sizes: Automatically/By Range/From Zero, Reversed.
- **Label/Text**: Show mark labels; Marks to Label (All/Selected/Highlighted/Min-Max/Line Ends/Most Recent); Allow overlap; Match Mark Color.
- **Detail**: dimension adds granularity (more marks) without encoding or headers. ATTR() returns `*` when multiple values per mark (fix: add dim to Detail).
- **Tooltip**: Edit Tooltip; Insert fields/sheet props; command buttons; Viz in Tooltip; Responsive vs On Hover.
- **Shape**: dim->symbol per member. Custom: PNG in My Tableau Repository\Shapes\<palette>, ~32x32 transparent, Reload Shapes.
- **Path** (Line/Polygon): connection order. **Angle** (Pie): wedge sweep.

### Dual axis + multiple marks layers
Two measures on Rows/Cols = one Marks card **per measure** + an All card; encode each independently (this IS the combo-chart mechanism). Dual Axis (right-edge drop or right-click pill); Synchronize Axis (greyed if different data types). Max 4 layered axes.

### Encoding choice
Position (Rows/Cols) strongest -> most important variable. Color = few categories or 1 measure (<=7-10). Size = 1 magnitude measure (secondary). Shape = small nominal set. Don't rely on color alone; contrast >=4.5:1.

---

## 5. ANALYTICS PANE

Second sidebar tab. Drag items onto Table/Pane/Cell drop zones (dual-axis shows per-measure boxes).

- **Summarize**: Constant Line, Average Line, Median w/ Quartiles, Box Plot (Cell only), Totals, Average/Median w/ 95% CI.
- **Totals**: Analysis > Totals > Show Column/Row Grand Totals, Add All Subtotals; Total All Using (Automatic re-aggregates underlying rows, can differ from summing visible cells); Row Totals to Left / Column to Top.
- **Model**: Trend Line (Linear/Log/Exponential/Power/Polynomial deg 2-8), Forecast (Desktop only, exponential smoothing), Cluster (k-means).
- **Custom**: Reference Line (scope Table/Pane/Cell; value field/parameter/constant; agg Total/Sum/Min/Max/Avg/Median/Percentile/StdDev; label None/Value/Computation/Custom), Reference Band, Reference Distribution (Percentages/Percentiles/Quantiles 3-10/StdDev/CI), Box Plot (whiskers 1.5xIQR or max extent).
- **Trend line quality**: hover = equation + R-Squared + p-value (<=0.05 significant). Describe Trend Model = full stats. "Allow per color", "Force through zero" (scatter only), confidence bands (not Exponential).
- **Forecast**: length Auto/Exactly/Until; model Auto/no-seasonality/Custom (Trend & Season = None/Additive/Multiplicative); 8 exponential-smoothing models, AIC selection; prediction intervals 90/95/99. Describe Forecast = quality GOOD/OK/POOR + RMSE/MAE/MASE/MAPE/AIC.
- **Cluster**: k-means, Calinski-Harabasz for auto count, min-max normalized. Variables box; 2-50 clusters. Describe Clusters = between/within sum of squares, ANOVA F/p. Drag Clusters pill to Data pane to save as group; Refit to recompute.
- **Honesty**: bars must include zero (Edit Axis); synchronize dual axes if same units; high R-squared/polynomial can overfit; Automatic totals re-aggregate.

---

## 6. INTERACTIVITY

### Order of operations (filter precedence)
Extract > Data source > **Context** > **FIXED LOD** > Dimension filters > **INCLUDE/EXCLUDE LOD** > Measure filters > Table-calc filters. (Why "Top 10 within Region" needs Region as a **context filter**.)

### Parameters
Create (Data pane dropdown); types Integer/Float/String/Boolean/Date; allowable All/List/Range(min/max/step); Show Parameter. Reference in calc/filter/ref-line/title (parameters never filter on their own). **Dynamic params (2020.1+)**: List "when workbook opens" binds to a field; value binds to a calc (single value); refreshes on open/data-refresh only.
- Top-N: filter > Top tab > Top [param] by SUM. Measure/dim swap: `CASE [param] WHEN ... THEN SUM([x]) END`. What-if: `[Sales]*(1-[Discount%])`. Bins: `FLOOR([v]/[BinSize])*[BinSize]`.

### Sets
Constant (select > Create Set) / Computed (Condition tab) / Top (Top tab). IN/OUT; usable as Boolean in calcs. Combined sets (union/intersection/difference, same dim). Show Set control (2020.2+).
- **Set actions** (Dashboard > Actions > Change Set Values): Assign/Add/Remove; clearing = Keep or Add-all (never-empty combo = Assign + Add all). Use: proportional brushing, drill, dynamic hierarchies.

### Parameter actions (2019.2+)
Change Parameter from a click; source field aggregated (None/SUM/AVG/...). Use: highlight, sheet swap, dynamic ref line, drill.

### Dashboard actions
Filter (hover/select/menu; field mapping enables cross-datasource; clearing Leave/Show-all/Exclude-all), Highlight, Go to URL, Go to Sheet (Navigation), Change Parameter, Change Set. "Use as Filter" funnel shortcut.

### Dynamic Zone Visibility (2022.3+)
Show/hide any zone via a Boolean parameter/field (single-valued). Layout > Control visibility using value. Modern sheet-swap: stack sheets, inverse Boolean conditions, parameter flips.

### Viz in Tooltip
Tooltip editor > Insert > Sheets. `<Sheet name="X" maxwidth="300" maxheight="300" filter="<All Fields>">`. Static image; filter All Fields or Selected Fields.

### Filters deep
Data-source filters (all sheets, Data Source tab), Extract filters (baked in .hyper), Context (Add to Context, gray), Top-N, Wildcard, Condition, Relevant Values, Apply to Worksheets (All/Selected/Only). Card modes: single/multi/dropdown/slider/wildcard/relative-date/range. Show Apply button for big extracts.

### Hierarchies / nav / animation
Drag dim onto dim = hierarchy (+/- drill). Show/Hide button (floating containers). Navigation button object. Viz animations (Format > Animations, Simultaneous/Sequential, ~0.3s). Pages shelf (one frame per member; Desktop authoring, limited on Public).

---

## 7. FORMATTING & TOOLTIPS

Precedence: **Workbook > Worksheet > Field** (narrowest wins; set broad first).

### Number format (Excel-style: `Positive;Negative;Zero;Text`)
| Goal | String |
|------|--------|
| Thousands | `#,##0` |
| Negatives in parens | `#,##0;(#,##0)` |
| Currency parens | `"$"#,##0;("$"#,##0)` |
| Percent | `#,##0%` |
| Thousands K (1 comma) | `#,##0,"K"` |
| Millions M (2 commas) | `#,##0,,"M"` |
| Hide zeros | `#,##0;-#,##0;` |
| 1 decimal + K | `#,##0.0"K"` |
`[Red]` does NOT work (use Marks Color or a calc). Dynamic K/M/B: one calc per range returning NULL outside it, stacked on Text.

### Date format
`yyyy`/`yy`, `MMMM`/`MMM`/`MM`/`M`, `dddd`/`ddd`/`dd`/`d`, `HH`/`mm`/`ss`. Literals in quotes: `"Q"q yyyy`. Fiscal year: Default Properties > Fiscal Year Start.

### Nulls
Format > Pane > Special Values: Show indicator / Plot at default / Hide(connect) / Hide(break) / custom label.

### Default Properties (right-click field in Data pane)
Aggregation, Comment, Number/Date Format, Color, Shape, Sort (shared across all sheets on that source).

### Annotations (anchor to data)
Mark (tied to a mark), Point (x/y + leader line), Area (region). Right-click > Annotate.

### Worksheet
Format menu (Font/Alignment/Shading/Borders/Lines; Sheet/Rows/Columns tabs). Banding (Format > Shading). Lines (Grid/Zero/Trend/Reference/Drop). Axis (Edit Axis: Automatic/Uniform/Independent/Fixed range, Include zero, Reversed, Logarithmic Positive/Symmetric; Tick Marks).

### Titles/captions
Show Title/Caption; Edit Title with Insert tokens (`<Sheet Name>`, `<SUM(Sales)>`, `<Parameters.X>`), multi-line.

### Dashboard
Size Fixed (cached, fast) / Range (min-max, mobile) / Automatic (tiled only). Tiled vs Floating (z-order in Layout pane). Padding: Outer (between objects) / Inner (border to content); background fills inner not outer. Transparent: worksheet shading None over an Image object, fixed-size. Objects: Horizontal/Vertical/Text/Image/Web/Blank/Navigation/Download/Extension. Show/Hide button (floating containers) vs DZV (data-driven).

---

## 8. CALCULATIONS

Three kinds, by WHERE they run: row-level/aggregate (data source) -> LOD (data source, chosen grain) -> table calc (after query, on viz marks).

### LOD expressions `{FIXED|INCLUDE|EXCLUDE <dims> : <agg>}`
- **FIXED**: at declared dims only, ignores view (and ignores dimension filters - runs before them). `{FIXED [Segment]:SUM([Sales])}`; `{FIXED : SUM([Sales])}` = grand total.
- **INCLUDE**: view dims + declared, re-aggregated up (responds to filters).
- **EXCLUDE**: view dims minus declared (always coarser, replicated; default ATTR).
- **% of total immune to filters**: `SUM([Sales])/SUM({FIXED:SUM([Sales])})`. If it won't sum to 100% under a filter -> add filter **to context**, or use EXCLUDE.
- Uses: dedup `{FIXED [Row ID]:MAX([Sales])}`; cohort `{FIXED [Customer]:MIN([Order Date])}`; orders/customer `{FIXED [Customer]:COUNTD([Order ID])}`; avg of aggregate `AVG({FIXED [Customer]:SUM([Sales])})`; record vs group avg `[Sales]-{FIXED [Customer]:AVG([Sales])}` (fixes mix aggregate/non-aggregate).

### Table calcs (run last; only see marks in view)
- Positional: `INDEX()`, `SIZE()`, `FIRST()`, `LAST()`.
- Navigation: `LOOKUP(expr,-1)`, `PREVIOUS_VALUE(expr)`.
- Running: `RUNNING_SUM/AVG/MIN/MAX/COUNT`.
- Window: `WINDOW_SUM/AVG/MIN/MAX/MEDIAN/COUNT/STDEV/VAR/PERCENTILE/CORR/COVAR(expr,[start,end])`.
- Rank: `RANK / RANK_DENSE / RANK_MODIFIED / RANK_UNIQUE / RANK_PERCENTILE (expr,'desc')`.
- `TOTAL(expr)`; `SCRIPT_REAL/INT/BOOL/STR` (R `.argN` / Python `_argN`); `MODEL_PERCENTILE/QUANTILE`.
- **Compute Using**: checked dims = addressing (direction); unchecked = partitioning (restart). Table/Pane/Cell + Specific Dimensions + "At the level" restart.
- **Quick Table Calcs**: Running Total, Difference, Percent Difference, Percent of Total, Rank, Percentile, Moving Average, YTD, CAGR, YoY Growth, YTD Growth. Running/Moving support a secondary calc.

### Function library
- Number: ABS CEILING FLOOR ROUND POWER SQRT EXP LN LOG SIGN DIV ZN PI; trig SIN COS TAN ATAN2 DEGREES RADIANS; HEXBINX/Y.
- String: LEFT RIGHT MID LEN CONTAINS STARTSWITH ENDSWITH FIND FINDNTH REPLACE SPLIT TRIM UPPER LOWER PROPER; regex `REGEXP_MATCH/EXTRACT/EXTRACT_NTH/REPLACE`.
- Date: DATEPART(number) DATENAME(string) DATEADD DATEDIFF DATETRUNC DATEPARSE MAKEDATE MAKETIME NOW TODAY YEAR/MONTH/DAY/WEEK ISO* ; parts 'year'/'quarter'/'month'/'week'/'day'/'weekday'/'hour'/'minute'/'second' + iso-*.
- Logical: `IF..ELSEIF..ELSE..END`, `CASE..WHEN..END` (exact match only), `IIF(test,then,else,[unknown])`, `IFNULL`, `ISNULL`, `ZN`, `IN (a,b,c)`, AND/OR/NOT.
- Aggregate: SUM AVG MIN MAX MEDIAN COUNT COUNTD PERCENTILE STDEV VAR CORR COVAR COLLECT; **ATTR** (returns `*` if multiple).
- Type: INT(truncates toward 0) FLOAT STR DATE DATETIME DATEPARSE MAKEPOINT MAKELINE.
- Spatial: MAKEPOINT MAKELINE DISTANCE BUFFER AREA LENGTH INTERSECTS OUTLINE SHAPETYPE.

### Bins / groups / aggregate-vs-row
Bins: right-click measure > Create > Bins. Groups: select members > Group (or `CASE`-based calc, more maintainable). "Cannot mix aggregate and non-aggregate" -> aggregate both sides (`SUM([Price]*[Qty])`) or wrap row-level in an LOD.

---

## 9. NEWEST FEATURES (2022-2026)

Public (free) gets the authoring ones; AI tier is Cloud + paid.
- **Dynamic Axis Titles (2023.1)**: Edit Axis > Axis Titles > Field (title follows a swap parameter). **Dynamic Axis Ranges (2023.1)**: Edit Axis > Range > Custom > parameter for min/max.
- **Image Role (2022.4)**: right-click string URL field > Image Role > URL; drag to a header. URLs png/jpg/svg/webp, <200KB, ~500/field. Headers only, not marks.
- **Viz Extensions (2024.2)**: Marks mark-type dropdown > Viz Extensions > Add (Tableau Exchange). Custom mark renderers (first-party Sankey, Table). Different from dashboard extensions (those are dashboard objects).
- **Dashboard Extensions**: Objects > Extension. Sandboxed (no network, default-on) vs Network-enabled (needs admin safelist).
- **Dynamic Zone Visibility (2022.3)**: see section 6.
- **Multi-fact relationships / multiple base tables (2024.2)**: stitch unrelated fact tables via shared dimensions (no blend). Drag 2nd table to New Base Table drop area; relate shared dims.
- **Tableau Pulse (2024.1, Cloud-only)**: metrics layer + AI insight digests (Slack/email). **Tableau Agent / Einstein Copilot (2024.2, Cloud web-authoring + Prep)**: NL -> viz + calc. Both paid, Einstein Trust Layer.
- **Explain Data (active)**: select a mark > Data Guide / right-click Explain Data; AI surfaces outliers/drivers. **Ask Data RETIRED** (2024). **Data Stories (auto-narrative) RETIRED 2025.1** -> replaced by Pulse / Dashboard Narratives. (Classic Story Points NOT retired.)
- **Workbook Optimizer (2022.1)**: Server > Run Optimizer. Take Action / Needs Review / Passed; some autofix.
- **Spatial**: Outline/ShapeType/Length funcs, GeoJSON, mixed geometry, spatial parameters. Accessible web authoring.
- **2025-2026 (Tableau Next)**: separate Salesforce-platform agentic line: Tableau Semantics (semantic layer), agent skills Data Pro / Concierge / Inspector. Paid, not Public.

## 10. STORY POINTS, PRESENTATION, EXPORT, PUBLIC SHARING

- **Story Points** (New Story tab): a sequence of captured viz states (vs dashboard = one simultaneous canvas). Drag sheet/dashboard onto the point; Add a caption. Toolbar: **Blank** (empty), **Duplicate** (clone current state), **Save as New** (clone-with-changes to NEW point), **Update** (overwrite current point). Layout tab: navigator style **Caption boxes / Numbers / Dots** + Show arrows toggle. Format > Story. Story doesn't support DZV / dynamic axes per point.
- **Presentation Mode**: Window > Presentation Mode (or F7); Esc exits. Web = Full Screen button.
- **Hide a sheet**: right-click tab > Hide Sheet (only sheets used in current dashboard).
- **Export (Desktop)**: File > Print to PDF (single-sheet PDF omits filters; put on a dashboard); File > Export As PowerPoint (one slide/sheet, story = one slide/point; size Fixed PowerPoint 1600x900); Worksheet > Export > Image / Crosstab to Excel.
- **Published Download button**: Image / Data (CSV) / Crosstab (CSV/Excel) / PDF / PowerPoint / Tableau Workbook (.twbx, exposes data) - all permission-gated.
- **Tableau Public sharing**: Share > Link / Embed Code (+embed params for toolbar/tabs). **Protect data**: Edit Details > uncheck "Allow others to download or explore... this workbook and its data" (default is downloadable!); uncheck "Show author profile link". Prior exposure isn't undone. Custom views = share a filtered state via unique link.

## 11. PERFORMANCE

- **Performance Recorder**: Help > Settings and Performance > Start/Stop Performance Recording. Records query exec/compile, geocoding, connect, layout, extract gen, blending, render. Sort Events by duration; click "Executing Query" to read SQL.
- **What's slow**: too many marks; high-cardinality quick filters; **"Only Relevant Values" filters** (re-query on every change -> use filter actions); nested LODs/table calcs; blends; (context filters no longer speed queries, only control order).
- **Extracts (.hyper, Hyper engine)**: biggest win when not needing live. Aggregate for visible dims + roll up dates; Hide All Unused Fields before extract; Compute Calculations Now (materialize). Fixed-size dashboards cache (Automatic re-renders). Fewer sheets. Prefer native groups/sets/bins/aliases over calcs.
- **Updates**: F10 toggle auto-updates (drop many pills without re-querying), F9 Run Update, F5 refresh data source.

## 12. KEYBOARD SHORTCUTS (Windows Desktop)

Swap rows/cols **Ctrl+W** · Show Me **Ctrl+1** · Presentation **F7** (Ctrl+H) · New worksheet **Ctrl+M** · Describe sheet **Ctrl+E** · Undo/Redo **Ctrl+Z/Y** · Toggle auto-update **F10** · Run update **F9** · Refresh source **F5** · Connect data **Ctrl+D** · Find in Data pane **Ctrl+F**.
Field placement (select field first): add to sheet **Enter** · Columns **Alt+Shift+C** · Rows **Alt+Shift+R** · Filters **Alt+Shift+F** · Color **Alt+Shift+O** · Label **Alt+Shift+T** · Detail **Alt+Shift+L** · Size **Alt+Shift+I** · Shape **Alt+Shift+S** · Pages **Alt+Shift+P**.
Pill tricks: **Ctrl+drag** copies a pill; **double-click empty shelf** = inline ad-hoc calc. Marks: **Ctrl+click** multi-select; selection **A** rectangular / **D** lasso / **S** radial. Cells **Ctrl+B / Ctrl+Shift+B** smaller/larger. Zoom: Shift+drag pan, Ctrl+Shift+drag zoom-area, Shift+double-click zoom out. Dashboard objects: Arrow 1px / Shift+Arrow 10px move, Alt+Arrow resize. Navigate sheets **Ctrl+Tab**. NO default hotkey for Duplicate Sheet or Keep Only/Exclude (use right-click / tooltip).

## 13. TABLEAU PREP + DATA CONNECTIONS

- **Prep Builder** (separate ETL product, .tfl flows): steps = Input, Clean (rename/filter/split/group/type), Pivot (cols<->rows, wildcard), Aggregate, Join, Union (manual/wildcard), Split, **Group/Cluster fuzzy** (pronunciation/spelling/common-chars), New Rows (fill sequence gaps), Script (Python TabPy / R Rserve), Output (.hyper/published/CSV/database). Profile pane = field histograms; Changes list = auditable. Incremental refresh (new rows by a field). Prep Conductor (paid Data Management add-on) schedules flows. Prep upstream when reused/heavy/scheduled; Desktop when view-specific/live.
- **Joins** (physical): Inner/Left/Right/Full + join calculations (non-equality); cross-database/federated. Fix grain at connect, can duplicate. **Relationships** (logical noodle, default): per-sheet join at query time, preserves grain, no fan-out. Order of preference: relationships > joins > blends.
- **Unions**: stack same-structure tables (manual or wildcard `*2016`). **Pivot**: cols->rows. **Data Interpreter**: clean messy Excel/CSV/PDF. **Split / Custom Split**. **Blending**: last resort, aggregate first. **Custom SQL** (Tableau wraps it, can be slow; prefer DB views) vs **Initial SQL** (runs once on connect). **Data source filters** (all sheets + shrink extract).
- **Connect pane**: To a File (Excel/csv/JSON/PDF/.hyper/stats/spatial), To a Server (SQL Server/Oracle/MySQL/Postgres/Snowflake/BigQuery/Redshift/Salesforce/JDBC-ODBC), Saved sources (.tds/.tdsx), Web Data Connector (moving to WDC 3.0 / Connector SDK). Public = files + some cloud, extract-only, public.

## Sources
All help.tableau.com (chart/map/marks/analytics/calc/format/actions/whatsnew/prep/performance sections), Trailhead
(data viz + dashboard trails), Flerlage Twins, The Information Lab, Playfair Data, The Data
School, Jim Dehner, Toan Hoang/Tableau Magic. Full URL lists captured in the 2026-06-04
research run.
