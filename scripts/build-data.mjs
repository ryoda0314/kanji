// 辞書データの生成：日本語の語（漢字を含む語）と字の情報を public/data/{words,kanji}.json に書き出す。
// 글씨앗（../kanji）の scripts/build-data.mjs と同じ作り。말씨앗 では語に、同じ漢字の韓国語の語が同じ意味か（ks）と、
// その韓国語の語をどれくらいよく使うか（kl）も書く（韓国語の漢字語から日本語の語へ渡るため）。
//
// 入力（scripts/.cache。無ければ 글씨앗 の ../kanji/scripts/.cache、ことのね の ../hanjaatume/scripts/.cache から読む）
//   - JmdictFurigana.json      … 語の字ごとの読み（学[がっ]校[こう]）。Doublevil/JmdictFurigana（CC BY-SA 4.0、JMdict 由来）
//   - jmdict/jmdict-eng-*.json … JMdict（EDRDG、CC BY-SA 4.0）。語の選び方（よく使う語の印）と英語の意味
//   - kanjidic2-en-*.json      … KANJIDIC2（EDRDG、CC BY-SA 4.0）。字の音読み・訓読み・韓国語の音・画数・学年
//   - kanji-data.json          … davidluzgouveia/kanji-data（MIT）。字の JLPT の級（N5〜N1）
//   - jlpt/n1.csv … n5.csv     … jamsinclair/open-anki-jlpt-decks（MIT、もとは tanos.co.uk の一覧）。語の JLPT の級
//   - freq/ja_full.txt         … FrequencyWords（hermitdave、CC BY-SA 4.0）。映画・ドラマの字幕の日本語でよく使うか
//   - hanja.txt                … libhangul（BSD）。字の韓国語の訓（배울 학 の 배울）
//   - krdict/*.xml             … 한국어기초사전（国立国語院、CC BY-SA 2.0 KR）。韓国語の語の日本語の対訳を逆に引いて、語の韓国語の意味に
//   - kyujitai.json            … 新字体 → 旧字体（韓国の字）
// もう一つの入力：ことのね の辞書（../hanjaatume/public/data/words.json・hanja-chars.json）。韓国語の漢字語（학생 學生）と、
// 字の韓国語の訓と音（學 배울 학）。同じ漢字の韓国語の語を、日本語の語の「韓国語の漢字語」として添える。
//
// 取得（この環境では codeload / github の releases から）
//   mkdir -p scripts/.cache/jlpt scripts/.cache/freq
//   curl -L -o scripts/.cache/JmdictFurigana.json https://github.com/Doublevil/JmdictFurigana/releases/download/2.3.1%2B2026-10-25/JmdictFurigana.json
//   curl -L https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261026175559/kanjidic2-en-3.6.2%2B20261026175559.json.tgz | tar -xz -C scripts/.cache
//   curl -L -o scripts/.cache/kanji-data.json https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json
//   for n in 1 2 3 4 5; do curl -L -o scripts/.cache/jlpt/n$n.csv https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/n$n.csv; done
//   curl -L -o scripts/.cache/freq/ja_full.txt https://cdn.jsdelivr.net/gh/hermitdave/FrequencyWords@master/content/2018/ja/ja_full.txt
//   curl -L -o scripts/.cache/hanja.txt https://raw.githubusercontent.com/libhangul/libhangul/master/data/hanja/hanja.txt
//   （jmdict・krdict・kyujitai は ことのね の README の手順で ../hanjaatume/scripts/.cache に）
//
// 実行: npm run build:data

import fs from "node:fs";
import path from "node:path";
import { changesOf, findBase, kunStem, toHiragana } from "../src/data/kana.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "scripts/.cache");
const SHARED = path.resolve(ROOT, "../hanjaatume/scripts/.cache");
const KANJI = path.resolve(ROOT, "../kanji/scripts/.cache");
const KOTONONE = path.resolve(ROOT, "../hanjaatume/public/data");
const OUT = path.join(ROOT, "public/data");
const CURATED = path.join(ROOT, "src/data");

const cp = (s) => Array.from(s);
const isHan = (c) => /\p{Script=Han}/u.test(c) && c !== "々" && c !== "〆" && c !== "〇";

/** scripts/.cache か、글씨앗・ことのね の .cache にあるファイル。 */
function cached(name) {
  for (const dir of [CACHE, KANJI, SHARED]) {
    const f = path.join(dir, name);
    if (fs.existsSync(f)) return f;
  }
  console.error(`\n[!] 入力が見つかりません: ${name}\n    ファイル先頭の手順で scripts/.cache に置いてください。\n`);
  process.exit(1);
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));

