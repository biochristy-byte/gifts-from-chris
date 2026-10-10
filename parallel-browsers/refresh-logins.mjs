// Refresh the logins every parallel Playwright session starts from.
//
// Run after logging into a new site through the `playwright-profile` server
// (close that browser first):  node refresh-logins.mjs
//
// Only cookies for the sites in KEEP are exported, and the saved profile is
// swept to the same list, so ad trackers never ride along into test browsers.
// Pass --dry-run to see what would be kept and dropped without changing anything.
import { createRequire } from "module";
import { readdirSync, existsSync, copyFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// EDIT THIS LIST. These are example sites: replace them with the sites you log
// into. A site not on this list is dropped from the saved profile and from the
// storage-state file. Need a new site logged in? Add its domain here, then rerun.
const KEEP = [
  "github.com", "netlify.com", "supabase.com", "slack.com",
  "localhost", "127.0.0.1",
];

const HOME = homedir();
const PROFILE = join(HOME, ".claude-browser-profile");
const STATE = join(HOME, ".claude", "pw-storage-state.json");
const BACKUPS = join(HOME, ".claude", "pw-profile-cookie-backups");
const DRY = process.argv.includes("--dry-run");

const keep = c => {
  const d = c.domain.replace(/^\./, "");
  return KEEP.some(k => d === k || d.endsWith("." + k));
};

// Find the `playwright` package inside the npx cache that @playwright/mcp filled.
const localAppData = process.env.LOCALAPPDATA || join(HOME, "AppData", "Local");
const caches = [
  join(localAppData, "npm-cache", "_npx"), // Windows
  join(HOME, ".npm", "_npx"),              // Mac and Linux
];
let dir;
for (const cache of caches) {
  if (!existsSync(cache)) continue;
  dir = readdirSync(cache).map(d => join(cache, d, "node_modules"))
    .find(d => existsSync(join(d, "playwright")));
  if (dir) break;
}
if (!dir) {
  throw new Error(
    "no playwright package in the npx cache (looked in: " + caches.join(", ") + "). " +
    "Run `npx -y @playwright/mcp@latest --version` once to fill it, then rerun.");
}
const { chromium } = createRequire(dir + "/")("playwright");

// Back up the cookie database first, BEFORE the browser launches: it is locked once the browser is open.
if (!DRY) {
  mkdirSync(BACKUPS, { recursive: true });
  const src = join(PROFILE, "Default", "Network", "Cookies");
  if (existsSync(src)) copyFileSync(src, join(BACKUPS, `Cookies-${Date.now()}`));
}
const ctx = await chromium.launchPersistentContext(PROFILE, { channel: "msedge", headless: true });
const all = await ctx.cookies();
const kept = all.filter(keep);
const domains = [...new Set(kept.map(c => c.domain.replace(/^\./, "")))].sort();
console.log(`profile ${PROFILE} had ${all.length} cookies; keeping ${kept.length} on ${domains.length} sites: ${domains.join(" ") || "(none)"}`);

if (!DRY) {
  if (kept.length < all.length) {
    await ctx.clearCookies();
    if (kept.length) await ctx.addCookies(kept);
  }
  const s = await ctx.storageState({ path: STATE });
  console.log(`saved ${s.cookies.length} cookies to ${STATE}`);
} else {
  console.log("dry run: nothing changed");
}
await ctx.close();
