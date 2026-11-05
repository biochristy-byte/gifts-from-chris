# .twb XML: verified fragments and silent traps

Every item was proved by loading a file into Tableau Public 2026.1 and reading
the screen or Tableau's own save. None of the traps below logs an error: the
feature just does not happen. "GUI save" means copied from a file Tableau wrote
after a change made by hand. Placeholders: `{DS}` is the federated datasource
name, `{GUID}` a window uuid.

## Load failures (error D2E8DA72) and how to bisect

Copy the failing file, remove one suspect, reopen. Repeat until it loads.

1. **Action order.** A plain `<action>` (filter or URL) that comes AFTER an
   `<edit-parameter-action>` fails the whole load. Plain actions go first inside
   `<actions>`.
2. **Map lock without its manifest flags.** A worksheet `<viewpoint>` map lock
   fails unless `<document-format-change-manifest>` carries both
   `<LayerControlWidget />` and `<MapboxVectorStylesAndLayers />`. Without the
   second, `map-style='dark'` loads but renders the LIGHT map.
3. **Missing button flags.** Navigation buttons need `<BasicButtonObject />` and
   `<BasicButtonObjectTextSupport />`, or the load fails with "no declaration
   found for element 'button'". The manifest is not decoration: copy the whole
   block from a template Tableau authored.
4. **Button child order is schema-ordered:** caption, image-path, tooltip-text,
   button-caption-font-style, format. A well-formed file with `tooltip-text` last
   was refused.
5. **Duplicate window names** fail with "duplicate identity constraint".
6. **A copied worksheet** needs new `simple-id` uuids.
7. `<column-instance>` elements go after `<column>` and before `<drill-paths>`,
   or before `<extract>` when there are none (schema order).

## Silent traps

### Colors

A mark color assignment lives on the DATASOURCE, in a `<style>` right after
`<layout .../>`, and needs three things. Tableau reports nothing when one is
missing: it drops the whole `<style>` and every mark falls back to the default
10-color palette.

```xml
<column datatype='string' name='[Who Fired]' role='dimension' type='nominal' />
<column-instance column='[Who Fired]' derivation='None' name='[none:Who Fired:nk]'
                 pivot='key' type='nominal' />
<extract ...>...</extract>
<layout dim-ordering='alphabetic' measure-ordering='alphabetic' show-structure='true' />
<style><style-rule element='mark'>
  <encoding attr='color' field='[none:Who Fired:nk]' palette='seattle_grays_10_0' type='palette'>
    <map to='#a8231c'><bucket>&quot;Someone shot&quot;</bucket></map>
  </encoding>
</style-rule></style>
```

1. The `<column>` AND the `<column-instance>` declared at datasource level,
   before `<extract>`. This one cost hours.
2. A `palette='...'` naming a STOCK palette id (`seattle_grays_10_0`,
   `tableau10`). A workbook-local `<color-palette>` resolves for an interpolated
   ramp but NOT for a categorical `type='palette'` encoding. Every value carries an
   explicit `<map>`, so the stock colors are never seen.
3. Tokens inside the datasource block carry NO federated prefix.

Also: Tableau prunes a `<color-palette>` nothing references. On a bar sheet,
remove the pane's fixed `mark-color` or it wins over the palette.

### Table calcs leak across the workbook

Column-instance names resolve across the WORKBOOK, not per worksheet. A
percent-of-total instance must be named `[pcto:sum:Incidents:qk]`, NOT
`[sum:Incidents:qk]`. Reusing the plain name put the table calc on every later
sheet's `SUM(Incidents)`: one bar chart silently drew percentages, and sorts on
`SUM(Incidents)` became sorts on a table calc, which is invalid, so the
dimension pill went red and the sheet rendered blank. The only trace was one
log line: `InvalidField ... The sort on X is invalid.`

```xml
<column-instance column='[Incidents]' derivation='Sum' name='[pcto:sum:Incidents:qk]'
                 pivot='key' type='quantitative'>
  <table-calc ordering-type='Rows' type='PctTotal' />
</column-instance>
```

### Shelves

- `(A / B)` on a shelf is not nesting; Tableau rewrites it. Use `*` with the OUTER
  field first: `(Year * Month)`.
