// 日本語の文に、辞書の語の印を付ける（文で出会う の例文の生成と、書き足した文の確かめの両方で使う）。
//
// 語の見つけ方：形態素解析（kuromoji、IPADIC）で文を語に分け、文の中での読みを使う（今日 が きょう か こんにち か、
// 行って の 行 が い か おこな か）。続く語を4つまでつないで、辞書の語の表記と読みに合うものを長い方から探す
// （大学生 は 大学＋生 に分かれる）。活用している語（食べた の 食べ）は、終わりの語の基本形（食べる）で引き、
// 読みの頭が辞書の読みと合うものだけ。
//
// 形態素解析が読みを取り違えるところは、辞書の読みを使う：つなぎ目の音の変わり（一回 いっかい・風邪薬 かぜぐすり）、
// 数の字の訓（一人 ひとり・三日 みっか）、算用数字の後ろの 月（4月 がつ）、名詞＋接尾の語（洗濯物 を せんたくぶつ と読む）、
// 辞書に一つしかない語の別の読み（通帳 かよいちょう・日本 にっぽん）。副詞の と（意外と）は、と を除いた語に印。

import fs from "node:fs";
import path from "node:path";
import kuromoji from "kuromoji";
import { changesOf, normalizeReading } from "../../src/data/kana.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const hasKanji = (s) => /\p{Script=Han}/u.test(s);

/** 韓国語の漢字語が、そのまま日本語の語になる語（src/data/combine.ts の sameHanjaeo と同じ）。 */
export const isHanjaeo = (w) => !!w.ks && !!w.ko && (w.kl ?? 5) <= 4 && (w.lv ?? 4) < 5;

// 形態素解析が取り違える語（来られる を きたる と読む）。印を付けない。
const SKIP = new Set(["来る|きたる"]);

// 数の字の訓（一人 ひとり・三日 みっか・二十歳 はたち・四人 よにん）。形態素解析は 一＋人 を イチ＋ニン と字ごとの音で読む。
const NUMBER_KUN = /^(ひと|ふた|み|よ|いつ|む|なな|なの|や|よう|ここの|とお|はた|はつ)/;

/** 語の読みが、字ごとの読みに音の変わりを入れたものか（さん＋せん → さんぜん、いち＋かい → いっかい）。 */
function soundChanged(parts, kana) {
  if (parts.join("").length !== kana.length) return false;
  let at = 0;
  return parts.every((p) => changesOf(p, kana.slice(at, (at += p.length))) !== null);
}

/** 字ごとの読みから、語の漢字の部分の読みの長さ（食べる なら た の1、学生 なら がくせい の4）。 */
function kanjiReadingLength(w) {
  if (!w.rt) {
    const okuri = w.kanji.match(/[ぁ-ゖァ-ヺ]+$/)?.[0] ?? "";
    return normalizeReading(w.kana).length - okuri.length;
  }
  let len = 0;
  let i = 0;
  let last = 0;
  for (const c of Array.from(w.kanji)) {
    if (/\p{Script=Han}/u.test(c)) {
      len += w.rt[i++]?.length ?? 0;
      last = len;
    } else len += c.length;
  }
  return last;
}

/**
 * 印を付ける道具を作る。返す mark(ja) は、文の中の辞書の語を [start, end, 表記, 読み, 語] の並びで返す。
 * words は public/data/words.json の中身（省けば読む）。
 */
