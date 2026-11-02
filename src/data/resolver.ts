// 打った語を、辞書の日本語の語に解決する。
//   かな（がくせい）・ローマ字（gakusei）→ 読みで引く
//   漢字（学生・學生・食べる）→ 表記で引く（韓国の字は日本の字に直して）
//   ハングル（학생）→ 意味や同じ漢字の韓国語の語で引く（韓国語から日本語の語を探す）
// 辞書に無い語は、手で登録できる（読みは字のふだんの読みから字ごとに分ける）。

import { jpForm, kanaToWords, kanjiToWords, koreanToWords, splitKanji } from "./dataset";
import { hasRomaji, normalizeReading, romajiToKana, toHiragana } from "./kana";
import { alignReading, readingsOf, soundParts } from "./sounds";
import { charMap } from "./dataset";
import type { ResolvedWord, WordData } from "./types";

/** WordData に字を付けて ResolvedWord にする。 */
export function enrich(word: WordData, source: ResolvedWord["source"]): ResolvedWord {
  return { ...word, chars: splitKanji(word.kanji), source };
}

/** よく使う度の段（1〜5。よく使う語ほど小さい）。辞書の lv（JLPT の級・よく使う印・字幕での頻度から）。手で入れた語は 4。 */
export function commonRank(w: Pick<WordData, "lv">): number {
  return w.lv ?? 4;
}

/** 勧めない語：ほとんど使わない語。読める語・あと1音で読める語・あつめると読める語には出さない（あつめる・探す では引ける）。 */
export function isRare(w: Pick<WordData, "lv">): boolean {
  return commonRank(w) === 5;
}

/** よく使う語を先に（同じ読み・同じ字の候補を並べるとき）。 */
const byCommon = (a: WordData, b: WordData) => commonRank(a) - commonRank(b) || (b.fq ?? 0) - (a.fq ?? 0);

/** 打った語の種類。ローマ字はかなに直してから見る。 */
export type InputKind = "kana" | "kanji" | "korean" | "other";

/** 打った語を、引ける形に（ローマ字はかなに、空白は外す）。 */
export function normalizeInput(raw: string): string {
  const q = raw.trim().replace(/\s+/g, "");
  return hasRomaji(q) ? romajiToKana(q) : q;
}

export function inputKind(raw: string): InputKind {
  const q = normalizeInput(raw);
  if (!q) return "other";
  if (/^[ぁ-ゖァ-ヺー]+$/.test(q)) return "kana";
  if (/\p{Script=Han}/u.test(q) && /^[\p{Script=Han}々ぁ-ゖァ-ヺー]+$/u.test(q)) return "kanji";
  if (/^[가-힣]+$/.test(q)) return "korean";
  return "other";
}

/** 読みで引く（同じ読みの語が複数あれば全部。よく使う語が先）。 */
export function resolveByKana(raw: string): ResolvedWord[] {
  const q = normalizeReading(normalizeInput(raw));
  return [...(kanaToWords.get(q) ?? [])].sort(byCommon).map((w) => enrich(w, "seed"));
}

/** 表記で引く。韓国の字（學生）で打っても、日本の字（学生）の語が見つかる。 */
export function resolveByKanji(raw: string): ResolvedWord[] {
  const q = normalizeInput(raw).normalize("NFC");
  const forms = [...new Set([q, jpForm(q)])];
  return forms
    .flatMap((f) => kanjiToWords.get(f) ?? [])
    .sort(byCommon)
    .map((w) => enrich(w, "seed"));
}