- An integer field is a `:qk` token, and a `:qk` on a shelf renders as a
  CONTINUOUS AXIS, which always sits innermost. A year slid inside Month. Put
  `STR([Year])` on the shelf: discrete, stays where put, sorts chronologically.

### Filters

A one-member filter, in the only shape that works:

```xml
<filter class='categorical' column='[federated.x].[none:Has Subject:nk]'>
  <groupfilter function='member' level='[none:Has Subject:nk]' member='&quot;Yes&quot;' />
</filter>
```

No `user:*` attributes, a SHORT level token, no wrapper. Wrapping it in
`<groupfilter function='union' user:op='manual'>` is rejected with a Warning
dialog; `user:*` attributes on the member load clean and then filter EVERY row
away.

A quick filter's HOST sheet must sit on the same dashboard as a SHEET zone. When
it does not, the editor draws empty space where the filter should be, and a GUI
save DELETES such zones. Fix: a 1 px zone of the host sheet on that page. On
first open, only the active dashboard renders before the other sheets exist, so a
filter hosted by a sheet on another page can come up blank: keep the host on
page one, and make only that window `maximized='true'`.

`(All)` cannot be aliased on a dropdown filter card. A numeric filter's "N nulls"
badge goes away with `<filter class='quantitative' column='...'
included-values='non-null' />`.

### Tooltips and line breaks

- A line break in a text zone or tooltip is `<run>Æ&#10;</run>` (an AE ligature
  then a newline). A bare `<run>&#10;</run>` is silently dropped. Keep script
  output ASCII: Git Bash prints the Æ as a replacement character.
- A tooltip line naming a field that is NOT in its pane's view kills the WHOLE
  tooltip. On a dual axis a Columns measure belongs only to the pane whose
  `x-axis-name` it is. Put each tooltip measure in that pane's encodings as
  `<tooltip column=../>`, after color, size and shape.
- A DIMENSION on a pane's Tooltip shelf, when the pane colors by another field,
  blanked the entire sheet, headers and all. A discrete dimension on Tooltip
  loaded as a red invalid pill. Auto-add measures only; use `<lod>` (Detail)
  for dimensions, which can still be read inside the tooltip text.
- On polygons the value is constant per segment: use `[min:value:qk]`, since SUM
  multiplies by the vertex count.
- A straight `"` at the start of a formatted-text run renders as a CLOSING curly
  quote. Write U+201C and U+201D yourself.
- A run made only of whitespace is stripped on load. Put the gap inside a run
  with visible content, or use U+00A0 (non-breaking space). A GUI save strips
  whitespace-only spacer runs of their font size.

### Transparency

A `#00000000` sheet background renders opaque WHITE unless the manifest lists
`<WorksheetBackgroundTransparency />`. Row banding needs `band-color`
`#00000000` on the table and pane rules too. Over a transparent sheet ground,
unselected marks fade toward white: give the sheet a solid ground if you rely on
selection.

### Maps

- The background map switch is a `<mapsources>` element, in two places: at
  workbook level right after `</datasources>`, and inside the map worksheet's
  `<view>`. `<style-rule element='map'><format attr='map-style' .../>` alone is
  dropped. `washout` on that rule is kept.

```xml
<mapsources><mapsource name='Tableau' /></mapsources>
```

- Dark map: three rules needed together (`map-layer` enables, `map` with
  `map-style='dark'`, `map-data-layer`). The `map` rule alone rendered light.
- Lock the map (no search, toolbar, pan, zoom) on BOTH the worksheet window's
  `<viewpoint>` and the dashboard window's `<viewpoints>` entry for that sheet:

```xml
<viewpoint><floating-toolbar-visibility value='2' /><geo-search-visibility value='1' />
  <map-navigation value='1' /><layer-control toolbar-button-enabled='false' /></viewpoint>
```

- A fixed degree range is IGNORED on a map. A GUI zoom then save stores the frame
  in Web Mercator metres; that form holds (`projection='EPSG:3857'
  range-type='fixed'` on the lon and lat `space` encodings).
- The automatic map halo draws a dark square round custom shapes:
  `<format attr='has-halo' value='false' />` on the pane mark.