// --- 1) 字：KANJIDIC2 ---------------------------------------------------------------------------
console.log("KANJIDIC2 を読んでいます…");
const kd = new Map(); // 字 -> { on, kun, meanings, strokes, grade, freq, korean }
{
  const isKd = (f) => /^kanjidic2-en-.*\.json$/.test(f);
  const home = [CACHE, KANJI].find((d) => fs.existsSync(d) && fs.readdirSync(d).some(isKd));
  const data = readJson(home ? path.join(home, fs.readdirSync(home).find(isKd)) : cached("kanjidic2-en.json"));
  for (const c of data.characters) {
    const rs = c.readingMeaning?.groups.flatMap((g) => g.readings) ?? [];
    const meanings = c.readingMeaning?.groups.flatMap((g) => g.meanings.filter((m) => m.lang === "en").map((m) => m.value)) ?? [];
    kd.set(c.literal, {
      on: rs.filter((r) => r.type === "ja_on").map((r) => r.value.replace(/^-|-$/g, "")),
      kun: rs.filter((r) => r.type === "ja_kun").map((r) => r.value),
      korean: rs.filter((r) => r.type === "korean_h").map((r) => r.value),
      meanings,
      strokes: c.misc.strokeCounts[0],
      grade: c.misc.grade ?? undefined,
      freq: c.misc.frequency ?? undefined,
    });
  }
}
console.log(`  字: ${kd.size}`);

const kanjiLevels = new Map(); // 字 -> JLPT N の級
for (const [c, v] of Object.entries(readJson(cached("kanji-data.json")))) if (v.jlpt_new) kanjiLevels.set(c, v.jlpt_new);

/** 字のふだんの読み（ひらがな。音読みと、訓読みの字の受け持つ部分）。 */
function readingsOf(c) {
  const k = kd.get(c);
  if (!k) return [];
  return [...new Set([...k.on.map(toHiragana), ...k.kun.map(kunStem)].filter(Boolean))];
}

// --- 2) 字の韓国語：ことのね の字（訓と音）、無ければ KANJIDIC2 の音と libhangul の訓 ------------------
console.log("字の韓国語の訓と音をそろえています…");
const kotononeChars = readJson(path.join(KOTONONE, "hanja-chars.json"));
const kotononeWords = readJson(path.join(KOTONONE, "words.json"));
const koCharUse = new Map(); // 韓国の字 -> 語の数
for (const w of kotononeWords) for (const c of new Set(cp(w.hanja))) koCharUse.set(c, (koCharUse.get(c) ?? 0) + 1);
const koByJp = new Map(); // 日本の字 -> 韓国の字の候補（ことのね の字）
for (const c of kotononeChars) {
  const jp = c.jp ?? c.char;
  (koByJp.get(jp) ?? koByJp.set(jp, []).get(jp)).push(c);
}
// 韓国の辞書の語でよく使う形を先に（国 には 國 と 国 があるが、韓国で書くのは 國）。
for (const list of koByJp.values()) list.sort((a, b) => (koCharUse.get(b.char) ?? 0) - (koCharUse.get(a.char) ?? 0));

const hunOf = new Map(); // 韓国の字 -> [{hun, eum}]（libhangul。「배울 학」の形のものだけ）
for (const line of fs.readFileSync(cached("hanja.txt"), "utf8").split("\n")) {
  if (line.startsWith("#")) continue;
  const [eum, char, def] = line.split(":");
  if (!def || cp(char).length !== 1 || cp(eum).length !== 1) continue;
  // 「모일 회, 모을 회」のように訓が並ぶときは、はじめの訓
  const m = def.split(",")[0].trim().match(/^(.+?)\s+([가-힣])$/);
  if (!m || m[2] !== eum) continue;
  const list = hunOf.get(char) ?? hunOf.set(char, []).get(char);
  if (!list.some((r) => r.eum === eum)) list.push({ hun: m[1], eum });
}

const shinToKyu = new Map();
for (const e of readJson(cached("kyujitai.json")).kyuji ?? []) {
  const [shin, kyu] = e;
  if (cp(shin).length === 1 && cp(kyu).length === 1 && shin !== kyu && !shinToKyu.has(shin)) shinToKyu.set(shin, kyu);
}

/** 手で直した訓（学校で習う訓。社 は 토지의 신 でなく 모일）。字のいちばんはじめの音の訓に使う。 */
const hunFix = readJson(path.join(ROOT, "scripts/hun-ko.json"));

