# Garden Petals: a Tableau viz extension

One flower per row of your data, one petal per category, petal length set by a
measure. Three views of the same garden: a grid, a garden map that plants each
flower at its location, and an altitude view. On top of that: reference
outlines, glow and wilt for petals past a threshold, shape-twin bees for flowers
that look alike, and a close-up bloom you open with a click. Everything is
adjustable from a settings panel inside the viz. Free, MIT licensed, and it
runs in the free edition of Tableau Desktop.

The code is a worked example of the hard parts of a viz extension, so it doubles
as a template. The lessons are written up in
[`../tableau-knowledge/viz-extensions.md`](../tableau-knowledge/viz-extensions.md).

## What you put on the Marks card

| Shelf | Type | Example | Needed |
| --- | --- | --- | --- |
| Flower | dimension | Country | yes |
| Petal | dimension | Metric | yes |
| Length | measure | Value | yes |
| Score | measure | one number per flower | no |

Four shelves is the most Tableau allows an extension. Everything else is read
from the **Detail** shelf and matched by field name: Region or Group, a
reference value (named like `OECD Value` or `Reference`), Rank, a hex color,
Latitude and Longitude, a sampling caution flag, and score fields for the
tooltip. You can also pick fields by hand on the settings panel's Fields tab.

**Where flowers go on the garden map.** Tableau does not hand an extension its
generated latitude and longitude. If the view has no Latitude and Longitude
fields, `src/gazetteer.js` looks the flower's name up in a built-in list of about
200 country and territory centres. A name it cannot place falls back to the grid
instead of failing. `src/land.js` is the coastline behind the map (110 m world
outline, derived from public-domain Natural Earth data).

## What else you need

| You need | Why |
| --- | --- |
| **Tableau Desktop 2024.2 or newer** | The viz extension minimum. Free Edition works. |
| **Windows PowerShell, or any static server** | Tableau loads the extension page from a web address. `Start-Petals.bat` serves this folder on port 8767 with nothing installed. |
| **One file from Tableau** | The Extensions API library. It is Tableau's, so it is not here. See [`lib/README.md`](lib/README.md). |
| **Python 3** (optional) | Only for the tools in `tools/`. |

## Install

1. Get the library: follow [`lib/README.md`](lib/README.md) so that
   `lib/tableau.extensions.1.latest.min.js` exists.
2. Double-click `Start-Petals.bat` (or run `python -m http.server 8767` in this
   folder). Leave the window open while Tableau uses the chart.
3. In Tableau, build a sheet with a dimension and a measure. Marks card, mark
   type dropdown, **Viz Extensions**, **Add Extension**,
   **Access Local Viz Extensions**, pick `garden-petals.trex`, click **Allow**.
4. Drop Flower, Petal, Length (and Score) on the shelves. Click the gear at the
   top right of the viz for every setting.

If port 8767 is taken, pick another and change it in the server command and in
the `<url>` line of `garden-petals.trex`. Tableau reads the manifest only when
the extension is added, so remove and re-add the extension after editing it.

## Rebuild the PISA dashboard

[`example-pisa/`](example-pisa/README.md) has the data script, the exact dark settings and the
shelf-by-shelf steps for the Makeover Monday 2026 week 44 garden.

## Try it without Tableau

`dev/` is a mock of the Extensions API, enough to run the whole viz in a plain
browser:

```bash
python -m http.server 8767
# open http://localhost:8767/dev/dev.html?fresh=1
```

The mock enforces the rules that bite in the real thing: a second data reader
opened before the first is released throws, settings come back as strings,
data arrives in 10,000-row pages, and column names look like Tableau's
(`SUM(Value)`). Add `?page=20` to the address to force many small pages. The
fixtures are made-up numbers. `?fresh=1` ignores settings saved from an earlier visit. If port 8767 is busy, use another port in both places. To use your own long-format CSV:

```bash
python tools/make_fixtures.py my_data.csv     # needs Country, Metric, Value
```

The mock proves our side of the contract. It does not prove Tableau drives the
extension correctly: that took a run in real Tableau.

## Share it

```bash
python tools/package.py --base https://your-host/petals   # needs lib/ filled in first
```

builds `dist/garden-petals-viz-extension-<version>.zip` with the manifest URL
rewritten. Tableau allows plain HTTP for localhost only, so any other host must
be HTTPS. See the open question about Tableau Public in
[`../tableau-knowledge/viz-extensions.md`](../tableau-knowledge/viz-extensions.md).

## Driving Tableau from a script (optional)

`tools/` has small Windows drivers that I used to test inside real Tableau:

| Tool | What it does |
| --- | --- |
| `tabshot.py` | Screenshot the Tableau window. Finds it by process, never by window title. Read-only. |
| `tabdrive.py` | Click by name or by window-relative pixel, type, send keys, dump the accessibility tree. Screenshots after every step. |
| `tabdrag.py` | Drag one field onto one shelf, scaled to the window width. |
| `reload_ext.sh` | An example of the reload sequence. Coordinates are one machine's: measure your own. |

`pip install pywinauto psutil pillow` first. **Safety:** `tabdrive.py` refuses
to send Ctrl+S, Alt+F then S, and their variants, in both `key` and `type`,
and never closes Tableau. In Tableau Public, Ctrl+S means "Save to Tableau
Public" and a remembered sign-in publishes with no password prompt. A driver once
put a broken workbook live that way. Saving is left to a person. Screenshots
land in `_shots/`, which is git-ignored: they can show anything on your screen.

## Gotchas this code already handles

- **Settings are strings.** Tableau stores extension settings as strings only,
  so each settings section is saved as one JSON string and coerced back by type
  on load (`src/viz.js`, `coerce`).
- **One reader at a time.** Only one data reader may be open per worksheet. Reads
  are queued, and the reader is released on success and on error.
- **Detail fields arrive as ordinary columns** in the summary data, with
  aggregated names like `SUM(Score)`. Names are matched with the aggregation
  stripped.
- **ResizeObserver loop.** At high display scaling (144 DPI) the stage's
  scrollbars flip-flopped and blanked the map. Fix: `overflow: hidden` outside
  the grid view, and a requestAnimationFrame-deferred size-change guard
  (`src/engine.js`).
- **Reloading the extension page.** Tab toggles and F5 do not reload it. Clicking
  the extension's name again in the Viz Extensions menu does, and it resets
  settings to defaults for a moment; Ctrl+Z restores the saved ones. Switching the
  mark type away and back drops the shelves and settings.
- **No sliders.** Every number is a box you type into or step with the arrows.

## Layout

```
garden-petals.trex   the manifest (4 encodings, full-data permission, localhost:8767)
src/                 index.html, engine.js (renderer), viz.js (Tableau adapter),
                     settings-panel.js, gazetteer.js, land.js
dev/                 mock Tableau and made-up fixtures
tools/               package.py, make_fixtures.py, Tableau drivers
lib/                 empty on purpose: add Tableau's library here
```

`src/index.html` loads three Google Fonts from fonts.googleapis.com. Host them
yourself if the extension must work offline.

## License

MIT, see the repo's [LICENSE](../LICENSE). Tableau's Extensions API library is
Tableau's and is not included.
