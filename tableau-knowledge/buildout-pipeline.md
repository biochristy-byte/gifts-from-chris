# Building Tableau workbooks with Claude: the pipeline that works

Claude cannot click through Tableau, and there is no authoring API for Tableau
Public (its REST API is read-only: list, download, metadata). Server and Cloud
publishing is paid and query-only. What does work:

> **Tableau authors the template, Claude injects the charts into its XML, you
> open the result, polish if needed, and YOU click publish.**

That last click must be human. See [never-ctrl-s-on-public.md](never-ctrl-s-on-public.md).

## File format in two lines

- `.twb` is XML. `.twbx` is an unencrypted ZIP: the `.twb` at the root plus `Data/`
  (extracts, CSVs) and `Image/` (backgrounds, icons, buttons).
- Every GUI save you keep should be a `.twbx`. A bare `.twb` has instructions but
  no data and is a generator input only.

## Why not write the whole .twb by hand

Hand-writing a `.twb` from scratch failed: the upgrader crashes on old version
strings, and a native current-version datasource needs a huge boilerplate. You
can hand-generate a tiny one (one datasource, one worksheet, minimal windows, no
dashboards) but the top failure modes are ID consistency across federated and
textscan tokens, and the declare-the-`<column-instance>`-before-you-reference-it
rule.

## The pipeline

1. **Shape the data to the grain you want, in code.** One row per observation.
   Do NOT rely on an in-Tableau filter over an integer field: the datasource types
   it as a measure and the discrete filter token will not resolve ("field included
   for filtering does not exist"). Pre-filter in the data. Aggregates and
   individuals are different grains: never join them (it double-counts), keep them
   in separate data sources on separate sheets.
2. **Let Tableau author the template.** Launch Tableau with the CSV as an
   argument so it builds a valid datasource and extract, then File > Save As a
   local `.twb`. Public Edition REQUIRES an extract even to open a workbook, so
   keep it. A live-CSV workbook errors with "must use extracts".
3. **Mutate the template with a script** (the "injector"). Keep the datasource,
   the extract and the boilerplate verbatim. Replace `<worksheets>`, add
   `<dashboards>`, regenerate `<windows>` (one per sheet plus one per dashboard).
4. **Open it, look at it, polish in the GUI if you must, Save As `.twbx`.**
   Re-author the template whenever you add a column to the CSV: the build packs
   the template's `.hyper`, which does not have the new column until Tableau
   re-extracts it.
5. **Gate it.** Check the XML before you open it (see below), and compare
   rendered screenshots after.

## Injector structure that loads

- `<view>` must end with `<aggregation value='true' />`.
- `<table>` needs `<style />` before `<panes>`.
- `<worksheet>` child order is `layout-options?, table, simple-id`. Layout options
  go BEFORE `<table>`.
- A complete datasource needs one `<metadata-records>` entry per column,
  `<aliases>` and datasource-level `<column>` semantic entries. Tableau authors
  these; keep them.
- Field token grammar: `[ds].[deriv:field:suffix]`. `deriv` is none, sum, avg,
  cnt, min. `suffix` is nk (nominal), ok (ordinal), qk (quantitative). Every
  token used must be declared as a `<column-instance>` in
  `<datasource-dependencies>` first.
- A flow dashboard is `layout-basic > layout-flow > worksheet leaf zones`, with
  coordinates on a 0..100000 grid per dashboard.
- Pie wedge size is `<wedge-size>`, not `<angle>`.
- A copied worksheet needs fresh `simple-id` uuids or the load fails.
- A worksheet may not share a name with a dashboard (duplicate identity
  constraint). Assert that every window name is unique.
- Use ids well above Tableau's own for `filter-group` (101, 102, ...). With 1, 2,
  3 a GUI Save As dropped group 1 and rewrote group 2's column without its
  datasource prefix.

## Multiple datasources in one workbook

Take each Tableau-authored template's `<datasource>...</datasource>` block (each
keeps its own `.hyper`) and put BOTH in one `<datasources>`. Worksheets reference
their own datasource id. Save As `.twbx` bundles both extracts permanently
(temporary hypers are fragile).

## Charts Tableau cannot draw: precompute the geometry

Radial bars, sunbursts, Venn diagrams, streams and word clouds are polygons or
scatters whose coordinates you compute in Python. A wedge is an annular sector
(inner arc out, outer arc back). Plot as `<mark class='Polygon'>`, x on Columns,
y on Rows (raw `[none:x:qk]`), a point-order field on Path, a segment id on Detail
(`lod`). Sqrt-scale radial lengths so small categories stay visible. Two charts
in one sheet: offset their X in the data. For round circles the zone aspect must
match the data aspect: measure `x span / y span` and size the zone to it. A
scatter with both axes fixed to the same range and hidden, in a square zone, maps
data units to pixels exactly.

## Hiding things from code