/** 日本の字の、韓国の字・訓と音・基礎漢字か。 */
function koreanOf(c) {
  const found = koreanSounds(c);
  if (hunFix[c] && found.sounds[0]) found.sounds[0] = { hun: hunFix[c], eum: found.sounds[0].eum };
  return found;
}

function koreanSounds(c) {
  const fromKotonone = koByJp.get(c)?.[0];
  if (fromKotonone) {
    return {
      ko: fromKotonone.char !== c ? fromKotonone.char : undefined,
      sounds: fromKotonone.readings.map((r) => {
        const hun = r.hun ?? hunOf.get(fromKotonone.char)?.find((x) => x.eum === r.eum)?.hun;
        return hun ? { hun, eum: r.eum } : { eum: r.eum };
      }),
      edu: fromKotonone.edu || undefined,
    };
  }
  const kyu = shinToKyu.get(c);
  const form = kyu && (hunOf.has(kyu) || kd.get(kyu)) ? kyu : c;
  const eums = [...new Set([...(kd.get(c)?.korean ?? []), ...(kd.get(form)?.korean ?? [])])];
  const huns = hunOf.get(form) ?? hunOf.get(c) ?? [];
  const sounds = eums.length
    ? eums.map((eum) => {
        const h = huns.find((x) => x.eum === eum);
        return h ? { hun: h.hun, eum } : { eum };
      })
    : huns;
  return { ko: form !== c ? form : undefined, sounds };
}

// --- 3) 語：JMdict + JmdictFurigana --------------------------------------------------------------
console.log("JMdict を読んでいます…");
const jmFile = (() => {
  for (const dir of [path.join(CACHE, "jmdict"), path.join(SHARED, "jmdict")]) {
    if (!fs.existsSync(dir)) continue;
    const f = fs.readdirSync(dir).find((x) => /^jmdict-eng-.*\.json$/.test(x));
    if (f) return path.join(dir, f);
  }
  return cached("jmdict/jmdict-eng.json");
})();
const jm = readJson(jmFile);

console.log("JmdictFurigana を読んでいます…");
const furigana = new Map(); // 表記|読み -> [{ruby, rt}]
for (const f of readJson(cached("JmdictFurigana.json"))) furigana.set(`${f.text}|${f.reading}`, f.furigana);

// JLPT の級（語）。同じ語が二つの級にあれば、やさしい方（N の数が大きい方）。
const jlpt = new Map(); // 表記|読み・表記 -> N
{
  const parseCsv = (text) => {
    const rows = [];
    for (const line of text.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;
      const cells = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else quoted = !quoted;
        } else if (ch === "," && !quoted) {
          cells.push(cur);
          cur = "";
        } else cur += ch;
      }
      cells.push(cur);
      rows.push(cells);
    }
    return rows;
  };
  for (const n of [1, 2, 3, 4, 5]) {
    for (const [expression, reading] of parseCsv(fs.readFileSync(cached(`jlpt/n${n}.csv`), "utf8"))) {
      for (const e of expression.split(/[;；、,]/).map((x) => x.trim()).filter(Boolean)) {
        for (const r of (reading || e).split(/[;；、,]/).map((x) => toHiragana(x.trim())).filter(Boolean)) {
          const key = `${e}|${r}`;
          jlpt.set(key, Math.max(jlpt.get(key) ?? 0, n));
        }
        jlpt.set(e, Math.max(jlpt.get(e) ?? 0, n));
      }
    }
  }
}

// よく使うか：字幕の日本語で、100万語あたり何回。動詞は語幹（食べ・言）で数えてあるので、送り仮名を外しても探す。
const freq = new Map();
let freqTotal = 0;
for (const line of fs.readFileSync(cached("freq/ja_full.txt"), "utf8").split("\n")) {
  const [w, n] = line.trim().split(" ");
  if (!w || !n) continue;
  freq.set(w, Number(n));
  freqTotal += Number(n);
}
/**
 * 字幕で100万語あたり何回。inflects（動詞・い形容詞）なら、終わりの送り仮名一つを外した語幹（食べる → 食べ、言う → 言）
 * でも数え、多い方（字幕の数え方は語幹で切っている）。
 */
function freqOf(written, inflects) {
  const per = (n) => Math.round(((n ?? 0) / freqTotal) * 1e6 * 10) / 10;
  const chars = cp(written);
  const own = per(freq.get(written));
  if (!inflects || chars.length < 2 || !/[ぁ-ゖ]/.test(chars[chars.length - 1])) return own;
  return Math.max(own, per(freq.get(chars.slice(0, -1).join(""))));
}

