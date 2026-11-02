// 使われ方の数の画像（X に貼る横長 1200×675）の書き出し：いまの数を読んで、数を並べた版（stats.html → stats.png）と、
// 集めた語の数だけ点を打って下に積もらせた版（stats-pile.html → stats-pile.png）に入れて写す。点がつぶれないよう2倍の細かさで。
// 数は scripts/usage.mjs と同じく、ことのあめ の service role で Supabase の中のまとめ（kn_summary・kn_stats）だけを読む。
// 投稿の直前に書き出し直す（数は増え続ける）。ヘッドレス Chrome で描く（字は Google Fonts から読むので、つながった状態で）。
//   node --env-file=../polylinga/.env.local scripts/og/stats.mjs [Chrome のパス]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要ります（ことのあめ の .env.local を --env-file で）。");
  process.exit(1);
}
const chrome =
  process.argv[2] ??
  process.env.CHROME ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error("Chrome が見つかりません。パスを引数で渡してください。");
  process.exit(1);
}

async function get(p) {
  const res = await fetch(`${url}/rest/v1/${p}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    console.error(`読めませんでした（${res.status}）：${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  return res.json();
}

const [summary] = await get("kn_summary");
const days = (await get("kn_stats?order=day.asc")).filter((r) => Number(r.devices) > 0);
const total = (k) => days.reduce((n, r) => n + Number(r[k]), 0);
const num = (v) => Number(v).toLocaleString("ja-JP");
const md = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, label: `${m}月${d}日` };
};
const first = md(days[0].day);
const last = md(days.at(-1).day);
const range = `${first.y}年${first.label}〜${last.y === first.y ? "" : `${last.y}年`}${last.label}`;

// 公開先は .env の VITE_SITE_URL（無ければ出さない）。
let site = "";
try {
  site = (fs.readFileSync(path.resolve(here, "../../.env"), "utf8").match(/^VITE_SITE_URL=(.*)$/m)?.[1] ?? "").trim();
} catch {
  /* .env が無い */
}
site = site.replace(/^["']|["']$/g, "").replace(/^https?:\/\//, "").replace(/\/$/, "");

// アイコンは書き出したもの（角を丸めた public/icons/icon-512.png）。
const icon = `<img src="${pathToFileURL(path.resolve(here, "../../public/icons/icon-512.png")).href}" alt="">`;
const fill = {
  ICON: icon,
  RANGE: range,
  WORDS: num(total("collects")),
  WORDS_RAW: String(total("collects")),
  READS: num(total("reads")),
  DEVICES: num(summary.devices_all),
  URL: site,
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kotonone-stats-"));
for (const name of ["stats", "stats-pile"]) {
  const html = fs.readFileSync(path.join(here, `${name}.html`), "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => fill[k] ?? "");
  const htmlFile = path.join(tmp, `${name}.html`);
  fs.writeFileSync(htmlFile, html);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--window-size=1200,675",
      // 字の読み込みを待つ
      "--virtual-time-budget=8000",
      `--screenshot=${path.join(here, `${name}.png`)}`,
      pathToFileURL(htmlFile).href,
    ],
    { stdio: "ignore" }
  );
  console.log(`  scripts/og/${name}.png`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  ${range}：集めた語 ${fill.WORDS}・読めた ${fill.READS}回・端末 ${fill.DEVICES}台`);
