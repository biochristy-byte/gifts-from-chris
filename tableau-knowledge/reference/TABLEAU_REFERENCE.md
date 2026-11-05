# Tableau Reference (self-taught, June 2026)

What I learned so I can build worksheets/dashboards for the workbook owner. Two tracks:
GUI build sheets (reliable) and `.twb`/`.twbx` generation (works if scope stays tight).

---

## VERDICT: what is and isn't possible

| Question | Answer |
|---|---|
| MCP into Tableau Public to author dashboards? | No. No authoring API exists for Public. |
| Tableau Public REST API? | Read-only, reverse-engineered: list/download/metadata. Cannot create. |
| Official Tableau MCP / REST publish? | Server/Cloud (paid) only, and read/query, not author. |
| Generate a `.twbx` locally then publish? | YES. This is the viable path. |
| Final publish step | Must be a human click: open in free Tableau Public Desktop, then Server > Tableau Public > Save to Tableau Public. |

So the real workflow = **Claude generates the workbook, the owner clicks publish.**

### Tableau Public limits
- 15M rows / ~1GB data per workbook; 10GB profile storage.
- Everything published is PUBLIC. Never upload PII/patient data.
- Free Desktop Public Edition CAN open a local .twb/.twbx (File > Open) and can save locally since v2024.1.2.

---

## TRACK 1 -  GUI build (the dependable path)

### Connect a CSV
Start page > Connect > To a File > **Text File** > pick CSV. Lands on **Data Source** tab.
- Table ▾ > "First row has field names" (on by default).
- Table ▾ > **Text File Properties** to fix separator / encoding / locale.
- Click each column's type icon (#, Abc, calendar, globe) to fix data type.
- Double-click a column name to rename.

### Dimensions vs Measures, blue vs green
- **Dimension** = qualitative, segments data (top of Data pane). **Measure** = numeric, gets aggregated.
- **Blue pill = discrete** (makes headers). **Green pill = continuous** (makes an axis). Separate from role.
- Right-click field > Convert to Dimension/Measure, or Convert to Discrete/Continuous.

### Build a worksheet
- Drag fields to **Columns** / **Rows** shelves. Dimension > headers, Measure > axis (auto SUM).
- **Marks card**: Color, Size, Label/Text, Detail, Tooltip, Shape + mark-type dropdown (Automatic/Bar/Line/...).
- **Show Me** (top-right): select fields, pick chart type; grayed = needs different fields.
- Recipes: Bar = dim on Cols + measure on Rows. Line = date on Cols + measure on Rows.
  Scatter = measure on both. Highlight table = 2 dims + measure on Color, mark = Square.

### Calculated fields
Analysis > **Create Calculated Field**. Fields in `[brackets]`. Aggregate with SUM/AVG/COUNTD.
- Ratio: `SUM([Profit]) / SUM([Sales])`
- Pct of total (LOD): `SUM([Sales]) / SUM({FIXED : SUM([Sales])})`
- Per-group total: `{FIXED [Region] : SUM([Sales])}`
- Bucket: `IF [x] > 0 THEN "A" ELSEIF [x] = 0 THEN "B" ELSE "C" END` (use ELSEIF)
- CASE: `CASE [Dept] WHEN "OR" THEN "Surgical" ... ELSE "Other" END`

### Maps
- Right-click place field > **Geographic Role** > State/Province (globe icon appears).
- Double-click State > Tableau adds Lat/Long generated, draws dot map.
- Marks dropdown > **Filled Map**. Drag measure to **Color**. Use ratio/avg, not raw count.

### Filters & parameters
- Drag field to **Filters** shelf. Right-click > **Show Filter** for a control card.
- Top-N: drag dim to Filters > **Top** tab > By field > Top 10 by SUM([x]).
- Parameter: Data pane ▾ > **Create Parameter** > type + allowable values. Then Show Parameter.
  Parameter does nothing until referenced (calc field, reference line, or Top-N filter).

### Formatting
- Title: hover ▾ > Edit Title. Numbers: right-click measure > Format (or Default Properties > Number Format).
- Colors: Marks Color > Edit Colors. Tooltips: Worksheet > Tooltip. Format top-down (Workbook first).

### Dashboard
- Bottom bar > **New Dashboard** icon. Left panel becomes Dashboard pane.
- Drag sheets from Sheets list onto canvas (auto-tile).
- **Tiled** (snap grid) vs **Floating** (Shift-drag or toggle). Use Horizontal/Vertical **layout containers** for alignment.
- **Size** dropdown: Fixed (preset px) / Range (min-max for mobile) / Automatic.
- One filter for all charts: filter card ▾ > **Apply to Worksheets** > Selected/All Using This Data Source.
- Click-to-filter: hover sheet > funnel "Use as Filter" icon.
- **Device Preview** for phone/tablet layouts.

