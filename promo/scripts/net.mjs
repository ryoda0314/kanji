// 映像に出す語と数を、アプリの辞書（../public/data）から作る。決まりはアプリと同じ（src/data/combine.ts の sameHanjaeo・
// discoverWords・unlockedBy・byEase、sounds.ts の wordSounds・composable、pages/Hanja.tsx の 받침 の分け方）。
//   src/net.json：冒頭の 소리 짝 の網。網の 소리 짝（下の PAIRS）と、その 소리 짝 だけで日本語で言える同じ漢字語すべて。
//                 網の輪の並びは、同じ語に並ぶ 소리 짝 どうしが近くに来るよう探す（회・사・원 は冒頭の三つの札から移るので上に固定）。
//   src/demo.json：アプリの画面の場面（모으기・말해 보기・소리 짝・한국어와 다른 점・문장에서 만나기）の語と数。
//   node scripts/net.mjs        語を変えたら走らせ直す（そのあと assets も）
import { readFileSync, writeFileSync } from "node:fs";

const APP = "..";
const words = JSON.parse(readFileSync(`${APP}/public/data/words.json`, "utf8"));
const kanji = JSON.parse(readFileSync(`${APP}/public/data/kanji.json`, "utf8"));
const sentences = JSON.parse(readFileSync(`${APP}/public/data/sentences.json`, "utf8")).sentences;
const charMap = new Map(kanji.map((k) => [k.char, k]));

// ---- アプリと同じ決まり -----------------------------------------------------------------------------------------------

const HAN = /\p{Script=Han}/u;
function split(text) {
  const out = [];
  for (const c of Array.from(text.normalize("NFC"))) {
    if (HAN.test(c)) out.push(c);
    else if (c === "々" && out.length) out.push(out[out.length - 1]);
  }
  return out;
}
const hasParts = (w) => !!w.rt && w.rt.length === split(w.kanji).length;
const composable = (w) => hasParts(w) && !w.odd?.length && split(w.kanji).length > 1;
const commonRank = (w) => w.lv ?? 4;
const same = (w) => !!w.ks && !!w.ko && (w.kl ?? 5) <= 4 && commonRank(w) !== 5;
const pairsOf = (w) => (hasParts(w) ? [...new Set(split(w.kanji).map((c, i) => `${c}|${w.base?.[i] ?? w.rt[i]}`))] : []);
const keyOf = (w) => `${w.kanji}|${w.kana}`;
const usable = words.filter((w) => same(w) && composable(w));
const sayable = (set) => usable.filter((w) => pairsOf(w).every((p) => set.has(p)));
const allJoyo = (w) => split(w.kanji).every((c) => charMap.get(c)?.joyo);
const easeLength = (w) => (split(w.kanji).length === 1 ? 99 : split(w.kanji).length);
const byEase = (a, b) =>
  Number(easeLength(a) === 99) - Number(easeLength(b) === 99) ||
  commonRank(a) - commonRank(b) ||
  (a.kl ?? 5) - (b.kl ?? 5) ||
  (b.fq ?? 0) - (a.fq ?? 0) ||
  easeLength(a) - easeLength(b) ||
  Number(allJoyo(b)) - Number(allJoyo(a)) ||
  a.kana.localeCompare(b.kana, "ja");
/** この語をあつめると新しく言えるようになる語（unlockedBy）。 */
function unlocked(word, set, owned) {
  const own = pairsOf(word);
  const fresh = own.filter((p) => !set.has(p));
  if (!fresh.length) return [];
  const after = new Set([...set, ...own]);
  return usable.filter((w) => keyOf(w) !== keyOf(word) && !owned.has(keyOf(w)) && pairsOf(w).some((p) => fresh.includes(p)) && pairsOf(w).every((p) => after.has(p))).sort(byEase);
}
/** 韓国語の漢字語から、いちばんよく使う同じ漢字語。 */
function pick(ko) {
  const w = usable.filter((x) => x.ko === ko).sort(byEase)[0];
  if (!w) throw new Error(`言える同じ漢字語ではない: ${ko}`);
  return w;
}
const eumOf = (c) => charMap.get(c)?.sounds?.[0]?.eum ?? "";
const hunOf = (c) => charMap.get(c)?.sounds?.[0]?.hun ?? "";
/** 韓国の字形（學）。日本の字と同じなら無し。 */
const koForm = (text) => {
  const ko = [...text].map((c) => charMap.get(c)?.ko ?? c).join("");
  return ko === text ? null : ko;
};
const pairData = (p) => {
  const [char, reading] = p.split("|");
  return { key: p, char, reading, eum: eumOf(char) };
};
/** 語の中の字ごと：韓国語の音、字、この語での読み（ふだんの読みと違えば base も）、訓。 */
const roots = (w) => split(w.kanji).map((c, i) => ({ char: c, ko: charMap.get(c)?.ko ?? null, eum: [...w.ko][i] ?? eumOf(c), hun: hunOf(c), rt: w.rt[i], base: w.base?.[i] ?? w.rt[i] }));
const wordData = (w) => ({ ko: w.ko, kanji: w.kanji, koForm: koForm(w.kanji), kana: w.kana, gloss: w.gloss, kd: w.kd ?? null, lv: w.lv ?? null, pairs: pairsOf(w) });