- Size range: `<encoding attr='size' ... max-size='1' min-size='0.005'
  type='centersize' />` makes sizes grow from zero. The FIRST item of a manual
  sort on the shape field draws on top.
- Geographic role attribute is `semantic-role='[State].[Name]'`, not `geo-role`.
  A non-map source with a Country column gets a guessed geographic role: strip it.
- Mapbox tile labels are tile text, not in the file, and cannot be contrast
  gated from the XML (measured 1.4:1 on a dark tile).

### Selection

- Clicking a mark dims every other mark until the viewer clicks empty space. Tried
  and NOT effective: `fog-desaturation-*` and `fog-bg-color` on every element,
  `selection-relaxation-disallow`. Effective but costly: `<pane inert='true'>`
  needs the `<Layers />` flag and kills hover tooltips and click actions too.
- The True/False auto-deselect trick (a self-filter action on two constant
  calcs) did not clear selection in 2026.1.
- Faded unselected headers can drop to 1.57:1 contrast. The fade multiplies a
  color's distance from the card by about 0.26, so no base color survives it. Fix:
  one single-mark sheet per option and one parameter action per sheet, all
  setting the same parameter. A click selects the only mark, so nothing fades.
- A parameter RADIO list zone only changes on a click on the radio circle, not
  its label. A list parameter's radio list always stacks (about 33 px per item at
  11 pt).
- Filter action "Show all values" is `<param name='on-empty' value='all' />`;
  `none` left the target EMPTY after a second click on the same bar.
  Parameter action clear option `do-nothing` keeps the value after a click on
  empty space.

### Sizes and text layout

- A BAN tile hashes out on HEIGHT. 24 pt fit a 118 px band; 30 pt did not.
- Dashboard text zones truncate with ".." when the next line does not fit the
  zone height; they do not grow. Allow about 25 px per 9 to 10 pt line plus wrap.
- A header holds about 1.45x its Arial width plus 10 px; a dashboard text zone
  about 1.6x. Add slack past the estimate: an average-width estimate fit "Cohort"
  to the pixel and Tableau cut "Wards" (same length, wider letters) to "Wa..".
- Text table row height is a CELL format keyed to the innermost row field:
  `<style-rule element='cell'><format attr='height' field='[ds].[none:Lockdown:nk]'
  value='246' /><format attr='wrap' value='on' />`. A bare `height` on the cell,
  or a header height, is ignored.
- Mark label number format (`p0%`) goes on `element='cell'` or the datasource
  column's `default-format`. On `element='label'` alone it formats the HEADERS.
  `<style-rule element='label'>` styles row and column headers; mark label ink is
  `element='datalabel'` with `color-mode='user'`.
- A text table shows column names only when `display-field-labels scope='rows'`
  is `true`; it is a per-sheet flag. To HIDE field labels use
  `<style-rule element='worksheet'><format attr='display-field-labels'
  scope='rows' value='false' />`, not `element='label'` (that hides the header).
- A row header is hidden with `<style-rule element='label'><format attr='display'
  field='...' value='false' />`.
- Label right of a circle: pane cell rule `text-align='right'`; widen the axis so
  the longest label fits or Tableau slides it back over the mark.
- Column dividers draw n + 1 lines.
- Bar thickness: a pane mark rule `<format attr='size' value=.. />` (not linear).
- Stacked bar order: the FIRST member of a manual color sort is drawn OUTERMOST.
- Single-segment stacked bars print the count twice (segment plus total). Label
  calc `IF MIN({FIXED [dim] : COUNTD([color])}) > 1 THEN SUM([w]) END` on Text.
- `STR()` of a float prints 87.700000: format it by hand.
- Null alias: `<alias key='%null%' value=' ' />` (bare key; string keys are quoted).
- A null position on a constant-position text pane shows a ">N nulls" indicator.
  Blank the label calc instead.

### The workbook reads the extract, not the CSV

Regenerating the CSV changes nothing on screen: the `.hyper` files are what the
workbook queries. Rewrite them from the CSV with the schema read back from the
existing extract, so a column that vanished from the CSV is RED rather than a
quietly narrower extract.

### Custom shapes and packaging

