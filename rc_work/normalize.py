import sys, os, glob
from PIL import Image

src = sys.argv[1]
dest = sys.argv[2]
if src == 'latest':
    dl = sorted(glob.glob(os.path.expanduser(r'~/Downloads/ChatGPT Image*.png')),
                key=os.path.getmtime, reverse=True)
    if not dl:
        print('NO_DOWNLOAD'); sys.exit(1)
    src = dl[0]

im = Image.open(src).convert('RGB')
tw, th = 1536, 1024
w, h = im.size
s = max(tw / w, th / h)
nw, nh = int(round(w * s)), int(round(h * s))
im = im.resize((nw, nh), Image.LANCZOS)
l = (nw - tw) // 2; t = (nh - th) // 2
im = im.crop((l, t, l + tw, t + th))
q = 90
im.save(dest, 'WEBP', quality=q)
sz = os.path.getsize(dest)
while sz > 600 * 1024 and q > 70:
    q -= 5
    im.save(dest, 'WEBP', quality=q)
    sz = os.path.getsize(dest)
print('saved', os.path.basename(dest), im.size, 'q', q, round(sz / 1024), 'KB')
