# Tableau viz extensions: what is true, and what bites

A viz extension adds a new mark type to the Marks card, drawn by a web page you
host. Two working examples live in this repo:
[`tableau-lollipop`](../tableau-lollipop/README.md) and
[`tableau-garden-petals`](../tableau-garden-petals/README.md).

## What was proven by doing

- **Tableau Desktop Free Edition runs custom viz extensions** (tested on 2026.2,
  unlicensed). No Creator license, no Tableau Cloud site, no Developer Program
  signup. Path: build a worksheet with a dimension and a measure, then Marks card
  mark-type dropdown > Viz Extensions > Add Extension > **Access Local Viz
  Extensions** > pick the `.trex`. Tableau shows an Allow dialog naming the
  extension, its author, whether it wants full data access, and its URL.
- **Tableau Public:** the official Public FAQ says viz extensions are supported
  ("Works with Tableau Public" for a new extension, or "Access Local Viz
  Extensions" for a `.trex` you downloaded), and publishing needs Settings >
  Allow Access so the extension can read the visible data. **Not proven:** whether
  a self-hosted `.trex` loads, publishes and renders for public viewers. The help
  pages do not say how an extension earns the "Works with Tableau Public" label.
  Test it by loading the `.trex` in Public Desktop, with no save. A throwaway
  publish is the owner's call.
- **Do not settle a Tableau feature question by scanning the installed
  binaries.** The menu string "Access Local Viz Extensions" is in the raw bytes of
  neither Public nor Desktop, because Qt keeps UI strings in compressed `.rcc`
  resources. Absence of a string proves nothing. Install it, load it, look at it.

## Hard limits

| Limit | Consequence |
|---|---|
| Four custom encoding shelves maximum | Tooltip and Detail are always present on top. Everything else rides on Detail, matched by name. |
| Tableau 2024.2 minimum | Extensions API library 1.12 introduced `worksheetContent`. |
| No CDN for `tableau.extensions.*.js` | Vendor it. It is Tableau's, so you cannot redistribute it: tell users where to download it (github.com/tableau/extensions-api, `lib/`). |
| Only one `DataTableReader` open per worksheet | Serialize every data read. Release the reader on success AND on error. |
| Blank in PDF and PowerPoint exports | Warn people. |
| Plain HTTP only for `localhost` | Every other host must be HTTPS. The packager should refuse a non-HTTPS non-localhost URL. |
| Tableau parses the `.trex` only when the extension is added | After editing the manifest, remove and re-add the extension. |
| Settings are strings only | Store each settings group as one JSON string and coerce by type on load. |
| Manifest `author` needs `name` and an HTTPS `website` | An email is not required, so leave it out of anything public. |

## Gotchas found only in real Tableau

- **Detail fields arrive as ordinary columns** in the summary data, with
  aggregated names such as `SUM(Score)`. Strip the aggregation wrapper
  (`SUM|AVG|MIN|MAX|ATTR|MEDIAN|CNT|CNTD|AGG|USR`, and `YEAR|MONTH|DAY`) when
  matching by name.
- **Tableau does not give an extension its generated latitude and longitude.** If
  you need a map, bring a gazetteer or take Latitude and Longitude on Detail.
- **ResizeObserver loop at high display scaling.** At 144 DPI the stage's
  scrollbars flip-flopped, resize fired again, and the garden map blanked. The
  mock harness cannot reproduce this. Fix: `overflow: hidden` outside the scrolling
  view, and compare the new size to the last observed size inside a
  `requestAnimationFrame` before resizing.
- **Reloading the extension page.** A tab toggle and F5 do NOT reload it. Clicking
  the extension's name again in Viz Extensions does, and it resets settings to
  defaults for a moment: Ctrl+Z then restores the saved ones. (Dragging a Detail
  pill off and back also reloaded it until the settings panel was open.)
  Switching the mark type away and back drops the shelves and the settings.
- **Hidden tabs kill `requestAnimationFrame`.** An animated viz reads as frozen in
  an automation tab. Check `document.visibilityState` before calling it a bug, and
  stop/start the loop on `visibilitychange`.
- **Settings survive a switch between the Data Source and Sheet tabs.** Whether
  they survive a workbook save and reopen was not checked.
- **Text contrast for auto colors.** An "Auto" text color should pick near-black
  or white for 7:1 against the panel it sits on, not reuse the main ink.
- **Tooltips:** hover tooltips are your own DOM. A tooltip card needs its own
  contrast check.

## Build with a mock first

Both extensions ship a `dev/` mock of the Extensions API so most work happens in a
plain browser with Playwright. Make the mock STRICT where Tableau is strict:

- a second reader opened before `releaseAsync` throws, so a leak shows up
- settings come back as strings
- summary data is served in 10,000-row pages (with a query param to shrink the page)
- column names look like Tableau's (`SUM(Value)`)

Fixtures should cover: normal, small, empty, only-the-required-fields, and names
a gazetteer cannot place. Then prove the real thing once, in Tableau, with a
person present. The mock proves your side of the documented contract; it does not
prove that Tableau drives the extension correctly.

## Driving Tableau for the real-world test

`tableau-garden-petals/tools/` has the drivers (`tabshot.py`, `tabdrive.py`,
`tabdrag.py`). Rules they follow:

- find Tableau by process, not window title
- raise the Tableau window first, but never pull focus off a modal dialog the
  same process owns
- declare per-monitor DPI awareness or every coordinate is wrong on a scaled display
- take a screenshot after every step and read it before the next
- refuse any save or publish keystroke (see
  [never-ctrl-s-on-public.md](never-ctrl-s-on-public.md))
- run them only when the person has stepped away: the pointer moves on its own

## Packaging

`package.py` builds one folder and one zip: manifest plus everything it needs to
be hosted. `--base https://host/path` rewrites only the `<url>` inside
`<source-location>`, so a URL elsewhere in the manifest is left alone. With
neither flag the manifest keeps its localhost address, which is wrong on anybody
else's machine.

## Manifest checklist

- `min-api-version` 1.12 or higher for `worksheet-extension`
- `<permissions><permission>full data</permission></permissions>` if you read data
- up to four `<encoding>` blocks, each with `data-spec`, `role-spec`,
  `fields max-count`, an icon token and a tooltip resource
- `<author name=".." website="https://..">` with no email
- extension id in reverse-DNS form you control