Gridlines and axes can be hidden without the GUI (learned by formatting once by
hand and reading the saved file):

```xml
<style-rule element='gridline'><format attr='stroke-size' value='0' /><format attr='line-visibility' value='off' /></style-rule>
<style-rule element='zeroline'><format attr='stroke-size' value='0' /><format attr='line-visibility' value='off' /></style-rule>
<style-rule element='axis'>
  <format attr='display' field='[ds].[none:x:qk]' scope='cols' value='false' />
  <format attr='display' field='[ds].[none:y:qk]' scope='rows' value='false' />
</style-rule>
```

`grid-line` and `zero-line` with a hyphen are invalid. A hidden axis can still
draw its ruler: add `line-visibility off` and `stroke-size 0` for both scopes.

## How to get an answer out of Tableau in five minutes

When an XML shape will not load or renders wrong, do the thing in the GUI, File >
Save As a scratch `.twbx`, unzip it, and diff that region against your output.
Tableau pretty-prints its save, so `ET.parse` plus a child-tag list finds a
missing element fast. Tableau Public also ships its workbook XSDs as plain text
inside `bin\res\tablangres.rcc`: search it for an attribute name to get its type,
enum values, siblings, and the `document-format-change-manifest` flag it needs.
The log is `Documents\My Tableau Repository\Logs\log.txt`.

## Driving the GUI when XML cannot do it

Tableau is a Qt app, so element automation fails on the canvas and menus.

- Make the Python process DPI-aware first:
  `ctypes.windll.shcore.SetProcessDpiAwareness(2)`. Then `pywinauto` click
  coordinates match a screenshot 1:1.
- Standard Win32 dialogs (Save As) DO automate: set the Edit field to a full
  path, click `&Save`.
- Menus by keyboard: focus the Tableau window, `send_keys("%f")`, `"a"`,
  `"{ENTER}"` for File > Save As. Never `^s` (see the safety page).
- Rhythm: click, screenshot, read it, next click.
- Foreground guard: before any scripted click or key, refuse unless the Tableau
  window is the foreground window. A click once landed on a terminal being typed in.
- Find Tableau by PROCESS (`tableau.exe`, `tabpublic.exe`), not window title. A
  title match also hits an editor or browser tab that mentions Tableau.
- Presentation mode (F7) is the true 1:1 render. The edit canvas scales the
  dashboard and mis-sizes type. Wait 3 s or more after navigating before a
  screenshot: a late page can draw blank. Check the shot is the size you expect
  before clicking, since F7 can miss right after an open.
- Park the mouse off the dashboard before a pixel diff: a resting mouse puts a
  frame on a button.
- Tableau holds an exclusive lock on an open `.hyper`. Refuse to refresh extracts
  while it runs instead of surfacing a wall of HyperException.
- A hidden dialog can block the next run: after killing a changed workbook, the
  next start offers a File Recovery dialog. Close it explicitly before driving.
- Tableau rounds zone x/y/w/h by 1 to 2 units of 100000 on save.
- Save As stores the CURRENT parameter value and the active sheet. Save from a
  fresh open on the first page, never after clicking around. Overwrite check:
  compare timestamp and a hash before and after, since "file exists" is already
  true before an overwrite.

## Rendering facts that change layout math

- A fixed dashboard lays out in device pixels but renders type at the system DPI.
  On a 150% display 1 pt of type is about 2 px, on the web about 1.33. Budget
  about 2.4 px per pt for a one-line text zone, 3.0 px per pt per wrapped line.
  A zone one line too short shows ".." in place of the last line.
- Mark sizes are absolute pixels and do not grow with the dashboard. A shape's
  width is linear in its size value, a circle's area goes with size squared.
- A BAN tile (big number) hashes out (`###`) when the label is too TALL for the
  cell, not too wide. Widening makes it worse.
- Tableau underlines a hovered Text mark below the label's line box, and paints
  the ROW HEADER of a hovered field bright yellow. The fix for the yellow header
  is a calculated COPY of the field on Rows and the real field on Detail or Color,
  with the hover keyed to the real field's caption.
- Text marks take color ONLY from a Color encoding. A pane `mark-color` is ignored.
- Mark labels of a stacked bar: put the total past the bar end on a dual axis
  with an invisible Circle, rather than a number on a small segment.

## Gate your own work

Everything above fails silently. Build the checks into the generator:

- XML gates: unique window names, filter hosts present as sheet zones, every
  token declared, tooltip fields present in their pane.
- Rendered gates: screenshots diffed against the previous build, contrast
  measured on rendered pixels, not just on the colors in the XML.
- Every gate needs a **control that must fail**: restore the old broken shape and
  prove the gate goes red. A gate that cannot fail proves nothing.
- Report what the gate examined. A gate over zero subjects must be RED or SKIP,
  never a green PASS.

See [xml-traps.md](xml-traps.md) for the silent-failure catalogue.