// --- 4) 語の韓国語の意味：한국어기초사전 の日本語の対訳を逆に引く --------------------------------------
console.log("한국어기초사전 を読んでいます…");
const LEVELS = { 초급: 1, 중급: 2, 고급: 3 };
// 等級のない語（말하다・이야기하다 のような 하다 の付く語に多い）は、중급 と同じくらいに。
const LEVEL_COST = { 1: 0, 2: 0.5, 3: 1, 4: 0.5 };
const unescapeXml = (v) =>
  v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const koByJa = new Map(); // 日本語の表記 -> [{ hangul, readings, rank }]
const koByKana = new Map(); // かなだけの対訳（いろいろ・たまに）-> [{ hangul, rank }]
{
  const dir = [path.join(CACHE, "krdict"), path.join(SHARED, "krdict")].find((d) => fs.existsSync(d));
  if (!dir) {
    console.error("\n[!] 한국어기초사전（krdict/*.xml）が見つかりません。\n");
    process.exit(1);
  }
  const add = (written, readings, entry) => {
    const list = koByJa.get(written) ?? koByJa.set(written, []).get(written);
    list.push({ ...entry, readings });
  };
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
    const xml = fs.readFileSync(path.join(dir, file), "utf8");
    for (const block of xml.split("<LexicalEntry ").slice(1)) {
      const form = block.match(/<Lemma>\s*<feat att="writtenForm" val="([^"]*)"/)?.[1];
      if (!form) continue;
      const hangul = unescapeXml(form);
      if (!/^[가-힣]+$/.test(hangul)) continue;
      if (/val="보조 (동사|형용사)"|val="(접사|어미|조사)"/.test(block.match(/partOfSpeech" val="[^"]*"/)?.[0] ?? "")) continue;
      const level = LEVELS[block.match(/vocabularyLevel" val="([^"]*)"/)?.[1]] ?? 4;
      block
        .split("<Sense ")
        .slice(1, 4)
        .forEach((sense, senseIdx) => {
          let itemIdx = 0;
          for (const eq of sense.split("<Equivalent>").slice(1)) {
            if (!eq.includes('att="language" val="일본어"')) continue;
            const lemma = unescapeXml(eq.match(/att="lemma" val="([^"]*)"/)?.[1] ?? "");
            for (const raw of lemma.split("。")) {
              const s = raw.trim().replace(/\s*【+/, "【").replace(/】+/g, "】").replace(/（[^）]*）/g, "");
              const m = s.match(/^([^【】]+)【([^【】]+)】$/);
              const readings = m ? m[1].split("・").map((r) => toHiragana(r.trim())) : [];
              const writtens = m ? m[2].split("・").map((x) => x.trim()) : [];
              // その意味のはじめの対訳か（会う は 만나다 の二つ目の意味のはじめ。찾다 では五つ目）→ 何番目の意味か → 等級
              const rank = (itemIdx === 0 ? (senseIdx === 0 ? 0 : 1 + senseIdx) : 4 + senseIdx + itemIdx) + LEVEL_COST[level];
              itemIdx++;
              if (!m && /^[ぁ-ゖー]+$/.test(s)) {
                (koByKana.get(s) ?? koByKana.set(s, []).get(s)).push({ hangul, rank, level });
              }
              for (const written of writtens) {
                if (!/\p{Script=Han}/u.test(written)) continue;
                add(written, readings, { hangul, rank, level });
                // 勉強する ↔ 공부하다・静かだ ↔ 조용하다：語の部分でも引けるように（少し後ろに）
                const stem = written.match(/^(.+?)(する|だ|な|に)$/u)?.[1];
                if (stem && /\p{Script=Han}/u.test(stem)) {
                  add(stem, readings.map((r) => r.replace(/(する|だ|な|に)$/, "")), { hangul: hangul.replace(/하다$/, ""), rank: rank + 5, level });
                }
              }
            }
          }
        });
    }
  }
}
console.log(`  日本語の表記: ${koByJa.size}`);

/** 々 を前の字に（人々 → 人人）。対訳の書き方の違いをそろえる。 */
const unrepeat = (s) => cp(s).map((c, i, a) => (c === "々" && i > 0 ? a[i - 1] : c)).join("");
for (const [written, list] of [...koByJa]) {
  const plain = unrepeat(written);
  if (plain !== written) koByJa.set(plain, [...(koByJa.get(plain) ?? []), ...list]);
}

/** 語の韓国語の意味（よく合う語から2つまで）。無ければ []。お菓子・ご飯 の お・ご を外した語でも探す。 */
function koreanGloss(written, reading) {
  const found = glossOf(unrepeat(written), reading);
  if (found.length) return found;
  const bare = written.match(/^[おご](\p{Script=Han}.*)$/u)?.[1];
  const withoutPrefix = bare ? glossOf(unrepeat(bare), reading.replace(/^[おご]/, "")) : [];
  if (withoutPrefix.length) return withoutPrefix;
  // かなだけの対訳（色々 ↔ いろいろ）：同じ読みのよく使う語がほかに無いときだけ。
  return uniqueReading.has(reading) ? pickBest(koByKana.get(reading) ?? []) : [];
}

function glossOf(written, reading) {
  const prefer = cognates.get(written)?.[0]?.hangul;
  return pickBest((koByJa.get(written) ?? []).filter((h) => h.readings.length === 0 || h.readings.includes(reading)), prefer);
}

/** いちばん合う語と、同じくらい合う語をもう一つまで（遠い語は意味がずれていることが多い）。同じ漢字の語があれば先に。 */
function pickBest(hits, prefer) {
  const best = new Map();
  for (const h of hits) if (!best.has(h.hangul) || best.get(h.hangul).rank > h.rank) best.set(h.hangul, h);
  const sorted = [...best.values()].sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.hangul === prefer) - Number(a.hangul === prefer) ||
      a.level - b.level ||
      a.hangul.localeCompare(b.hangul, "ko")
  );
  if (sorted.length === 0) return [];
  return sorted.filter((h, i) => i === 0 || h.rank === sorted[0].rank).slice(0, 2).map((h) => h.hangul);
}

