# Rebuild the PISA flower garden

The dashboard this extension was made for: **MM 2026 week 44, students and AI across the globe**
(91 countries and regions, five OECD PISA 2025 digital-learning questions). One flower per
country, one petal per question, petal length is the share of students, the grey outline is the OECD
average, and a petal glows when the share is 80% or more.

This folder is everything you need besides the data itself and Tableau's own library.

| File | What it is |
| --- | --- |
| `build_pisa_long.py` | Reshapes the Makeover Monday file into the long table the viz reads |
| `pisa-dark-settings.json` | The exact dark theme, garden map view, title and glow settings |

## 1. Get the data

Download the week 44, 2026 file from [Makeover Monday](https://www.makeovermonday.co.uk/data/).
Open it in Tableau (or any tool) and export it as CSV with at least these columns:
`Country`, `Region`, `Sampling caution`, `Metric Original`, `Value`, `Science mean score`,
`Reading mean score`, `Mathematics mean score`. It has an `OECD average` row in `Country`; the script
turns that row into the reference outline.

```bash
cd example-pisa            # from the tableau-garden-petals folder
python build_pisa_long.py mm_w44.csv pisa_long.csv
# 437 rows, 91 countries -> pisa_long.csv
```

Other columns in the file are ignored. Check the printout: 437 rows and 91 countries means the shape is right.

To preview in a browser without Tableau, from the `tableau-garden-petals` folder run
`python tools/make_fixtures.py example-pisa/pisa_long.csv`, serve the folder
(`python -m http.server 8767`), open `http://localhost:8767/dev/dev.html?fresh=1`, then do step 4.

## 2. Install the extension

Follow [`../README.md`](../README.md): get Tableau's library into `lib/`, start the server
(`Start-Petals.bat`), and add `garden-petals.trex` through Access Local Viz Extensions.

## 3. Build the sheet

Connect Tableau to `pisa_long.csv`, open a new sheet, set the Marks card to the Garden Petals
viz extension, then drag:

| Where | Field |
| --- | --- |
| Flower | `Country` |
| Petal | `Metric` |
| Length | `Value` (Sum) |
| Score | `Science Score` (Sum, shows under each flower name) |
| Detail | `OECD Value`, `Region`, `Sampling caution`, `Science Score`, `Math Score`, `Reading Score` |

The Detail fields are picked up by name: `OECD Value` becomes the grey outline, `Region` the
group, `Sampling caution` the caution mark, and the three scores fill the tooltip. Do not change
the names.

## 4. Load the look

1. Click the gear at the top right of the viz. In the panel footer click **Paste settings**,
   paste the whole contents of `pisa-dark-settings.json` into the box, and click **Apply**.
   This sets the dark colors, Poppins fonts, the garden map view, the glow rule and the title.
2. The title is two lines (`Flower Garden of Students & AI Use` / `Across The Globe`). The Title
   text box on the Title tab takes a line break.
3. Hide the sheet's own Tableau title (right-click the title, **Hide Title**) so the viz title is
   the only one.
4. The glow rule is on the Effects tab: petal *Students in schools where cell phones are not
   allowed*, at 80% or more. The legend note follows it.

You should now see a dark garden map of 91 flowers, five petals each, with grey OECD outlines.

## Publishing

Tableau Public only runs Tableau-approved extensions, so a workbook that uses a self-hosted copy
will show viewers "isn't currently supported on Tableau Public". It still works in Tableau Desktop
(including Public Desktop while you author) and in screen shares.