// ---- 冒頭の網 --------------------------------------------------------------------------------------------------------

/** 網の 소리 짝。はじめの三つは冒頭の札（회 かい・사 しゃ・원 いん）。 */
const PAIRS = "会かい 社しゃ 員いん 学がく 生せい 大だい 人じん 国こく 外がい 韓かん 語ご 時じ 間かん 長ちょう 者しゃ 文ぶん 化か 先せん 校こう 中ちゅう 科か 的てき 電でん 話わ"
  .split(" ")
  .map((p) => `${p[0]}|${p.slice(1)}`);
/** 冒頭ですでに組み上がっている語（회・사・원 の5語）。 */
const FIRST = ["회사", "사회", "회원", "사원", "회사원"];
/** 一つずつ見せる語（この順。日本語の声と一緒に）。残りは混ぜて一気に。 */
const SLOW = ["학생", "대학", "선생", "시간", "전화", "한국어", "외국인"];

const netSet = new Set(PAIRS);
const found = sayable(netSet);
const first = FIRST.map((ko) => found.find((w) => w.ko === ko) ?? (() => { throw new Error(`網で言えない: ${ko}`); })());
const slow = SLOW.map((ko) => found.find((w) => w.ko === ko) ?? (() => { throw new Error(`網で言えない: ${ko}`); })());
if (sayable(new Set(PAIRS.slice(0, 3))).length !== FIRST.length) throw new Error("회・사・원 の三つで言える語が FIRST と合わない");
/** 決まった種で混ぜる（何度走らせても同じ並び）。 */
const seeded = (s) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mixRandom = seeded(7);
const rest = found.filter((w) => !first.includes(w) && !slow.includes(w)).sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
for (let i = rest.length - 1; i > 0; i--) {
  const j = Math.floor(mixRandom() * (i + 1));
  [rest[i], rest[j]] = [rest[j], rest[i]];
}
const ordered = [...first, ...slow, ...rest];

// 輪の並び：語の中で隣り合う 소리 짝 の組を、輪の上でも近くに（組の数 × 輪の上の隔たり の和を小さく）。
const N = PAIRS.length;
const weight = new Map();
for (const w of ordered) {
  const ps = split(w.kanji).map((c, i) => `${c}|${w.base?.[i] ?? w.rt[i]}`);
  for (let i = 1; i < ps.length; i++) {
    if (ps[i - 1] === ps[i]) continue;
    const k = [ps[i - 1], ps[i]].sort().join("~");
    weight.set(k, (weight.get(k) ?? 0) + 1);
  }
}
const fixed = new Map([
  [PAIRS[0], N - 1],
  [PAIRS[1], 0],
  [PAIRS[2], 1],
]);
const random = seeded(20261102);
const cost = (at) => {
  let sum = 0;
  for (const [k, n] of weight) {
    const [a, b] = k.split("~");
    const d = Math.abs(at.get(a) - at.get(b));
    sum += n * Math.min(d, N - d);
  }
  return sum;
};
const free = PAIRS.filter((k) => !fixed.has(k));
const slots = Array.from({ length: N }, (_, i) => i).filter((i) => ![...fixed.values()].includes(i));
let best = null;
for (let restart = 0; restart < 40; restart++) {
  const order = [...free].sort(() => random() - 0.5);
  const at = new Map([...fixed, ...order.map((k, i) => [k, slots[i]])]);
  let now = cost(at);
  for (let step = 0; step < 6000; step++) {
    const a = free[Math.floor(random() * free.length)];
    const b = free[Math.floor(random() * free.length)];
    if (a === b) continue;
    const pa = at.get(a);
    at.set(a, at.get(b));
    at.set(b, pa);
    const next = cost(at);
    const temp = 2 * (1 - step / 6000);
    if (next <= now || random() < Math.exp((now - next) / Math.max(temp, 1e-6))) now = next;
    else {
      at.set(b, at.get(a));
      at.set(a, pa);
    }
  }
  if (!best || now < best.cost) best = { cost: now, at: new Map(at) };
}
const ring = [...best.at.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);

