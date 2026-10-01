# Lollipop: a Tableau viz extension

A lollipop chart extension I built for Tableau. It adds Lollipop as a mark type
on the Marks card: a thin stick from the baseline to the value, capped by a
shaped, labelled ball. Everything about it is adjustable from a settings panel
that opens from a gear inside the viz. It is free, it is MIT licensed, and it
runs in the free edition of Tableau Desktop.

## What it does

- **Four Marks card shelves**: Category, Value, Colour, Label. Four is the most
  Tableau allows a viz extension. Tooltip and Detail are always there too.
- **84 settings** in 9 groups: layout, stick, ball, ball label, number format,
  axes and grid, background and border, settings panel, interaction.
- **Seven ball shapes**: circle, ring, square, diamond, triangle, star, hexagon.
- **Three ball colour modes**: one fixed colour, a categorical palette driven by
  the Colour shelf, or a light-to-dark ramp driven by the value.
- **Chart background**: inherit the worksheet's, pick your own colour, or go
  transparent. The settings panel has its own theme: light, dark, matched to
  the chart, or a custom background and text colour.
- **Selection and hover push back into Tableau**, so clicking a lollipop is
  meant to filter and highlight other sheets the way a native mark does.
- **Settings are saved in the workbook** through Tableau's extension settings.
- **No sliders.** Every number is a stepper you can also type into, because
  chart tuning needs exact values and a slider cannot reliably give you 12.5px.

## What else you need

| You need | Why |
| --- | --- |
| **Tableau Desktop 2024.2 or newer** | Viz extensions need 2024.2 at minimum. Tableau Desktop **Free Edition** works: it was tested on 2026.2 with no licence. |
| **Node.js** (or Python 3) | The extension is a web page, and Tableau loads it from a local server. Node runs the one in this project. `python -m http.server` works as a stand-in, see below. |
| **One file from Tableau** | The Extensions API library, `tableau.extensions.1.latest.min.js`. It is Tableau's, so it is not in this folder. [lib/README.md](lib/README.md) shows where to get it. |

**Tableau Public cannot run viz extensions.** That is a Tableau limit, not
something this extension can change. A workbook that uses Lollipop cannot be
published to a Tableau Public profile. It works in Tableau Desktop, and in
Tableau Server and Cloud.

## Install

1. **Get the Tableau library.** Follow [lib/README.md](lib/README.md) and put
   `tableau.extensions.1.latest.min.js` in the `lib/` folder.

2. **Check port 8765 is free.** The manifest points at `localhost:8765`. If
   something else already holds that port, the server will refuse to start or
   land somewhere else, and Tableau will find a blank page.

   Windows PowerShell:

   ```powershell
   if (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) { "8765 is TAKEN" } else { "8765 is free" }
   ```

   macOS or Linux:

   ```bash
   lsof -nP -iTCP:8765 -sTCP:LISTEN || echo "8765 is free"
   ```

   If it is taken, pick another port (say 8770) and use it in all three places:
   the server command, the address you test in a browser, and the `<url>` line
   in `lollipop.trex`.

3. **Start the server** from this folder:

   ```bash
   npm install
   npm start
   ```

   No Node? Python also works for this extension, because it is only static
   files:

   ```bash
   python -m http.server 8765
   ```

4. **Test it in a browser.** Open `http://localhost:8765/src/index.html`. A
   blank page is correct: the extension draws nothing until Tableau hands it
   data. (If the browser console says "Tableau Extensions API not present", the
   library file from step 1 is missing or misnamed.)

5. **Leave the server running** while you use the extension. Tableau reads the
   page from it live.

## Use it in a workbook

1. In Tableau Desktop, connect to some data and build a worksheet with one
   dimension and one measure. A bar chart is a good start.
2. On the **Marks card**, open the mark type dropdown (it says Automatic or Bar).
3. Choose **Viz Extensions**, then **Add Extension**.
4. In the dialog choose **Access Local Viz Extensions** and pick `lollipop.trex`
   from this folder.
5. Tableau shows an **Allow Extension** dialog with the extension's name,
   author, URL, and a note that it wants full data access. Allow it.
6. The Marks card now has **Category**, **Value**, **Colour** and **Label**
   shelves. Drag your dimension to Category and your measure to Value.
7. Move the pointer over the chart and a gear appears at the top right. Click
   it to open the settings panel.