const manualGloss = readJson(path.join(ROOT, "scripts/glosses-ko.json"));
// 같은 한자어 の手直し（手で書いたもの。表記|読み → 直し）：kd は韓国語の同じ漢字の語との、意味・使い方のちがい（韓国語で、
// 画面で対の下に出す）。ks: false は、同じ漢字でも同じ意味の語ではない（人事 ひとごと ↔ 인사）。ks: true は、意味を直して
// 対訳から同じ意味と言えなくなった語を、同じ漢字語のままにする（洋服 ↔ 양복）。ko は韓国語の語の直し（도저 → 도저히）。
const sameFix = readJson(path.join(ROOT, "scripts/same-hanjaeo.json"));

// 同じ漢字の韓国語の漢字語（ことのね の辞書。학생 學生 ↔ 学生）
const cognates = new Map(); // 日本の字の表記 -> [{ hangul, hanja, gloss, lv, fq }]
for (const w of kotononeWords) {
  const jp = w.hanjaJp ?? w.hanja;
  (cognates.get(jp) ?? cognates.set(jp, []).get(jp)).push(w);
}
const koRank = (w) => (w.lv && w.lv <= 3 ? w.lv : w.fq >= 2 ? 3 : w.fq >= 1 ? 4 : 5);
for (const list of cognates.values()) list.sort((a, b) => koRank(a) - koRank(b) || (b.fq ?? 0) - (a.fq ?? 0));

// --- 5) 語を選ぶ ---------------------------------------------------------------------------------
console.log("語を選んでいます…");
const BAD_K = new Set(["sK", "iK", "oK", "rK", "ateji"]);
const BAD_R = new Set(["sk", "ik", "ok", "rk"]);
const words = new Map(); // 表記|読み -> word
const stats = { group: 0, odd: 0, noFurigana: 0, rare: 0 };

/** JMdict の語の、表記ごとの読みの候補（表記・読み・よく使う印・JLPT の級）。 */
function* forms(e) {
  const kanjiForms = e.kanji.filter((k) => !k.tags.some((t) => BAD_K.has(t)));
  for (const [ki, k] of kanjiForms.entries()) {
    const written = k.text;
    const applies = (x) => x.appliesToKanji.includes("*") || x.appliesToKanji.includes(written);
    const kana = e.kana.find((r) => applies(r) && !r.tags.some((t) => BAD_R.has(t)));
    if (!kana) continue;
    const reading = kana.text;
    const n = jlpt.get(`${written}|${reading}`) ?? jlpt.get(`${written}|${toHiragana(reading)}`);
    yield { k, ki, written, reading, kana, applies, n, common: k.common && kana.common };
  }
}