- File > Save As `.twbx` embeds every custom shape in use as base64 in
  `<external><shapes>` at the end of the twb. Packaging without the GUI means
  rewriting each extract `dbname` to `Data/extracts/<name>.hyper`, each
  background `param` to `Image/...`, and embedding the shapes.
- A PIL resize of an RGBA image sets the RGB of fully transparent pixels to
  black, and Tableau's scaling bleeds a dark fringe round the shape. Refill
  transparent pixels with the shape's own color after every resize.
- A polygon sheet from precomputed vertices works with plain fields: Rows
  `[avg:y:qk]`, Columns `[avg:x:qk]`, color a dimension, Path a point-order field
  declared as an integer CONTINUOUS DIMENSION.

## Verified fragments

### Navigation button (page arrows)

A button is a dashboard-object zone. `window-id` is the uuid of the target
dashboard's `<window>`, so generate `<windows>` first and reuse the uuids. The
image path resolves inside the `.twbx`. No `<image-path>` renders a text button.

```xml
<zone h='5000' id='29' type-v2='dashboard-object' w='4000' x='88800' y='3000'>
  <button action='tabdoc:goto-sheet window-id="{GUID}"'>
    <button-visual-state>
      <image-path>Image/arrow.png</image-path>
      <tooltip-text>Detail</tooltip-text>
    </button-visual-state>
  </button>
</zone>
```

Button captions take `fontname='Tableau Bold'` in `<button-caption-font-style>`.

### Dashboard shell and title bar

```xml
<dashboard enable-sort-zone-taborder='true' name='KPIs'>
  <style />
  <size maxheight='800' maxwidth='1000' minheight='800' minwidth='1000' />
  <zones>
    <zone h='98000' id='3' param='vert' type-v2='layout-flow' w='98400' x='800' y='1000'>
      <zone fixed-size='66' id='5' is-fixed='true' type-v2='text' .../>
      <zone-style><format attr='background-color' value='#b4b4b4' /></zone-style>
    </zone>
  </zones>
</dashboard>
```

`fixed-size` plus `is-fixed='true'` pins a band's height in pixels; everything
else shares the rest. `show-title='false'` hides a sheet caption. A title run:

```xml
<run bold='true' fontalignment='1' fontcolor='#ffffff' fontname='Tableau Semibold' fontsize='22'>Title</run>
```

`fontalignment`: 1 centers, 2 right-aligns, absent is left. Several runs in one
`<formatted-text>` give mixed sizes and colors in one zone. Right-aligned text
zone: `<style-rule element='dash-text'><format attr='text-align' id='dash-text_<zoneid>'
value='right' /></style-rule>` in the dashboard style.

### BAN tile (big number)

Empty `<rows />` and `<cols />`, a Text encoding on the measure, a
`<customized-label>` with a bold number run, a `Æ&#10;` break run, then a smaller
caption run. Number formats: `c"$"#,##0,.0K;("$"#,##0,.0K)` for abbreviated
thousands, `n#,##0` for an integer.

### Actions

```xml
<action caption='Highlight' name='[Action13_x]'>
  <activation auto-clear='true' type='on-select' />
  <source dashboard='Detail' type='sheet' worksheet='Drill In' />
  <command command='tsc:brush'>
    <param name='exclude' value='KPI: Avg Cost,KPI: Avg Wait' />
    <param name='field-captions' value='T' />
    <param name='target' value='Detail' />
  </command>
</action>
```

Filter is the same with `command='tsc:tsl-filter'` and `special-fields` `all`.
Parameter action is its own element:

```xml
<edit-parameter-action caption='Pick' name='[Action10_x]'>
  <activation type='on-select' />
  <source type='sheet' worksheet='Drill In' />
  <agg-type type='attr' />
  <clear-option type='assign-fixed-value' value='s:LROOT:None' />
  <params>
    <param name='source-field' value='[{DS}].[none:Initial Diagnosis:nk]' />
    <param name='target-parameter' value='[Parameters].[Parameter 3]' />
  </params>
</edit-parameter-action>
```

URL action (no `url-action-type` element): `<action><activation type='on-select'
/><source .../><link caption='..' expression='&lt;[ds].[url]&gt;' /></action>`. A
mark whose url is empty opens nothing. Cross-dashboard filter action: the link
expression is `tsl:{target dashboard}?..`, the exclude list names the other
sheets on the TARGET page.

