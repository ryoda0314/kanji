// 映像の音の区切り（秒）を JSON で書き出す。scripts/music.py に渡す。
//   node scripts/marks.mjs | python scripts/music.py public/sound                                     紹介映像（src/timeline.ts の MUSIC_MARKS）
//   node scripts/marks.mjs install | python scripts/music.py public/sound --music music-install.wav    ホーム画面への追加のしかた
//   （どちらも npm run music）
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const install = process.argv[2] === "install";
const entry = install ? "src/installTimeline.ts" : "src/timeline.ts";
const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", external: ["remotion"], write: false });
mkdirSync("node_modules/.cache", { recursive: true });
const file = `node_modules/.cache/${install ? "install-" : ""}timeline.mjs`;
writeFileSync(file, out.outputFiles[0].text);
const mod = await import(pathToFileURL(file).href);
process.stdout.write(JSON.stringify(install ? mod.INSTALL_MARKS : mod.MUSIC_MARKS));