// 表記ごとのいちばんの読み（学生 は がくせい、がくしょう ではなく）。字幕での頻度と、同じ漢字の韓国語の語は表記で
// 数えるので、それを理由に入れるのはこの読みだけ。JLPT の級 → よく使う印 → JMdict の並び の順。
const primary = new Map(); // 表記 -> 読み
const uniqueReading = new Set(); // よく使う語の中で、ほかに同じ読みの語が無い読み（ひらがな）
{
  const best = new Map();
  const readingForms = new Map();
  for (const e of jm.words) {
    for (const f of forms(e)) {
      if (f.common || f.n) {
        const r = toHiragana(f.reading);
        (readingForms.get(r) ?? readingForms.set(r, new Set()).get(r)).add(e.id);
      }
      const score = (f.n ?? 0) * 10 + (f.common ? 5 : 0) + (f.kana.common ? 1 : 0);
      if (!best.has(f.written) || best.get(f.written).score < score) best.set(f.written, { score, reading: f.reading });
    }
  }
  for (const [w, b] of best) primary.set(w, b.reading);
  for (const [r, ids] of readingForms) if (ids.size === 1) uniqueReading.add(r);
}

for (const e of jm.words) {
  for (const { k, ki, written, reading, applies, n, common } of forms(e)) {
    const chars = cp(written);
    if (!chars.some(isHan) || !chars.every((c) => isHan(c) || c === "々" || /[ぁ-ゖァ-ヺー]/.test(c))) continue;
    const key = `${written}|${reading}`;
    if (words.has(key)) continue;
    const senses = e.sense.filter((s) => applies(s) && (s.appliesToKana.includes("*") || s.appliesToKana.includes(reading)));
    if (senses.length === 0) continue;
    const hira = toHiragana(reading);
    // ふだん かなで書く語（uk）は、JLPT の一覧が漢字で載せている語だけ。
    if (senses[0].misc.includes("uk") && !n) continue;
    const isPrimary = primary.get(written) === reading;
    const pos = senses[0].partOfSpeech;
    const inflects = !pos.includes("exp") && pos.some((p) => /^v[15k]|^vs-i|^vz|^adj-i/.test(p));
    const fq = isPrimary ? freqOf(written, inflects) : 0;
    const cognate = cognates.get(written)?.[0];
    // 韓国語でもよく使う漢字語（학생 學生）と同じ漢字の語。韓国語を話す人には、もう意味の分かる語。
    const knownInKorean = isPrimary && cognate && koRank(cognate) <= 3;
    const keep = n || common || fq >= 2 || knownInKorean;
    if (!keep) continue;
    // 二つ目からの表記は、よく使う印のあるものだけ（奇麗 と 綺麗 …）
    if (ki > 0 && !k.common && !n) continue;

    const segs = furigana.get(key) ?? furigana.get(`${written}|${hira}`);
    if (!segs) {
      stats.noFurigana++;
      continue;
    }
    // 字ごとの読み。漢字の並び（々 は前の字）に一つずつ。熟字訓（今日 きょう）は字に分けない。
    let rt = [];
    let group = false;
    let bad = false;
    for (const s of segs) {
      const rubyChars = cp(s.ruby);
      const hanCount = rubyChars.filter((c) => isHan(c) || c === "々").length;
      if (!s.rt) {
        if (hanCount > 0) bad = true;
        continue;
      }
      if (hanCount === 0) bad = true; // ヶ など、字でないところの読み
      else if (rubyChars.length > 1) group = true;
      else rt.push(toHiragana(s.rt));
    }
    if (bad) continue;
    const word = { kanji: written, kana: reading };
    const hanChars = [];
    chars.forEach((c, i) => {
      if (isHan(c)) hanChars.push(c);
      else if (c === "々" && i > 0) hanChars.push(hanChars[hanChars.length - 1]);
    });
    if (group || rt.length !== hanChars.length) {
      stats.group++;
      rt = null;
    }
    if (rt) {
      word.rt = rt;
      const base = [];
      const odd = [];
      rt.forEach((here, i) => {
        const found = findBase(readingsOf(hanChars[i]), here);
        if (!found) {
          odd.push(i);
          base.push(here);
        } else base.push(found.base);
      });
      if (base.some((b, i) => b !== rt[i])) word.base = base;
      if (odd.length) {
        word.odd = odd;
        stats.odd++;
      }
    }
    // 意味：手で書いた意味 → 韓国語の対訳 → 同じ漢字の韓国語の語（その語の日本語の対訳がこの語なら）→ 英語
    const ko = koreanGloss(written, hira);
    const sameMeaning = cognate && (cognate.gloss.includes(`【${written}】`) || cognate.gloss === written || ko.includes(cognate.hangul));
    if (manualGloss[key]) word.gloss = manualGloss[key];
    else if (ko.length) word.gloss = ko.join(", ");
    else if (cognate && sameMeaning) word.gloss = cognate.hangul;
    else {
      word.gloss = senses[0].gloss
        .slice(0, 3)
        .map((g) => g.text)
        .join("; ");
      word.en = true;
    }
    // 同じ漢字の韓国語の語。意味が違う語（工夫 くふう ↔ 공부、大丈夫 ↔ 대장부）もそのまま並べ、違いには自分で気づく
    // （対訳の語の選び方の違いと見分けられないので、「意味が違う」とは言わない）。手で確かめた語だけ、違いを kd に書く。
    if (cognate) {
      word.ko = cognate.hangul;
      // 同じ漢字で、意味も同じ（한국어기초사전 の対訳がこの語を指すか、この語の韓国語の意味にその語がある）。
      // 韓国語の漢字語がそのまま日本語の語になる。
      const meansSame = !word.en && word.gloss.split(/,\s*/).map((x) => x.trim()).includes(cognate.hangul);
      if (sameMeaning || meansSame) word.ks = true;
      // その韓国語の語をどれくらいよく使うか（1 초급 … 5 ほとんど使わない）。知っている韓国語の語から先に。
      word.kl = koRank(cognate);
    }
    const fix = sameFix[key];
    if (fix?.ko) word.ko = fix.ko;
    if (fix?.ks === false) delete word.ks;
    if (fix?.ks === true && word.ko) word.ks = true;
    if (fix?.kd && word.ko) word.kd = fix.kd;
    if (n) word.n = n;
    // 学ぶ順の目安（ことのね の等級と同じ使い方）：1 N5・N4、2 N3、3 N2・N1・よく使う語の印、
    // 4 字幕でよく使う語・韓国語でもよく使う漢字語、5 ほとんど使わない語。
    word.lv = n >= 4 ? 1 : n === 3 ? 2 : n || common ? 3 : fq >= 2 || knownInKorean ? 4 : 5;
    if (fq) word.fq = fq;
    if (word.lv === 5) stats.rare++;
    words.set(key, word);
  }
}
const wordList = [...words.values()].sort((a, b) => toHiragana(a.kana).localeCompare(toHiragana(b.kana), "ja") || a.kanji.localeCompare(b.kanji, "ja"));
console.log(
  `  語: ${wordList.length}（熟字訓など字に分けない語 ${stats.group}・その語だけの読みの字がある語 ${stats.odd}・` +
    `ふりがなの無い語 ${stats.noFurigana}・ほとんど使わない語 ${stats.rare}）`
);
console.log(
  `  韓国語の意味: 対訳 ${wordList.filter((w) => !w.en && !(w.ko && w.gloss === w.ko && !koreanGloss(w.kanji, toHiragana(w.kana)).length)).length}・` +
    `英語 ${wordList.filter((w) => w.en).length}・同じ漢字の韓国語の語 ${wordList.filter((w) => w.ko).length}`
);