const net = {
  note: "scripts/net.mjs が作る。소리 짝 と、その 소리 짝 だけで日本語で言える同じ漢字語（アプリの辞書 public/data のとおり）。",
  pairs: ring.map(pairData),
  words: ordered.map((w) => ({ ko: w.ko, kanji: w.kanji, kana: w.kana, lv: w.lv ?? null, kl: w.kl ?? null, pairs: split(w.kanji).map((c, i) => `${c}|${w.base?.[i] ?? w.rt[i]}`) })),
  first: first.length,
  slow: slow.length,
};
writeFileSync("src/net.json", `${JSON.stringify(net, null, 1)}\n`);
console.log(`  網：소리 짝 ${N}개로 ${ordered.length}단어（隔たりの和 ${best.cost}）`);

// ---- アプリの画面の場面 -----------------------------------------------------------------------------------------------

/** 모으기：学ぶ人はこの4語を集めたところから。そこへ 회의 を打ってあつめる。 */
const OWNED = ["학생", "대학", "교실", "사장"];
const TYPED = "회의";
/** 말해 보기：회의 をあつめて言えるようになった、まだ集めていない語。 */
const SAY = "교회";
/** 소리 짝：しばらく集めたあとの手持ち（받침ごとに並べると、対応が見えてくる）。 */
const LATER = [...OWNED, TYPED, "한국", "가족", "약속", "시간", "문제", "전화", "음악", "운동", "생활", "결정", "발표", "입학", "신문", "식당", "병원", "은행", "목적", "출발", "필요", "남자"];
/** 한국어와 다른 점：日本語では別の漢字で言う語。 */
const DIFF = "공부";

const owned = OWNED.map(pick);
const ownedSet = new Set(owned.flatMap(pairsOf));
const ownedKeys = new Set(owned.map(keyOf));
const typed = pick(TYPED);
const opened = unlocked(typed, ownedSet, ownedKeys);
const afterSet = new Set([...ownedSet, ...pairsOf(typed)]);
const afterKeys = new Set([...ownedKeys, keyOf(typed)]);
const say = pick(SAY);
if (!opened.some((w) => keyOf(w) === keyOf(say))) throw new Error(`${SAY} は ${TYPED} で言えるようにならない`);

const later = LATER.map(pick);
const laterSet = new Set(later.flatMap(pairsOf));
const finalOf = (eum) => {
  const code = (eum.codePointAt(0) ?? 0) - 0xac00;
  if (code < 0 || code > 11171) return "other";
  return { 0: "none", 1: "ㄱ", 4: "ㄴ", 8: "ㄹ", 16: "ㅁ", 17: "ㅂ", 21: "ㅇ" }[code % 28] ?? "other";
};
const isOn = (char, reading) => (charMap.get(char)?.on ?? []).some((on) => on.replace(/[ァ-ヶ]/g, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60)) === reading);
const rows = [...laterSet]
  .map(pairData)
  .map((p) => ({ ...p, on: isOn(p.char, p.reading) }))
  .sort((a, b) => a.eum.localeCompare(b.eum, "ko") || a.reading.localeCompare(b.reading, "ja"));
const FINALS = ["none", "ㄱ", "ㄴ", "ㄹ", "ㅁ", "ㅂ", "ㅇ", "other"];
const groups = FINALS.map((f) => ({ f, list: rows.filter((r) => r.on && r.eum && finalOf(r.eum) === f).map(({ char, reading, eum }) => ({ char, reading, eum })) })).filter((g) => g.list.length);

/** 한국어와 다른 점：그 한국어の語の意味で言う日本語の語（meaning）と、同じ漢字で意味の違う語（kanji）。 */
const diffMeaning = words.filter((w) => !w.ko && w.gloss?.split(/,\s*/).includes(DIFF)).sort(byEase);
const diffKanji = words.filter((w) => w.ko === DIFF && !w.ks).sort(byEase);

// 문장에서 만나기：あつめたあとの手持ちで、集めた語（owned）と言える語（readable）の入った短い文。
const statusOf = (kanjiText, kana) => {
  const w = words.find((x) => x.kanji === kanjiText && x.kana === kana);
  if (!w) return "new";
  if (afterKeys.has(keyOf(w))) return "owned";
  if (same(w) && composable(w) && pairsOf(w).every((p) => afterSet.has(p))) return "readable";
  return "new";
};
const scored = sentences
  .map((s, id) => ({ id, s, marks: s.w.map(([start, end, k, kana]) => ({ start, end, kanji: k, kana, status: statusOf(k, kana) })) }))
  .filter((x) => x.s.ja.length <= 16 && x.marks.some((m) => m.status !== "new"));