### Design tips
Neutral base + one accent color. Title states the takeaway, not the field name. Few views > wall of charts.

---

## TRACK 2 -  Generate a `.twb` / `.twbx` from scratch

`.twb` = plain UTF-8 XML. `.twbx` = plain unencrypted ZIP with `.twb` at root + `Data/` folder.

### Minimal reliable recipe (keep scope tight)
1. Generate federated + textscan datasource with inline `<columns>` schema (one `<column>` per CSV col).
2. Generate ONE simple worksheet (bar/line): dim on `<cols>`, sum-measure on `<rows>`, `<mark class='Bar'>`,
   complete `<datasource-dependencies>` declaring base `<column>`s AND the `<column-instance>`s referenced.
3. Use stable own IDs (`federated.csv1`, `textscan.csv1`), NOT random hashes, but keep them consistent everywhere.
4. Emit a minimal `<windows>` block (one window per worksheet).
5. SKIP `<dashboards>` in v1 (most fragile). Build dashboard by hand after opening.
6. Open in Desktop, resave to get a canonical file.

### Skeleton
```xml
<?xml version='1.0' encoding='utf-8' ?>
<workbook original-version='18.1' source-build='2020.2.0' version='18.1'
  xmlns:user='http://www.tableausoftware.com/xml/user'>
  <datasources> ... </datasources>
  <worksheets> ... </worksheets>
  <windows> ... </windows>
</workbook>
```

### CSV datasource (federated wraps textscan)
```xml
<datasource caption='data' inline='true' name='federated.csv1' version='18.1'>
  <connection class='federated'>
    <named-connection caption='data' name='textscan.csv1'>
      <connection class='textscan' directory='Data/data Files' filename='data.csv' password='' server='' />
    </named-connection>
    <relation connection='textscan.csv1' name='data.csv' table='[data#csv]' type='table'>
      <columns character-set='UTF-8' header='yes' locale='en_US' separator=','>
        <column datatype='string'  name='State'     ordinal='0' />
        <column datatype='real'    name='AvgSalary' ordinal='1' />
      </columns>
    </relation>
  </connection>
</datasource>
```
- datatypes: integer, real, string, datetime, date, boolean.
- For packaged .twbx, `directory` is a RELATIVE path into Data/; mismatch = "locate data source" prompt.

### Calculated field = a column with a nested calculation
```xml
<column caption='Profit Ratio' datatype='real' default-format='p0%'
  name='[Calculation_1]' role='measure' type='quantitative'>
  <calculation class='tableau' formula='SUM([Profit])/SUM([Sales])' scope-isolation='false' />
</column>
```

### Worksheet
```xml
<worksheet name='Sheet 1'>
  <table>
    <view>
      <datasources><datasource caption='data' name='federated.csv1' /></datasources>
      <datasource-dependencies datasource='federated.csv1'>
        <column datatype='string' name='[State]' role='dimension' type='nominal' />
        <column datatype='real' name='[AvgSalary]' role='measure' type='quantitative' />
        <column-instance column='[State]' derivation='None' name='[none:State:nk]' pivot='key' type='nominal' />
        <column-instance column='[AvgSalary]' derivation='Sum' name='[sum:AvgSalary:qk]' pivot='key' type='quantitative' />
      </datasource-dependencies>
    </view>
    <panes><pane><mark class='Bar' /></pane></panes>
    <rows>[federated.csv1].[sum:AvgSalary:qk]</rows>
    <cols>[federated.csv1].[none:State:nk]</cols>
  </table>
</worksheet>
```

### Field-token codes (the part that breaks hand files)
`[datasource].[deriv:Field:suffix]`
- prefix = aggregation/derivation: `none:`, `sum:`, `avg:`, `cnt:`, date trunc `tyr:`/`tmn:`/`twk:`.
- suffix = key type: `nk` nominal, `ok` ordinal, `qk` quantitative.
- RULE: every token used in rows/cols/encodings must be DECLARED as a `<column-instance>` first,
  and its base `[Field]` must exist as a `<column>`. This + ID consistency are the top 2 failure modes.

### Fragility flags
- Official XSD (github tableau/tableau-document-schemas) is structural only; passing it != opens cleanly.
- `version` string is a moving target; older Desktop refuses NEWER version. Use older (18.1) for compatibility.
- Dashboards use per-myriad geometry (out of 100000), error-prone; defer to GUI.

---

## Sources
GUI: help.tableau.com (buildmanual, calculations, maps, filtering, dashboards, parameters).
XML: real .twb files on GitHub (CTopham, sunny0757, TheInformationLab), tableauandbehold.com,
github tableau/tableau-document-schemas. Public limits: help.tableau.com public_faq.