// --- 6) 字：語に出てくる字と常用漢字 -----------------------------------------------------------------
console.log("字をまとめています…");
const useCount = new Map(); // 字 -> Map(読み -> 重み)
const weight = (w) => Math.max(1, 5 - w.lv);
for (const w of wordList) {
  if (!w.rt) continue;
  const hanChars = [];
  cp(w.kanji).forEach((c) => {
    if (isHan(c)) hanChars.push(c);
    else if (c === "々") hanChars.push(hanChars[hanChars.length - 1]);
  });
  hanChars.forEach((c, i) => {
    const r = w.base?.[i] ?? w.rt[i];
    const m = useCount.get(c) ?? useCount.set(c, new Map()).get(c);
    m.set(r, (m.get(r) ?? 0) + weight(w));
  });
}
const usedChars = new Set();
for (const w of wordList) for (const c of cp(w.kanji)) if (isHan(c)) usedChars.add(c);
const joyo = [...kd.entries()].filter(([, k]) => k.grade && k.grade <= 8).map(([c]) => c);
const kanjiList = [];
for (const c of new Set([...joyo, ...usedChars])) {
  const k = kd.get(c);
  if (!k) continue;
  const uses = useCount.get(c) ?? new Map();
  const byUse = (list, toKey) =>
    list
      .map((r, i) => ({ r, n: uses.get(toKey(r)) ?? 0, i }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((x) => x.r);
  const on = byUse(k.on, toHiragana).slice(0, 4);
  const kun = byUse(k.kun, kunStem).slice(0, 5);
  const korean = koreanOf(c);
  const entry = { char: c };
  if (korean.ko) entry.ko = korean.ko;
  entry.sounds = korean.sounds;
  if (on.length) entry.on = on;
  if (kun.length) entry.kun = kun;
  entry.meaning = k.meanings.slice(0, 3).join(", ");
  entry.strokes = k.strokes;
  if (k.grade) entry.grade = k.grade;
  if (k.grade && k.grade <= 8) entry.joyo = true;
  if (kanjiLevels.get(c)) entry.n = kanjiLevels.get(c);
  if (korean.edu) entry.edu = true;
  kanjiList.push(entry);
}
kanjiList.sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99) || (kd.get(a.char).freq ?? 9999) - (kd.get(b.char).freq ?? 9999));
console.log(`  字: ${kanjiList.length}（常用漢字 ${kanjiList.filter((k) => k.joyo).length}・韓国語の訓のある字 ${kanjiList.filter((k) => k.sounds.some((s) => s.hun)).length}）`);

