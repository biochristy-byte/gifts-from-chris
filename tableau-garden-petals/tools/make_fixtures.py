"""Build dev/fixtures.js (window.GP_FIXTURES) for the mock-Tableau dev page.

Long format with Tableau-style column names, like a worksheet with Country and
Metric on the shelves. Two sources:

    python tools/make_fixtures.py                 made-up numbers (the default)
    python tools/make_fixtures.py my_data.csv     your own long-format CSV

The CSV needs these columns: Country, Metric, Value. Optional: Science Score,
Math Score, Reading Score (the hover tooltip scores), Region, Sampling caution,
OECD Value (the reference outline).

The shipped fixtures are synthetic so the repo carries no third-party data.
Every number comes from a seeded generator, so a rebuild is byte-identical.
"""
import csv
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dev' / 'fixtures.js'

COLS = ['Country', 'Metric', 'SUM(Value)', 'SUM(Science Score)', 'SUM(Math Score)', 'SUM(Reading Score)',
        'Region', 'Sampling caution', 'OECD Value']

# Real place names (the gazetteer places a flower by name), made-up values.
PLACES = [
    ('Japan', 'East Asia'), ('Brazil', 'Americas'), ('Albania', 'Europe'), ('Finland', 'Europe'),
    ('Korea', 'East Asia'), ('Chile', 'Americas'), ('Kenya', 'Africa'), ('Canada', 'Americas'),
    ('Spain', 'Europe'), ('India', 'South Asia'), ('Mexico', 'Americas'), ('Norway', 'Europe'),
    ('Egypt', 'Africa'), ('Thailand', 'East Asia'), ('Peru', 'Americas'), ('Poland', 'Europe'),
    ('Morocco', 'Africa'), ('Australia', 'Oceania'), ('Ireland', 'Europe'), ('Vietnam', 'East Asia'),
]
METRICS = ['Metric A', 'Metric B', 'Metric C', 'Metric D', 'Metric E']


def synthetic():
    rnd = random.Random(2026)
    ref = [round(rnd.uniform(0.35, 0.8), 3) for _ in METRICS]
    out = []
    for name, region in PLACES:
        a, b, c = (rnd.randint(380, 560) for _ in range(3))
        caution = 'Yes' if rnd.random() < 0.15 else 'No'
        for i, m in enumerate(METRICS):
            v = round(min(1.0, max(0.05, ref[i] + rnd.uniform(-0.3, 0.3))), 3)
            out.append({'Country': name, 'Metric': m, 'Value': v, 'Science Score': a, 'Math Score': b, 'Reading Score': c,
                        'Region': region, 'Sampling caution': caution, 'OECD Value': ref[i]})
    return out


def from_csv(path):
    out = []
    with open(path, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            for k in ('Value', 'Science Score', 'Math Score', 'Reading Score', 'OECD Value'):
                if k in r and r[k] not in ('', None):
                    r[k] = float(r[k])
            out.append(r)
    return out


def shape(rows):
    res = []
    for r in rows:
        res.append({'Country': r['Country'], 'Metric': r['Metric'], 'SUM(Value)': r['Value'],
                    'SUM(Science Score)': r.get('Science Score'), 'SUM(Math Score)': r.get('Math Score'), 'SUM(Reading Score)': r.get('Reading Score'),
                    'Region': r.get('Region'), 'Sampling caution': r.get('Sampling caution'),
                    'OECD Value': r.get('OECD Value')})
    return res


def main():
    base = from_csv(sys.argv[1]) if len(sys.argv) > 1 else synthetic()
    full = shape(base)
    names = []
    for r in full:
        if r['Country'] not in names:
            names.append(r['Country'])
    small = [r for r in full if r['Country'] in names[:6]]
    nogeo = [dict(r, Country='Zorbland ' + r['Country'][:3]) for r in full if r['Country'] in names[:12]]
    bare = [{'Country': r['Country'], 'Metric': r['Metric'], 'SUM(Value)': r['SUM(Value)']} for r in small]
    fx = {
        'sample': {'columns': COLS, 'rows': full},
        'small': {'columns': COLS, 'rows': small},
        'nogeo': {'columns': COLS, 'rows': nogeo},      # names the gazetteer cannot place
        'empty': {'columns': COLS, 'rows': []},
        'bare': {'columns': ['Country', 'Metric', 'SUM(Value)'], 'rows': bare},   # only the required fields
    }
    OUT.write_text('window.GP_FIXTURES = ' + json.dumps(fx, ensure_ascii=False) + ';\n', encoding='utf-8')
    print({k: len(v['rows']) for k, v in fx.items()}, 'countries', len(names))


if __name__ == '__main__':
    main()
