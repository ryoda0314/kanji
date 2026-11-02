// 1コマだけ書き出して見る（一度の束ねで）：
//   node scripts/stills.mjs <書き出し先> <コマ> [<コマ> ...]       (npm run stills -- 300 1240)
//   COMP=Install で、ほかの映像（ホーム画面への追加のしかた）から。
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [dir, ...frames] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "Promo" });
for (const f of frames.map(Number)) {
  const output = path.join(dir, `f${String(f).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame: f, output });
  console.log(output);
}
