// 映像に要るものを public/ に集める。
//   - アプリのアイコン（../public/icons/icon-512.png）
//   - アプリの字（IBM Plex Sans KR・IBM Plex Sans JP・Noto Serif JP・Noto Serif KR・고운바탕）。Google Fonts の倉庫（OFL）から
//     まるごと取り、映像の元（src/）に出てくる字だけに切る（Python の fontTools）。まるごとの日本語・韓国語の字は
//     数 MB あり、書き出しの各ページで読むと時間切れになることがある。言葉を変えたら、もう一度走らせる。
//   node scripts/assets.mjs        (npm run assets)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = "..";
const FONTS = {
  "IBMPlexSansKR-Regular.ttf": "ibmplexsanskr/IBMPlexSansKR-Regular.ttf",
  "IBMPlexSansKR-Medium.ttf": "ibmplexsanskr/IBMPlexSansKR-Medium.ttf",
  "IBMPlexSansKR-SemiBold.ttf": "ibmplexsanskr/IBMPlexSansKR-SemiBold.ttf",
  "IBMPlexSansJP-Regular.ttf": "ibmplexsansjp/IBMPlexSansJP-Regular.ttf",
  "IBMPlexSansJP-Medium.ttf": "ibmplexsansjp/IBMPlexSansJP-Medium.ttf",
  "IBMPlexSansJP-SemiBold.ttf": "ibmplexsansjp/IBMPlexSansJP-SemiBold.ttf",
  "NotoSerifJP.ttf": "notoserifjp/NotoSerifJP%5Bwght%5D.ttf",
  "NotoSerifKR.ttf": "notoserifkr/NotoSerifKR%5Bwght%5D.ttf",
  "GowunBatang-Bold.ttf": "gowunbatang/GowunBatang-Bold.ttf",
};
const WHOLE = "node_modules/.cache/fonts";

mkdirSync("public/app", { recursive: true });
mkdirSync("public/fonts", { recursive: true });
mkdirSync(WHOLE, { recursive: true });
copyFileSync(`${APP}/public/icons/icon-512.png`, "public/app/icon.png");

// 映像の元に出てくる字（と、印字できる ASCII すべて）。語と文は src/*.json にある。
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const chars = new Set(Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)));
for (const file of walk("src")) for (const ch of readFileSync(file, "utf8")) if (ch > "\u007f") chars.add(ch);
writeFileSync(`${WHOLE}/chars.txt`, [...chars].join(""));

/** 取り出しは、つながりが切れることがあるので数回まで。 */
async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

for (const [file, path] of Object.entries(FONTS)) {
  if (!existsSync(`${WHOLE}/${file}`)) {
    writeFileSync(`${WHOLE}/${file}`, await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${path}`));
    console.log(`  font ${file}`);
  }
  const cut = spawnSync(
    "python",
    ["-m", "fontTools.subset", `${WHOLE}/${file}`, `--text-file=${WHOLE}/chars.txt`, `--output-file=public/fonts/${file}`, "--layout-features=*", "--no-hinting"],
    { encoding: "utf8" },
  );
  if (cut.status !== 0) throw new Error(`cutting ${file} (pip install fonttools): ${cut.stderr}`);
}
console.log(`  fonts cut to ${chars.size} characters`);
