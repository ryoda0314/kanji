// 文で出会う の例文を作る：ことのね の例文（姉妹アプリ ことのあめ の韓国語の文と、その日本語訳。
// ../hanjaatume/public/data/sentences.json）を、日本語の文と韓国語の訳にひっくり返したものと、말씨앗 のために書いた文
// （scripts/sentences/hashi-*.json。ことのあめ の文に出てこない漢字語のため）。日本語の文の中の漢字の語に、
// 辞書（public/data/words.json）の語の印を付けて public/data/sentences.json に書く（印の付け方は scripts/sentences/marker.mjs）。
//
// 말씨앗 では、印（押せる・数える語）は 同じ漢字・同じ意味の漢字語（src/data/combine.ts の sameHanjaeo と同じ決まり）だけ。
// ほかの漢字の語（奥さん・難しい・働く）は、ふりがなだけを添える語として r に分けて書く。漢字語の無い文は入れない。
//
// 実行: npm run build:sentences（先に npm run build:data）

import fs from "node:fs";
import path from "node:path";
import { toHiragana } from "../src/data/kana.ts";
import { createMarker, isHanjaeo } from "./sentences/marker.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.resolve(ROOT, "../hanjaatume/public/data/sentences.json");
const WRITTEN = path.join(ROOT, "scripts/sentences");
const OUT = path.join(ROOT, "public/data/sentences.json");

const { mark } = await createMarker();

// 元の文：ことのあめ の文（ことのね の例文）と、말씨앗 のために書いた文（書いた順）。同じ日本語の文は一度。
const sources = JSON.parse(fs.readFileSync(SOURCE, "utf8")).sentences.map((s) => ({ ja: s.ja, ko: s.ko }));
const written = fs
  .readdirSync(WRITTEN)
  .filter((f) => /^hashi-.*\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(WRITTEN, f), "utf8")).sentences.map((s) => ({ ja: s.ja, ko: s.ko })));
const seen = new Set();
const all = [...sources, ...written].filter((s) => (seen.has(s.ja) ? false : (seen.add(s.ja), true)));

const out = [];
let marks = 0;
const used = new Set();
for (const s of all) {
  const w = mark(s.ja);
  // 漢字語（同じ漢字・同じ意味で、韓国語でも使う語）は印に。ほかは、ふりがなだけを添える語に。
  const hanjaeo = w.filter((x) => isHanjaeo(x[4])).map((x) => x.slice(0, 4));
  const ruby = w.filter((x) => !isHanjaeo(x[4])).map((x) => x.slice(0, 4));
  if (hanjaeo.length === 0) continue;
  marks += hanjaeo.length;
  for (const [, , kanji, kana] of hanjaeo) used.add(`${kanji}|${kana}`);
  out.push(ruby.length ? { ja: s.ja, ko: s.ko, w: hanjaeo, r: ruby } : { ja: s.ja, ko: s.ko, w: hanjaeo });
}

fs.writeFileSync(OUT, JSON.stringify({ source: "kotonoame+kotonone (ja) + hashi", sentences: out }));
console.log(
  `例文: ${out.length} 文（元 ${sources.length} 文・書き足した文 ${written.length} 文）・印 ${marks}・出てくる語 ${used.size}・` +
    `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`
);
// 確かめ用：はじめの数文
for (const s of out.slice(0, 6)) {
  console.log(`  ${s.ja}  ${s.w.map(([a, b, k, r]) => `${s.ja.slice(a, b)}=${k}(${toHiragana(r)})`).join(" ")}`);
}