### Filters, parameters, phone layout

```xml
<filter class='categorical' column='[{DS}].[none:Department:nk]' filter-group='101'>
  <groupfilter function='member' level='[none:Department:nk]'
               member='&quot;Cardiology&quot;' user:ui-domain='database'
               user:ui-enumeration='inclusive' user:ui-marker='enumerate' />
</filter>
```

`function='level-members'` with `user:ui-enumeration='all'` is "(All)". Filter
card zones: `mode='checkdropdown'` (multi) or `mode='dropdown'` (single), a 30 px
box that starts at its zone's top edge. List parameter:

```xml
<column caption='Diagnosis' datatype='string' name='[Parameter 3]' param-domain-type='list'
        role='measure' type='nominal' value='&quot;None&quot;'>
  <calculation class='tableau' formula='&quot;None&quot;' />
  <members><member value='&quot;Anxiety&quot;' /><member value='&quot;None&quot;' /></members>
</column>
```

Parameter members are the display words: no list-parameter member alias exists.
Phone layout: one `<devicelayout auto-generated='true' name='Phone'>` per
dashboard with `<size ... sizing-mode='vscroll'/>`, reusing the desktop zone ids
restacked vertically with pinned heights.

### Background, glass panel, icons

```xml
<zone fixed-size='498' is-fixed='true' is-scaled='1' param='Image/background.jpg'
      type-v2='bitmap' h='100000' w='100000' x='0' y='0' />
```

```xml
<zone-style>
  <format attr='background-color' value='#f5f5f584' />
  <format attr='border-color' value='#d4d4d4' />
  <format attr='border-style' value='solid' />
  <format attr='border-width' value='2' />
  <format attr='margin' value='4' />
  <_.fcp.DashboardRoundedCorners.true...format attr='corner-radius-top-left' value='15' />
</zone-style>
```

The alpha byte of the 8-digit hex is the whole trick. A clickable image zone is
`type-v2='bitmap'` with a `url=` attribute.

### Dynamic zone visibility

Per zone: `<dashboard-zone-visibility-node dashboard-identifier='{DASH}'
zone-id='{N}' visibility-input-guid='{GUID}' />`. At workbook level a
`<datagraph>` after `<windows>`: one `single-value-field-node` per boolean calc,
one `dashboard-zone-visibility-node` per zone, an `<edge from='{value-output-guid}'
to='{visibility-input-guid}' />` per pair, all in `node-execution-subgraphs` under
one subgraph guid. Manifest flags: `DatagraphCoreV1`,
`DatagraphNodeDashboardZoneVisibilityV1`, `DatagraphNodeSingleValueFieldV1`,
`ZoneVisibilityControl`. Remove the flags (and `ParameterAction*`) when you drop
the feature, and the workbook loads without them.

### Fixed text columns beside a bar

A synchronized dual axis whose second measure is a CONSTANT position
(`IF MIN([valence]) = 'push' THEN -135 ELSE 235 END`), a Text mark in that pane
with `<view><breakdown value='off' /></view>` (otherwise Tableau stacks the text
marks like the bars), `text-align` on the pane cell rule, both axes hidden, a
fixed axis range that leaves the gutters.

### Other course-era shapes (schema unchanged)

Dual axis: two measures in `<rows>` joined with `+`, then a `<pane id='1'
y-axis-name='...'>` per measure. Table calc `PctTotal` with
`ordering-type='Columns'`. Highlight table: `<mark class='Square' />` with color
and text on the same measure. Manual sort: `<sort class='manual'><dictionary>`;
computed sort: `<sort class='computed' ... using=measure>`. Number formats:
`default-format='p0%'`, `'n#,##0'`, `'*00000'`. A custom multi-stop palette is
`<color-palette custom='true'>` with 2 to 8 hex stops.

## Sources of truth

Copy the whole `<document-format-change-manifest>` block from a template
Tableau authored for your version. Header used here:
`version='18.1' source-build='2026.1.1'`. Rounded corners are a vendor-namespaced
element name copied verbatim from a GUI save. If you need a shape not listed
here, produce it in the GUI once and diff the saved file.
