// Drive a logged-in ChatGPT session over Edge/Chrome CDP :9222 to generate an image batch.
// Never touches your other tabs: opens/uses ONE background chatgpt.com tab. Idempotent per slug
// (skips a slug whose PNG already exists). Resilient: one action at a time, verbose, screenshots.
// Requires: Node + playwright-core installed near this script, and the browser launched with
//   msedge.exe --remote-debugging-port=9222  (logged into chatgpt.com on a plan with image gen)
//
// Usage:
//   node cgArtBatch.js open              -> open a background chatgpt.com tab (no focus steal), shoot it
//   node cgArtBatch.js shot <file>       -> screenshot the chatgpt tab
//   node cgArtBatch.js state             -> report composer + last-image state
//   node cgArtBatch.js gen <slug> <refPath> <promptFile>  -> new chat, attach ref, paste prompt, send
//   node cgArtBatch.js wait              -> wait for the current generation to finish; print image url(s)
//   node cgArtBatch.js save <outPath>    -> download the newest assistant image to outPath
const { chromium } = require('playwright-core');
const fs = require('fs');

const CDP = 'http://127.0.0.1:9222';

async function getCg(browser, { open } = {}) {
  const ctx = browser.contexts()[0];
  let pages = ctx.pages().filter((p) => !p.url().startsWith('devtools://'));
  let page = pages.find((p) => p.url().includes('chatgpt.com') || p.url().includes('chat.openai.com'));
  if (!page && open) {
    page = await ctx.newPage(); // background tab in Chris's context; no bringToFront
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  return page;
}

(async () => {
  const [, , cmd, ...rest] = process.argv;
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP, { timeout: 60000 });
  } catch (e) {
    console.log('CONNECT_ERR', e.message);
    process.exit(1);
  }
  try {
    if (cmd === 'open') {
      const page = await getCg(browser, { open: true });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: rest[0] || 'cg_open.png' });
      console.log('OPEN', page.url());
    } else if (cmd === 'shot') {
      const page = await getCg(browser);
      if (!page) return console.log('NO_CHATGPT_TAB');
      await page.screenshot({ path: rest[0] || 'cg.png' });
      console.log('SHOT', rest[0], '| url', page.url());
    } else if (cmd === 'state') {
      const page = await getCg(browser);
      if (!page) return console.log('NO_CHATGPT_TAB');
      const st = await page.evaluate(() => {
        const composer = document.querySelector('#prompt-textarea, div[contenteditable="true"], textarea');
        const imgs = Array.from(document.querySelectorAll('img'))
          .map((i) => i.src)
          .filter((s) => s && (s.includes('oaiusercontent') || s.startsWith('blob:') || s.includes('files.oaiusercontent')));
        const stop = !!document.querySelector('button[aria-label*="Stop" i], button[data-testid*="stop" i]');
        const fileInput = !!document.querySelector('input[type=file]');
        return { hasComposer: !!composer, composerTag: composer?.tagName, imgCount: imgs.length, lastImg: imgs[imgs.length - 1] || null, generating: stop, fileInput };
      });
      console.log('STATE', JSON.stringify(st));
    } else if (cmd === 'gen') {
      const [slug, refPath, promptFile] = rest;
      // Prepend a directive so ChatGPT invokes the image tool rather than just describing the scene.
      const prompt = 'Create a single image. ' + fs.readFileSync(promptFile, 'utf8').trim();
      const ctx = browser.contexts()[0];
      let page = await getCg(browser, { open: true });
      // fresh chat so no prior image bleeds into the style
      await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      // attach the style reference
      const input = await page.$('input[type=file]');
      if (!input) { console.log('NO_FILE_INPUT'); process.exit(3); }
      await input.setInputFiles(refPath);
      await page.waitForTimeout(4500); // let the upload thumbnail settle
      // Focus the visible ProseMirror composer (a contenteditable DIV, id prompt-textarea) and type.
      // focus() avoids the actionability wait that a click on the hidden a11y textarea would hang on.
      const composer = await page.$('#prompt-textarea');
      if (!composer) { console.log('NO_COMPOSER'); process.exit(4); }
      await composer.focus();
      await page.keyboard.insertText(prompt);
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      // Fallback: if Enter did not dispatch (composer still holds the text), click the send button.
      const still = await page.evaluate(() => (document.querySelector('#prompt-textarea')?.innerText || '').trim().length);
      if (still > 5) {
        const send = await page.$('button[data-testid="send-button"], button[aria-label*="Send" i]');
        if (send) await send.click().catch(() => {});
      }
      console.log('SENT', slug, '| chars', prompt.length);
    } else if (cmd === 'wait') {
      const page = await getCg(browser);
      if (!page) return console.log('NO_CHATGPT_TAB');
      const maxMs = parseInt(rest[0] || '240000', 10);
      const start = Date.now();
      let last = null;
      while (Date.now() - start < maxMs) {
        const st = await page.evaluate(() => {
          // The generated image alone carries alt="Generated image: ...". The uploaded reference carries
          // its filename as alt, so this cleanly excludes it. Require a large natural size so a streaming
          // low-res frame does not read as done.
          const imgs = Array.from(document.querySelectorAll('img[alt^="Generated image"]'))
            .filter((i) => i.naturalWidth >= 512)
            .map((i) => i.src);
          const stop = !!document.querySelector('button[aria-label*="Stop" i], button[data-testid*="stop" i]');
          return { lastImg: imgs[imgs.length - 1] || null, imgCount: imgs.length, generating: stop };
        });
        last = st;
        if (st.lastImg && !st.generating) { console.log('DONE', JSON.stringify(st)); process.exit(0); }
        await page.waitForTimeout(4000);
      }
      console.log('TIMEOUT', JSON.stringify(last));
    } else if (cmd === 'save') {
      const page = await getCg(browser);
      if (!page) return console.log('NO_CHATGPT_TAB');
      const url = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img[alt^="Generated image"]'))
          .filter((i) => i.naturalWidth >= 512)
          .map((i) => i.src);
        return imgs[imgs.length - 1] || null;
      });
      if (!url) { console.log('NO_IMAGE'); process.exit(5); }
      const resp = await page.request.get(url);
      const buf = await resp.body();
      fs.writeFileSync(rest[0], buf);
      console.log('SAVED', rest[0], buf.length, 'bytes | status', resp.status());
    } else {
      console.log('cmds: open|shot|state|gen|wait|save');
    }
  } catch (e) {
    console.log('ERR', e.message);
  }
  process.exit(0);
})();
