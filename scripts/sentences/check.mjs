// 書き足した文（말씨앗 のために書いた文）を確かめる。
//   node scripts/sentences/check.mjs <文の json> [--targets <狙う語の json>]
// 文の json は {"sentences":[{"word":"支援|しえん","ja":"…","ko":"…"}]}。一つずつ見る：
//   ① 狙った語が、辞書の漢字語（同じ漢字・同じ意味で韓国語でも使う語）か
//   ② 日本語の文が、文で出会う と同じ印の付け方で、狙った語（表記と読み）として拾えるか（長い語の一部になっていないか・
//      別の読みに取られていないか）
//   ③ 韓国語の訳に、同じ漢字語（지원）が入っているか（文の組の中で 支援 ↔ 지원 が見えるように）
//   ④ 長すぎないか（日本語 40 字・韓国語 60 字まで）、ことのあめ の文やほかの書いた文と同じでないか
// --targets を付けると、狙う語ごとに、通った文が足りているか（need）も数える。

import fs from "node:fs";
import path from "node:path";
import { createMarker, isHanjaeo } from "./marker.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const targetsAt = args.indexOf("--targets");
const targetsFile = targetsAt >= 0 ? args[targetsAt + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && !(targetsAt >= 0 && i === targetsAt + 1));
if (!files.length) {
  console.error("使い方: node scripts/sentences/check.mjs <文の json> [--targets <狙う語の json>]");
  process.exit(1);
}

const words = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/words.json"), "utf8"));
const byKey = new Map(words.map((w) => [`${w.kanji}|${w.kana}`, w]));
const { mark } = await createMarker(words);

// すでにある文（ことのあめ の文の日本語訳と、ほかの書いた文）
const existing = new Set(
  JSON.parse(fs.readFileSync(path.resolve(ROOT, "../hanjaatume/public/data/sentences.json"), "utf8")).sentences.map((s) => s.ja)
);
const dir = path.join(ROOT, "scripts/sentences");
// 確かめているファイル（置いてある hashi-*.json を確かめ直すとき）は、すでにある文に数えない。
const checking = new Set(files.map((f) => path.resolve(f)));
for (const f of fs.readdirSync(dir).filter((f) => /^hashi-.*\.json$/.test(f) && !checking.has(path.join(dir, f)))) {
  for (const s of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).sentences) existing.add(s.ja);
}

const passed = new Map(); // 語 -> 通った文の数
let ok = 0;
let bad = 0;
const seenHere = new Set();
for (const file of files) {
  const list = JSON.parse(fs.readFileSync(file, "utf8")).sentences ?? [];
  list.forEach((s, i) => {
    const problems = [];
    const w = byKey.get(s.word);
    if (!w) problems.push("辞書に無い語（word は 表記|読み）");
    else if (!isHanjaeo(w)) problems.push("말씨앗 の漢字語ではない語");
    if (typeof s.ja !== "string" || typeof s.ko !== "string" || !s.ja.trim() || !s.ko.trim()) problems.push("ja・ko が空");
    else {
      if (Array.from(s.ja).length > 40) problems.push(`日本語が長い（${Array.from(s.ja).length} 字。40 字まで）`);
      if (Array.from(s.ko).length > 60) problems.push(`韓国語が長い（${Array.from(s.ko).length} 字。60 字まで）`);
      if (existing.has(s.ja) || seenHere.has(s.ja)) problems.push("同じ文がもうある");
      if (w) {
        const marks = mark(s.ja);
        const hit = marks.some(([, , kanji, kana]) => kanji === w.kanji && kana === w.kana);
        if (!hit) {
          const got = marks.map(([a, b, kanji, kana]) => `${s.ja.slice(a, b)}=${kanji}(${kana})`).join(" ") || "（印なし）";
          problems.push(`「${w.kanji}（${w.kana}）」として拾えない。拾えた語: ${got}`);
        }
        // 韓国語の訳には、同じ漢字語（지원）か、この語の韓国語の意味（生徒 なら 학생）のどれかが入っていること。
        const meanings = [
          ...new Set([w.ko, ...(w.en ? [] : w.gloss.split(/,\s*/).map((x) => x.replace(/\s*\(.*?\)\s*/g, "").trim()))].filter(Boolean)),
        ];
        if (!meanings.some((m) => s.ko.includes(m))) problems.push(`韓国語の訳に「${meanings.join("」「")}」のどれも無い`);
      }
    }
    seenHere.add(s.ja);
    if (problems.length) {
      bad++;
      console.log(`✗ ${path.basename(file)}#${i} ${s.word}: ${problems.join(" / ")}\n    ${s.ja} | ${s.ko}`);
    } else {
      ok++;
      passed.set(s.word, (passed.get(s.word) ?? 0) + 1);
    }
  });
}
console.log(`\n通った文 ${ok}・通らなかった文 ${bad}`);

if (targetsFile) {
  const targets = JSON.parse(fs.readFileSync(targetsFile, "utf8")).targets;
  const short = targets.filter((t) => (passed.get(t.word) ?? 0) < t.need);
  console.log(`狙う語 ${targets.length} 語のうち、通った文が足りない語 ${short.length} 語`);
  if (short.length) console.log(`  足りない語: ${short.map((t) => `${t.word}（${passed.get(t.word) ?? 0}/${t.need}）`).join(" ")}`);
}
