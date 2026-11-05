# Tableau knowledge for Claude Code

What I learned building Tableau dashboards, workbooks and viz extensions with
Claude Code, written down so your Claude can start where mine ended. It is
mostly things that fail silently: Tableau does not log an error, the feature just
does not happen.

Point your Claude at this folder and say "read tableau-knowledge/README.md, then
help me build a dashboard."

## Read in this order

| File | What it is | Read it when |
|---|---|---|
| [`house-style.md`](house-style.md) | 35 dashboard design rules (layout, color, type, text contrast, interactivity, story) with where each came from | before designing any page |
| [`buildout-pipeline.md`](buildout-pipeline.md) | How Claude builds a workbook when there is no authoring API: Tableau authors a template, a script injects charts, you publish. Includes GUI-driving lessons and gating | before generating a `.twb` |
| [`xml-traps.md`](xml-traps.md) | The `.twb` XML catalogue: load failures, the silent traps, and verified fragments for buttons, actions, filters, maps, colors, DZV | when XML loads but renders wrong, or does not load |
| [`technique-library.md`](technique-library.md) | Chart and interaction recipes (map layers as a canvas, dashboard-level set actions, zoom without an extension) and calc pitfalls | before building a chart or interaction |
| [`viz-extensions.md`](viz-extensions.md) | Viz extension hard limits, what is proven and unproven (including Tableau Public), and the gotchas found only in real Tableau | before writing an extension |
| [`never-ctrl-s-on-public.md`](never-ctrl-s-on-public.md) | Why Ctrl+S in Tableau Public publishes, and how to make a driver refuse it | before any GUI automation |
| [`claude-command/tableau-scrubs.md`](claude-command/tableau-scrubs.md) | A `/tableau-scrubs` slash command: a data-prep and analysis team that asks about grain and audience first | whenever you start a Tableau job |
| [`reference/`](reference) | A 40+ chart-type reference and the `.twb`/`.twbx` file format primer | as a lookup |

The code that goes with it:

- [`../tableau-garden-petals/`](../tableau-garden-petals/README.md) is a full viz
  extension with a strict mock of the Extensions API, a packager, and Tableau
  drivers that refuse save keystrokes.
- [`../tableau-lollipop/`](../tableau-lollipop/README.md) is a smaller one with
  84 settings.

## Install the slash command

Copy `claude-command/tableau-scrubs.md` into `~/.claude/commands/`
(on Windows, `C:\Users\<you>\.claude\commands\`) and restart Claude Code. Then:

```
/tableau-scrubs a dashboard on clinic wait times, one row per visit
```

## Make Claude keep the house style

Add this to your `CLAUDE.md`:

```
For any Tableau work, read tableau-knowledge/house-style.md and
tableau-knowledge/never-ctrl-s-on-public.md first. Text contrast is 7:1 minimum,
no text under 10 pt. Never send Ctrl+S to Tableau Public. I click publish.
```

## How reliable is it

Every XML fragment and trap was proved by loading a generated file into Tableau
Public 2026.1 (build `2026.1.1`) and reading the screen or Tableau's own save.
Tableau changes between builds, so when something here disagrees with your
version, trust your build: make the change once in the GUI, Save As a scratch
`.twbx`, and diff. Items marked "not proven" really are untested.

## Credits

Technique notes come from Andy Kriebel's public VizWiz channel. Design rules
come from public Tableau Public workbooks and conference talks, read for their
structure. Go to the originals for the full craft. Tableau and Tableau Public are
trademarks of Salesforce. Nothing here is affiliated with or endorsed by them.