// 語の字ごとの読みが、字のふだんの読みの一覧に入っているか（入っていなければ、その字の読みの一覧に足す）。
const kanjiByChar = new Map(kanjiList.map((k) => [k.char, k]));
for (const [c, uses] of useCount) {
  const k = kanjiByChar.get(c);
  if (!k) continue;
  const known = new Set([...(k.on ?? []).map(toHiragana), ...(k.kun ?? []).map(kunStem)]);
  for (const [r, n] of [...uses.entries()].sort((a, b) => b[1] - a[1])) {
    if (known.has(r) || n < 3) continue;
    const full = kd.get(c);
    if (full.on.map(toHiragana).includes(r)) (k.on ??= []).push(full.on.find((x) => toHiragana(x) === r));
    else {
      const kun = full.kun.find((x) => kunStem(x) === r);
      if (kun) (k.kun ??= []).push(kun);
    }
    known.add(r);
  }
}

// --- 7) 書き出し -------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "words.json"), JSON.stringify(wordList));
fs.writeFileSync(path.join(OUT, "kanji.json"), JSON.stringify(kanjiList));
const size = (f) => `${(fs.statSync(path.join(OUT, f)).size / 1024 / 1024).toFixed(2)} MB`;
console.log(`書き出しました: public/data/words.json（${size("words.json")}）・kanji.json（${size("kanji.json")}）`);

// テストと起動直後の表示のための小さな辞書（src/data/curated-*.json）。
const CURATED_WORDS = [
  "学生|がくせい", "大学|だいがく", "大学生|だいがくせい", "学校|がっこう", "先生|せんせい", "生活|せいかつ", "一生|いっしょう",
  "会社|かいしゃ", "社会|しゃかい", "会社員|かいしゃいん", "社員|しゃいん", "時間|じかん", "勉強|べんきょう", "約束|やくそく",
  "写真|しゃしん", "友達|ともだち", "食べる|たべる", "食べ物|たべもの", "今日|きょう", "発表|はっぴょう", "出発|しゅっぱつ",
  "工夫|くふう", "大丈夫|だいじょうぶ", "学年|がくねん", "人々|ひとびと", "人生|じんせい", "生徒|せいと", "山|やま", "火山|かざん",
  "家族|かぞく", "家|いえ", "学ぶ|まなぶ", "一|いち", "一人|ひとり", "日本|にほん", "日本語|にほんご", "韓国|かんこく", "韓国語|かんこくご",
];
const curatedWords = CURATED_WORDS.map((k) => words.get(k)).filter(Boolean);
const curatedChars = [...new Set(curatedWords.flatMap((w) => cp(w.kanji).filter(isHan)))].map((c) => kanjiByChar.get(c)).filter(Boolean);
fs.writeFileSync(path.join(CURATED, "curated-words.json"), JSON.stringify(curatedWords, null, 1) + "\n");
fs.writeFileSync(path.join(CURATED, "curated-chars.json"), JSON.stringify(curatedChars, null, 1) + "\n");
console.log(`  小さな辞書: 語 ${curatedWords.length}・字 ${curatedChars.length}（見つからなかった語: ${CURATED_WORDS.filter((k) => !words.has(k)).join("、") || "なし"}）`);

// 変わり方の数（確かめ用）
const changeCount = {};
for (const w of wordList) {
  if (!w.base) continue;
  w.base.forEach((b, i) => {
    if (w.odd?.includes(i) || b === w.rt[i]) return;
    for (const c of changesOf(b, w.rt[i]) ?? ["?"]) changeCount[c] = (changeCount[c] ?? 0) + 1;
  });
}
console.log(`  語の中で読みが変わる字: ${JSON.stringify(changeCount)}`);
