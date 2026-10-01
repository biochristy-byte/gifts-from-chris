# The Tableau Extensions API library

The extension needs one file that is not in this folder:

    lib/tableau.extensions.1.latest.min.js

It is Tableau's own library, so it is not redistributed here. You download it
once, and it takes a minute. Without it the extension page loads but never
connects to Tableau, and the chart stays blank.

## Get it

Tableau publishes it in their official extensions-api repository, in the `lib`
folder:

https://github.com/tableau/extensions-api/tree/main/lib

1. Open that page and click `tableau.extensions.1.latest.min.js`.
2. Click the download icon on the file view ("Download raw file").
3. Save it into this folder, so the full path is
   `tableau-lollipop/lib/tableau.extensions.1.latest.min.js`.

Or from a terminal, run this from the `tableau-lollipop` folder:

```bash
curl -L -o lib/tableau.extensions.1.latest.min.js https://raw.githubusercontent.com/tableau/extensions-api/main/lib/tableau.extensions.1.latest.min.js
```

On Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/tableau/extensions-api/main/lib/tableau.extensions.1.latest.min.js -OutFile lib/tableau.extensions.1.latest.min.js
```

## Check it

The file name has to match exactly. `src/index.html` loads it with:

```html
<script src="../lib/tableau.extensions.1.latest.min.js"></script>
```

With the server running, open `http://localhost:8765/lib/tableau.extensions.1.latest.min.js`
in a browser. You should see a wall of minified JavaScript. A "not found" page
means the file is in the wrong place or has a different name.

This extension was built and tested against version 1.17.0 of the library.
Any `1.latest` build from Tableau's repo works the same way.

## Please do not commit it

`.gitignore` in this project skips `lib/*.js`, so the file stays on your
machine. Tableau's library is theirs, and the right place to get it is their
repo.
