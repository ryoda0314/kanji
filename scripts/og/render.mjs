// リンクを貼ったときの絵の書き出し：og.html を 1200×630 の public/og.png に。
// ヘッドレス Chrome で描く（字は Google Fonts から読むので、つながった状態で）。実行: node scripts/og/render.mjs [Chrome のパス]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../public/og.png");
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

// アイコンは書き出したもの（角を丸めた public/icons/icon-512.png。作り直すときは先に scripts/icon/render.mjs）。
const icon = `<img src="${pathToFileURL(path.resolve(here, "../../public/icons/icon-512.png")).href}" alt="">`;
const html = fs.readFileSync(path.join(here, "og.html"), "utf8").replace("{{ICON}}", icon);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kotonone-og-"));
const htmlFile = path.join(tmp, "og.html");
fs.writeFileSync(htmlFile, html);
execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    // 字の読み込みを待つ
    "--virtual-time-budget=8000",
    `--screenshot=${out}`,
    pathToFileURL(htmlFile).href,
  ],
  { stdio: "ignore" }
);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  public/og.png`);