Colour and Label are optional. The Colour shelf only does something when the
setting Colour source is set to By field. The Label shelf only does something
when Label text is set to The Label shelf field.

Tableau reads `lollipop.trex` only at the moment you add the extension. If you
edit it, remove the extension and add it again.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| Blank area, no gear | The server is not running, or the URL in `lollipop.trex` does not match where it is. Open that URL in a browser to check. |
| Server says the address is in use | Something else holds the port. Pick another and change it in all three places (step 2). |
| Blank, and the browser console says "Tableau Extensions API not present" | `lib/tableau.extensions.1.latest.min.js` is missing. See [lib/README.md](lib/README.md). |
| "Drop a dimension on Category and a measure on Value." | Working. It needs fields on those two shelves. |
| Extension is not in the Marks card menu | Tableau is older than 2024.2, or it is Tableau Public. |
| It worked, then went blank | The server stopped. The extension is a live page, not a copy baked into the workbook. |
| Blank in a PDF or PowerPoint export | Tableau draws all viz extensions blank in those exports. |
| Tableau will not accept the manifest | Check that `lollipop.trex` is still valid XML, and that the `author` line still has a `name` and an HTTPS `website` (Tableau requires both; `email` is optional). |

If someone else opens your workbook, they need the extension reachable at the
same URL that is saved in it. On `localhost` that means each person runs their
own server. Hosting it once at an HTTPS address everyone can reach is what makes
a workbook shareable. Plain HTTP is accepted for `localhost` only.

## Try it without Tableau

Start the server and open `http://localhost:8765/dev/dev.html`. It runs the
real extension code against a mock of the Tableau API, with nine deliberately
awkward datasets (negatives, ties, one row, no rows, very long names, six
orders of magnitude, 40 categories) and every setting live. This page does not
need the Tableau library.

`test/data/departments.csv` is a ten-row made-up sample you can load into
Tableau to try the extension.

## Tests

```bash
npm test
```

147 headless assertions covering number formatting, axis ticks, colour maths,
panel theming and settings coercion. Coercion matters most: Tableau saves every
setting as a string, so `"14"` has to come back as the number 14 and `"false"`
as the boolean false, or the chart looks right on first draw and wrong after the
workbook reopens. The panel theme tests check contrast ratios rather than hex
values, which is what catches a grey that works on white and vanishes on a dark
worksheet. The tests do not need the Tableau library.

## What I have and have not checked in Tableau

Run in Tableau Desktop 2026.2 Free Edition against Sample Superstore:

- The manifest loads and the mark type reads "Lollipop".
- The Category, Value and Colour shelves appear, along with Label, Detail and Tooltip.
- The data binds correctly: 17 sub-categories, with values matching a text table.
- The gear opens the panel inside the worksheet, and settings change the chart
  live (orientation, ball colour, stick colour, Reset all).

Not click-tested in Tableau itself: saving a workbook and reopening it, and
selection and hover pushing back to other sheets. Both are implemented and the
settings coercion is covered by the tests, but I have not watched them happen
in Tableau.

## Layout

```
lollipop.trex          the manifest Tableau reads
src/index.html         the extension page
src/js/
  settings-schema.js   every option, its default, its control type  <- start here
  palettes.js          palettes, colour mixing, contrast maths
  format.js            number formatting and nice-number axis ticks
  render.js            the SVG renderer
  settings-panel.js    the gear and the panel, generated from the schema
  lollipop.js          entry point, binds Tableau to the renderer
lib/                   put the Tableau Extensions API library here
dev/                   mock Tableau API, fixtures, standalone harness page
test/                  headless tests and a sample CSV
```

To add a setting, add one entry to `settings-schema.js` and read it in
`render.js`. The panel picks it up on its own.

## Notes if you build on this

- Only one data reader may be open per worksheet, so `refreshData` is
  serialized. Unordered reads would let a slow earlier response overwrite fresh
  data after a fast filter change.
- Animation uses requestAnimationFrame, because CSS cannot transition SVG
  geometry attributes in every engine.
- Panel greys come from `fadeToContrast`, which solves for a target contrast
  ratio. Mixing in linear light is right for a colour ramp and wrong for text.
- A sandboxed extension cannot reach external hosts, so any library this grows
  has to be a local file, not a CDN link.

## License

MIT, see the LICENSE in the root of this repository. Tableau and the Tableau
Extensions API are Tableau's.