/** 韓国語の語で引く（학생 → 学生、공부하다 → 勉強）。 */
export function resolveByKorean(raw: string): ResolvedWord[] {
  const q = raw.trim().replace(/\s+/g, "");
  const forms = [q, q.replace(/(하다|하기|해요|합니다)$/, "")];
  const seen = new Set<WordData>();
  const out: WordData[] = [];
  for (const f of forms) {
    for (const w of koreanToWords.get(f) ?? []) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out.sort(byCommon).slice(0, 12).map((w) => enrich(w, "seed"));
}

/**
 * 韓国語の漢字語から、日本語の語を三つに分けて引く（말씨앗 の入口）。
 * same：同じ漢字で、意味も同じ語（학생 → 学生）。韓国語の漢字語が、そのまま日本語の語になる。
 * meaning：意味は同じで、日本語では別の漢字で言う語（공부 → 勉強、편지 → 手紙）。
 * kanji：同じ漢字だが、意味は確かめたい語（공부 → 工夫 くふう 궁리）。違うとは言い切らず、意味を並べて自分で見る。
 */
export function resolveKoreanGroups(raw: string): { same: ResolvedWord[]; meaning: ResolvedWord[]; kanji: ResolvedWord[] } {
  const q = raw.trim().replace(/\s+/g, "");
  const forms = [...new Set([q, q.replace(/(하다|하기|해요|합니다|되다)$/, "")])].filter(Boolean);
  const all = new Set<WordData>();
  for (const f of forms) for (const w of koreanToWords.get(f) ?? []) all.add(w);
  const same: WordData[] = [];
  const meaning: WordData[] = [];
  const kanji: WordData[] = [];
  for (const w of all) {
    if (w.ko && forms.includes(w.ko)) (w.ks ? same : kanji).push(w);
    else meaning.push(w);
  }
  const done = (list: WordData[], n: number) => list.sort(byCommon).slice(0, n).map((w) => enrich(w, "seed"));
  return { same: done(same, 8), meaning: done(meaning, 6), kanji: done(kanji, 4) };
}

// 語のあとに付く形（します・です・助詞）。長いものから試す。
const ENDINGS = [
  "しました", "しません", "します", "しない", "して", "した", "する", "でした", "です", "だった", "だ", "な", "に", "の", "を", "が", "は", "と", "も", "で", "へ", "から", "まで",
];

/**
 * 辞書にそのままでは無いかなの、語の部分（べんきょうします → べんきょう、がっこうに → がっこう）。
 * 語尾や助詞を外すと辞書の語になるときだけ、その語と候補を返す。
 */
export function resolveStem(raw: string): { stem: string; words: ResolvedWord[] } | null {
  const q = normalizeReading(normalizeInput(raw));
  if (!/^[ぁ-ゖー]+$/.test(q) || kanaToWords.has(q)) return null;
  for (const end of ENDINGS) {
    if (!q.endsWith(end) || q.length - end.length < 2) continue;
    const stem = q.slice(0, q.length - end.length);
    const words = resolveByKana(stem);
    if (words.length) return { stem, words };
  }
  return null;
}

const O_ROW = new Set(Array.from("おこそとのほもよろごぞどぼぽょ"));
const U_ROW = new Set(Array.from("うくすつぬふむゆるぐずづぶぷゅ"));
const E_ROW = new Set(Array.from("えけせてねへめれげぜでべぺ"));
const BEFORE_SOKUON = new Set(Array.from("かきくけこさしすせそたちつてとぱぴぷぺぽ"));

/** 読みの一か所の打ち違いを直した形：長音を足す・消す（ときょ → とうきょ）、っ を足す・消す、つ を っ に。 */
function lengthEdits(s: string): string[] {
  const a = Array.from(s);
  const out: string[] = [];
  const put = (i: number, k: string) => out.push([...a.slice(0, i), k, ...a.slice(i)].join(""));
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "つ") out.push([...a.slice(0, i), "っ", ...a.slice(i + 1)].join(""));
    if (i > 0 && (a[i] === "っ" || a[i] === "う" || a[i] === "い" || a[i] === "ー")) out.push([...a.slice(0, i), ...a.slice(i + 1)].join(""));
  }
  for (let i = 1; i <= a.length; i++) {
    const prev = a[i - 1];
    if (O_ROW.has(prev) || U_ROW.has(prev)) put(i, "う");
    if (E_ROW.has(prev)) put(i, "い");
    if (i < a.length && BEFORE_SOKUON.has(a[i]) && prev !== "っ") put(i, "っ");
  }
  return out;
}

/**
 * 辞書に無い読みの、長音・促音の打ち違いを直した候補（ときょ → とうきょう 東京、はつぴょう → はっぴょう 発表）。
 * 韓国語には音の長さの区別が無く、っ も聞き取りにくいので、いちばん打ち違えやすいところ。二か所まで直す。
 */
export function resolveNear(raw: string): ResolvedWord[] {
  const q = normalizeReading(normalizeInput(raw));
  if (!/^[ぁ-ゖー]+$/.test(q) || kanaToWords.has(q)) return [];
  const once = lengthEdits(q);
  const found = new Set<WordData>();
  for (const v of [...once, ...once.flatMap(lengthEdits)]) for (const w of kanaToWords.get(v) ?? []) found.add(w);
  return [...found].sort(byCommon).slice(0, 6).map((w) => enrich(w, "seed"));
}

/**
 * 辞書に無い語（読みだけ打った語）の漢字を、集めた字の音から組み立てて提案する。読みの頭から、集めた音の読みで
 * 区切れるところを探し、組み合わせを最大 limit 個返す（集めた音の並び順＝よく出会う字が先）。区切れなければ空。
 */
export function guessKanji(kana: string, sounds: readonly string[], limit = 4): string[] {
  const reading = normalizeReading(kana);
  if (!/^[ぁ-ゖー]+$/.test(reading)) return [];
  const byReading = new Map<string, string[]>();
  for (const s of sounds) {
    const { char, reading: r } = soundParts(s);
    const list = byReading.get(r) ?? [];
    if (!list.includes(char)) list.push(char);
    byReading.set(r, list);
  }
  const out: string[] = [];
  const go = (at: number, built: string) => {
    if (out.length >= limit) return;
    if (at === reading.length) {
      if (built.length > 0) out.push(built);
      return;
    }
    for (let len = Math.min(4, reading.length - at); len >= 1; len--) {
      for (const c of byReading.get(reading.slice(at, at + len)) ?? []) go(at + len, built + c);
    }
  };
  go(0, "");
  return out;
}

/**
 * ユーザーが手入力した表記・読みから ResolvedWord を作る（辞書に無い語の手動登録用）。
 * 読みは字のふだんの読みから字ごとに分ける。分けられなければ、字に分けない語（熟字訓と同じ）として。
 */
export function resolveManual(kanji: string, kana: string, gloss: string): ResolvedWord {
  const written = jpForm(kanji.trim().normalize("NFC"));
  const reading = toHiragana(normalizeInput(kana));
  const parts = alignReading(written, reading);
  const word: WordData = { kanji: written, kana: reading, gloss: gloss.trim() };
  if (parts) {
    word.rt = parts.rt;
    if (parts.base.some((b, i) => b !== parts.rt[i])) word.base = parts.base;
  }
  return enrich(word, "manual");
}

/** 字の読みの候補（手で登録するとき、その字をどう読むかの手がかり）。 */
export function charReadings(char: string): string[] {
  return readingsOf(charMap.get(char));
}