const pickSentence = (want) => {
  const hit = scored.find((x) => want(x) && !chosen.includes(x));
  if (!hit) throw new Error("文が見つからない");
  chosen.push(hit);
};
const chosen = [];
pickSentence((x) => x.marks.some((m) => m.kanji === "会議" && m.status === "owned"));
pickSentence((x) => x.marks.some((m) => m.kanji === "会社" && m.status === "readable"));
pickSentence((x) => x.marks.some((m) => m.kanji === "大学" && m.status === "owned") && x.marks.some((m) => m.status === "new"));
pickSentence((x) => x.marks.some((m) => m.kanji === "教会" && m.status === "readable"));

/**
 * 文を、映像の一切れずつに（ui.tsx の Seg）：ただの字か、印の語（owned・readable・new）か、ふりがなだけの語（ruby）。
 * ふりがなは字の部分だけに付ける（終わって の 終 に お。辞書の形 終わる・おわる から送りがなを外して）。
 */
function segsOf(ja, marks, rubies) {
  const spans = [...marks.map((m) => ({ ...m, kind: m.status })), ...rubies.map((r) => ({ ...r, kind: "ruby" }))].sort((a, b) => a.start - b.start);
  const out = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) out.push(ja.slice(at, s.start));
    const surface = ja.slice(s.start, s.end);
    const kanjiPart = surface.replace(/[぀-ゟ]+$/, "");
    const okuri = s.kanji.slice(kanjiPart.length);
    if (!s.kanji.startsWith(kanjiPart) || !s.kana.endsWith(okuri)) throw new Error(`ふりがなを付けられない: ${surface} (${s.kanji} ${s.kana})`);
    out.push({ text: kanjiPart, kind: s.kind, rt: s.kana.slice(0, s.kana.length - okuri.length) });
    if (surface.length > kanjiPart.length) out.push(surface.slice(kanjiPart.length));
    at = s.end;
  }
  if (at < ja.length) out.push(ja.slice(at));
  return out;
}

const demo = {
  note: "scripts/net.mjs が作る。アプリの辞書 public/data のとおり。",
  owned: owned.map(wordData),
  ownedSayable: sayable(ownedSet).length,
  ownedPairs: ownedSet.size,
  typed: { ...wordData(typed), roots: roots(typed) },
  opened: opened.map(wordData),
  afterSayable: sayable(afterSet).length,
  afterPairs: afterSet.size,
  say: { ...wordData(say), roots: roots(say) },
  pairs: { count: laterSet.size, sayable: sayable(laterSet).length, words: later.length, groups },
  diff: { ko: DIFF, meaning: diffMeaning.slice(0, 1).map(wordData), kanji: diffKanji.slice(0, 1).map(wordData) },
  sentences: chosen.map(({ id, s, marks }) => ({
    id,
    ko: s.ko,
    segs: segsOf(
      s.ja,
      marks,
      (s.r ?? []).map(([start, end, k, kana]) => ({ start, end, kanji: k, kana })),
    ),
  })),
};
writeFileSync("src/demo.json", `${JSON.stringify(demo, null, 1)}\n`);
console.log(`  모으기：${OWNED.join("·")}（말할 수 있는 한자어 ${demo.ownedSayable}・소리 짝 ${demo.ownedPairs}）→ ${TYPED} で +${opened.length}（${opened.map((w) => w.ko).join("·")}）→ ${demo.afterSayable}・${demo.afterPairs}`);
console.log(`  말해 보기：${say.ko} ${say.kanji} ${say.kana}`);
console.log(`  소리 짝：${later.length}단어・소리 짝 ${laterSet.size}개・말할 수 있는 한자어 ${demo.pairs.sayable}개｜${groups.map((g) => `${g.f}:${g.list.map((r) => `${r.eum}${r.reading}`).join(",")}`).join(" ")}`);
console.log(`  한국어와 다른 점：${DIFF} → ${diffMeaning.slice(0, 1).map((w) => `${w.kanji} ${w.kana}`)}／${diffKanji.slice(0, 1).map((w) => `${w.kanji} ${w.kana} ${w.gloss}`)}`);
console.log(`  문장：${chosen.map((x) => `${x.s.ja}［${x.marks.map((m) => `${m.kanji}:${m.status}`).join(",")}］`).join("  ")}`);