export async function createMarker(words = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/words.json"), "utf8"))) {
  const byKanji = new Map();
  for (const w of words) (byKanji.get(w.kanji) ?? byKanji.set(w.kanji, []).get(w.kanji)).push(w);
  // よく使う語を先に（同じ表記の候補から選ぶとき）
  for (const list of byKanji.values()) list.sort((a, b) => (a.lv ?? 4) - (b.lv ?? 4) || (b.fq ?? 0) - (a.fq ?? 0));

  const tokenizer = await new Promise((resolve, reject) =>
    kuromoji.builder({ dicPath: path.join(ROOT, "node_modules/kuromoji/dict") }).build((err, t) => (err ? reject(err) : resolve(t)))
  );

  /** tokens[i..j] をつないだところに合う辞書の語と、終わりの印を付けない字の数（意外と の と）。無ければ null。 */
  function match(tokens, i, j) {
    const span = tokens.slice(i, j + 1);
    const surface = span.map((t) => t.surface_form).join("");
    if (!hasKanji(surface)) return null;
    if (span.some((t) => !t.reading || t.reading === "*")) return null;
    const reading = normalizeReading(span.map((t) => t.reading).join(""));
    // 活用している形（食べ・行っ・行き）：終わりの語の基本形で引き、読みの頭が合うもの。行きたい の 行き は、
    // 名詞の 行き（いき）より動詞の 行く を先に。
    const last = span[span.length - 1];
    if (last.basic_form && last.basic_form !== "*" && last.basic_form !== last.surface_form && /動詞|形容詞/.test(last.pos)) {
      const base = span.slice(0, -1).map((t) => t.surface_form).join("") + last.basic_form;
      for (const w of byKanji.get(base) ?? []) {
        if (SKIP.has(`${w.kanji}|${w.kana}`)) continue;
        const kana = normalizeReading(w.kana);
        let common = 0;
        while (common < reading.length && common < kana.length && reading[common] === kana[common]) common++;
        if (common >= kanjiReadingLength(w) && common > 0) return { w, cut: 0 };
      }
    }
    // 活用していない形：表記も読みもそのまま
    const list = (byKanji.get(surface) ?? []).filter((w) => !SKIP.has(`${w.kanji}|${w.kana}`));
    const prev = tokens[i - 1];
    // 算用数字の後ろの 月（4月 を 4＋つき と読む）は がつ。
    if (surface === "月" && /^[0-9０-９]+$/.test(prev?.surface_form ?? "")) {
      const w = list.find((x) => x.kana === "がつ");
      return w ? { w, cut: 0 } : null;
    }
    for (const w of list) if (normalizeReading(w.kana) === reading) return { w, cut: 0 };
    const tail = span[span.length - 1];
    if (span.length >= 2) {
      // 分かれた語の読みに、つなぎ目の音の変わりがあるもの（一回 いっかい・三千 さんぜん）
      const parts = span.map((t) => normalizeReading(t.reading));
      for (const w of list) if (soundChanged(parts, normalizeReading(w.kana))) return { w, cut: 0 };
      // 数と助数詞で、数の字を訓で読む語（一人 ひとり・三日 みっか）。前も数のとき（十一人 の 一人）は使わない。
      const counted = /^[一二三四五六七八九十]$/.test(span[0].surface_form) && span.slice(0, -1).every((t) => t.pos_detail_1 === "数");
      if (counted && tail.pos_detail_1 === "接尾" && prev?.pos_detail_1 !== "数") {
        const w = list.find((x) => NUMBER_KUN.test(normalizeReading(x.kana)));
        if (w) return { w, cut: 0 };
      }
      // 名詞＋接尾の語で、辞書にその表記が一つだけのもの（洗濯物 を 洗濯＋物 ぶつ と読む）
      if (!counted && span[0].pos_detail_1 !== "数" && tail.pos_detail_1 === "接尾" && span.every((t) => t.pos === "名詞") && list.length === 1)
        return { w: list[0], cut: 0 };
    } else {
      const t = span[0];
      // 形態素解析の読みが辞書に無い、二字以上の名詞（通帳 を かよいちょう、台詞 を だいし と読む）：辞書にその表記が一つだけなら、その語。
      // 前が名詞なら、合わさった語の後ろ（学校帰り の 帰り）かもしれないので使わない。
      if (list.length === 1 && t.pos === "名詞" && (/^(一般|サ変接続|形容動詞語幹)$/.test(t.pos_detail_1) || (t.pos_detail_1 === "固有名詞" && t.pos_detail_2 === "地域")) && Array.from(surface).length >= 2 && prev?.pos !== "名詞")
        return { w: list[0], cut: 0 };
      // 副詞の と（意外と・漠然と）：と を除いたところが辞書の語なら、そこに印。
      if (t.pos === "副詞" && surface.length > 2 && surface.endsWith("と") && reading.endsWith("と")) {
        for (const w of byKanji.get(surface.slice(0, -1)) ?? [])
          if (!SKIP.has(`${w.kanji}|${w.kana}`) && normalizeReading(w.kana) === reading.slice(0, -1)) return { w, cut: 1 };
      }
    }
    return null;
  }

  function mark(ja) {
    const tokens = tokenizer.tokenize(ja);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      let found = null;
      for (let j = Math.min(tokens.length - 1, i + 3); j >= i && !found; j--) {
        const m = match(tokens, i, j);
        if (m) found = { word: m.w, cut: m.cut, j };
      }
      if (!found) continue;
      const start = tokens[i].word_position - 1;
      const end = tokens[found.j].word_position - 1 + tokens[found.j].surface_form.length;
      if (ja.slice(start, end) !== tokens.slice(i, found.j + 1).map((t) => t.surface_form).join("")) continue;
      out.push([start, end - found.cut, found.word.kanji, found.word.kana, found.word]);
      i = found.j;
    }
    return out;
  }

  return { mark, byKanji };
}
