"""Build the shareable bundle: a .trex plus everything it needs to be hosted.

The output is one folder and one zip. Hand either to somebody with Tableau
Desktop and they can serve it and load it, with no build step and no npm install.
The Extensions API library is Tableau's, so it is not in this repo: put it in
lib/ first (see lib/README.md) and this script bundles it from there.

    python tools/package.py
    python tools/package.py --url https://charts.example.com/petals/src/index.html
    python tools/package.py --base https://charts.example.com/petals

--url writes that address into the manifest verbatim. --base is the same thing
for the common case, appending /src/index.html for you. With neither, the
manifest keeps its localhost address, which is the right default for a laptop
demo and wrong for anybody else's machine.

Tableau parses the manifest only when the extension is added, so whoever
receives this edits that URL before adding it, not after.
"""
import argparse
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Copied whole. Directories first, then single files.
TREES = ['src', 'lib', 'dev']
FILES = ['START-HERE.txt', 'Start-Petals.bat', 'Start-Petals.ps1', 'garden-petals.trex',
         'README.md', 'package.json']

# Never ship these, whatever directory they turn up in.
SKIP_DIRS = {'node_modules', '_shots', '.git', 'dist', '__pycache__'}
SKIP_SUFFIX = {'.log', '.pyc'}


def version_of(trex_text):
    m = re.search(r'extension-version="([^"]+)"', trex_text)
    return m.group(1) if m else '0.0.0'


def rewrite_url(trex_text, url):
    """Replace the single <url> inside <source-location>.

    Scoped to that element rather than any <url> in the file, so a URL that
    later appears in a description or an author block is left alone."""
    pattern = re.compile(r'(<source-location>\s*<url>)(.*?)(</url>)', re.S)
    if not pattern.search(trex_text):
        sys.exit('no <source-location><url> found in garden-petals.trex')
    return pattern.sub(lambda m: m.group(1) + url + m.group(3), trex_text, count=1)


def copy_tree(src, dst):
    for path in sorted(src.rglob('*')):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix in SKIP_SUFFIX:
            continue
        target = dst / path.relative_to(src)
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', help='exact address of src/index.html once hosted')
    ap.add_argument('--base', help='address of this folder once hosted; '
                                   '/src/index.html is appended')
    ap.add_argument('--out', default='dist')
    args = ap.parse_args()

    if args.url and args.base:
        sys.exit('pass --url or --base, not both')

    url = args.url
    if args.base:
        url = args.base.rstrip('/') + '/src/index.html'

    if url and not url.startswith(('http://localhost', 'http://127.0.0.1', 'https://')):
        sys.exit('Tableau allows plain HTTP for localhost only. '
                 'Any other host must be https://')

    if not list((ROOT / 'lib').glob('tableau.extensions.*.js')):
        sys.exit('lib/tableau.extensions.1.latest.min.js is missing. See lib/README.md.')

    trex = (ROOT / 'garden-petals.trex').read_text(encoding='utf-8')
    version = version_of(trex)
    if url:
        trex = rewrite_url(trex, url)

    name = f'garden-petals-viz-extension-{version}'
    out_root = ROOT / args.out
    stage = out_root / name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    for tree in TREES:
        source = ROOT / tree
        if source.is_dir():
            copy_tree(source, stage / tree)
    for f in FILES:
        source = ROOT / f
        if source.is_file():
            shutil.copy2(source, stage / f)

    # The manifest is written last, so the copied original never wins.
    (stage / 'garden-petals.trex').write_text(trex, encoding='utf-8')

    archive = out_root / f'{name}.zip'
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for path in sorted(stage.rglob('*')):
            if path.is_file():
                z.write(path, Path(name) / path.relative_to(stage))

    files = sum(1 for p in stage.rglob('*') if p.is_file())
    size = archive.stat().st_size
    current = re.search(r'<source-location>\s*<url>(.*?)</url>', trex, re.S).group(1).strip()
    print(f'{files} files -> {stage}')
    print(f'zip {size / 1024:.0f} KB -> {archive}')
    print(f'manifest url: {current}')
    if not url:
        print('  (localhost default: whoever hosts this edits that line first)')


if __name__ == '__main__':
    main()
