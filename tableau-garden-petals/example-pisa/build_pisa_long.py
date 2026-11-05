"""Reshape the Makeover Monday 2026 week 44 PISA file into the long table Garden Petals wants.

    python build_pisa_long.py  mm_w44.csv  pisa_long.csv

The input is the MM W44 data exported to CSV (Tableau: Data > the source > View Data > Export,
or any CSV with these columns): Country, Region, Sampling caution, Metric Original, Value,
Science mean score, Reading mean score, Mathematics mean score.

The output has one row per Country x Metric:
    Country, Metric, Value, Science Score, Math Score, Reading Score, Region, Sampling caution, OECD Value
OECD Value is the 'OECD average' row's value for that metric, repeated on every row, so the
viz can draw it as the reference outline. The 'OECD average' row itself is not a flower.
Malta is listed under Middle East and North Africa in the source; it is moved to Europe & Central Asia.
"""
import csv, sys

METRICS = [
    "Students using AI at least weekly to help them learn",
    "Students reporting no distraction from digital devices",
    "Students learning to assess AI-generated information in class",
    "Students in schools with subject-specific digital device guidelines",
    "Students in schools where cell phones are not allowed",
]
src, out = sys.argv[1], sys.argv[2]
seen, rows = {}, []
for r in csv.DictReader(open(src, encoding='utf-8-sig')):
    if r['Metric Original'] not in METRICS or r['Value'] == '':
        continue
    seen[(r['Country'], r['Metric Original'])] = r          # de-duplicates repeated source rows
oecd = {m: seen[('OECD average', m)]['Value'] for m in METRICS if ('OECD average', m) in seen}
for (country, metric), r in sorted(seen.items(), key=lambda kv: (kv[0][0], METRICS.index(kv[0][1]))):
    if country == 'OECD average':
        continue
    region = 'Europe & Central Asia' if country == 'Malta' else r['Region']
    rows.append([country, metric, r['Value'], r['Science mean score'], r['Mathematics mean score'],
                 r['Reading mean score'], region, r['Sampling caution'], oecd.get(metric, '')])
w = csv.writer(open(out, 'w', newline='', encoding='utf-8'))
w.writerow(['Country', 'Metric', 'Value', 'Science Score', 'Math Score', 'Reading Score', 'Region', 'Sampling caution', 'OECD Value'])
w.writerows(rows)
print(len(rows), 'rows,', len({r[0] for r in rows}), 'countries ->', out)
