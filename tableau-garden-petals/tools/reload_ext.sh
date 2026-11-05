#!/bin/bash
# EXAMPLE ONLY. The coordinates below are window-relative pixels from one
# machine's Tableau layout and the field names are one sheet's, so measure your
# own with `python tools/tabdrive.py shot` and edit them. It shows the pattern:
# click the Marks-card mark type away and back, then re-drag the shelves.
# Nothing here sends a key, so it cannot save or publish.
# Reload the extension in Tableau (switch mark type away and back), then re-drag the four shelves.
cd "$(dirname "$0")/.."
python tools/tabdrive.py xy 438 374 dd >/dev/null 2>&1; python tools/tabdrive.py xy 405 404 auto >/dev/null 2>&1; sleep 2
python tools/tabdrive.py xy 438 374 dd2 >/dev/null 2>&1; python tools/tabdrive.py xy 419 835 pick >/dev/null 2>&1; sleep 5
for a in "Country 330 525 Flower 285 336" "Metric 330 552 Petal 343 336" "Value 330 579 Length 400 336" "Science_Score 330 605 Score 285 392"; do python tools/tabdrag.py $a 2>&1 | tail -1; done
sleep 4; python tools/tabdrive.py shot reloaded 2>&1 | tail -1
