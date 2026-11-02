// アイコンの書き出し：icon-source.png（ChatGPT で描いた元の絵、1254×1254・全面に紙の色）から、
//   icon-192/512.png        角を丸めて外は透明（ブラウザのタブ・アプリの中の小さなアイコン）
//   maskable-512.png        全面に塗り、絵を中心の円（直径 80%）に収める（Android がまるく切り抜いても欠けない）
//   apple-touch-icon.png    180×180、全面に塗る（角は iOS が丸める。透明の角は黒く塗られてしまう）
// ヘッドレス Chrome で描く。実行: node scripts/icon/render.mjs [Chrome のパス]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../public/icons");
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

const source = pathToFileURL(path.join(here, "icon-source.png")).href;
/** 元の絵の地の色（四隅の色）。縮めたときのまわりも、この色で塗る。 */
const PAPER = "#fefdfa";
/** 角の丸み（一辺に対する割合。前のアイコンと同じ 112/512）。 */
const RADIUS = 112 / 512;
// 元の絵は、横 8.9〜91.3%・縦 27.6〜84.3% にある（真ん中より 6% ほど下）。
// maskable は 84% に縮め、そのぶん上げて真ん中に置く：羽の先も根の先も、中心から 40% の円に入る。
const MASK = { scale: 0.84, lift: 5.0 };

const jobs = [
  { png: "icon-512.png", size: 512, round: true },
  { png: "icon-192.png", size: 192, round: true },
  { png: "maskable-512.png", size: 512, round: false, ...MASK },
  { png: "apple-touch-icon.png", size: 180, round: false },
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kotonone-icon-"));
for (const job of jobs) {
  const htmlFile = path.join(tmp, `${job.png}.html`);
  const radius = job.round ? Math.round(job.size * RADIUS) : 0;
  const transform = job.scale ? `translateY(-${job.lift}%) scale(${job.scale})` : "none";
  fs.writeFileSync(
    htmlFile,
    `<!doctype html><style>html,body{margin:0;background:transparent}` +
      `.i{position:relative;width:${job.size}px;height:${job.size}px;overflow:hidden;border-radius:${radius}px;background:${PAPER}}` +
      `.i img{position:absolute;inset:0;width:100%;height:100%;transform:${transform};transform-origin:50% 50%}</style>` +
      `<div class="i"><img src="${source}"></div>`
  );
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${job.size},${job.size}`,
      `--screenshot=${path.join(out, job.png)}`,
      pathToFileURL(htmlFile).href,
    ],
    { stdio: "ignore" }
  );
  console.log(`  public/icons/${job.png}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
