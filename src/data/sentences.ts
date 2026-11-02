// 文で出会う の例文：姉妹アプリ ことのあめ の文（韓国語）と、その日本語訳。日本語の文の中の漢字の語に、
// 辞書の語の印を付けたもの（scripts/build-sentences.mjs が public/data/sentences.json に書く）。
// 辞書と違って起動時には読まず、使う画面が開いたときに一度だけ読む。

import { kanjiToWords, splitKanji } from "./dataset";
import { commonRank } from "./resolver";
import { composable, wordSounds } from "./sounds";
import type { WordData } from "./types";

/** 文の中の語の印。start / end は ja の中の位置（UTF-16。食べた なら 食べ の部分）。kanji・kana は辞書の形（食べる・たべる）。 */
export interface SentenceMark {
  start: number;
  end: number;
  kanji: string;
  kana: string;
}

export interface Sentence {
  /** 例文データの中の番号（出した文を覚えておくため）。 */
  id: number;
  ja: string;
  ko: string;
  /** 漢字語の印（押せる・また出会ったと数える語）。 */
  marks: SentenceMark[];
  /** ふりがなだけを添える、漢字語でない漢字の語（奥さん・難しい）。押せず、数えない。 */
  rubies: SentenceMark[];
}

export interface SentenceData {
  list: Sentence[];
  /** 語（表記|読み）→ その語が出てくる文の番号。 */
  byWord: Map<string, number[]>;
  /** 字 → その字の入った語が出てくる文の番号。 */
  byChar: Map<string, number[]>;
}

interface SentenceFile {
  sentences: { ja: string; ko: string; w: [number, number, string, string][]; r?: [number, number, string, string][] }[];
}

const key = (kanji: string, kana: string) => `${kanji}|${kana}`;

function push(map: Map<string, number[]>, k: string, id: number) {
  const list = map.get(k);
  if (!list) map.set(k, [id]);
  else if (list[list.length - 1] !== id) list.push(id);
}

/** 書き出した JSON を、画面で使う形と索引にする。 */
export function parseSentences(file: SentenceFile): SentenceData {
  const byWord = new Map<string, number[]>();
  const byChar = new Map<string, number[]>();
  const list = file.sentences.map((s, id) => {
    const marks = s.w.map(([start, end, kanji, kana]) => ({ start, end, kanji, kana }));
    for (const m of marks) {
      push(byWord, key(m.kanji, m.kana), id);
      for (const c of splitKanji(m.kanji)) push(byChar, c, id);
    }
    const rubies = (s.r ?? []).map(([start, end, kanji, kana]) => ({ start, end, kanji, kana }));
    return { id, ja: s.ja, ko: s.ko, marks, rubies };
  });
  return { list, byWord, byChar };
}

let loading: Promise<SentenceData | null> | null = null;

/** 例文を読む（一度だけ）。読めなければ null（オフラインでまだ保存していないときなど）。 */
export function loadSentences(): Promise<SentenceData | null> {
  if (!loading) {
    const baseRaw = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const base = baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
    loading = fetch(`${base}data/sentences.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SentenceFile>) : null))
      .then((f) => (f ? parseSentences(f) : null))
      .catch(() => {
        loading = null; // 次に開いたときにもう一度
        return null;
      });
  }
  return loading;
}

/** 印の語を、辞書の語として引く（意味つき）。辞書に無ければ意味なしで返す。 */
export function wordOf(m: Pick<SentenceMark, "kanji" | "kana">): WordData {
  return (kanjiToWords.get(m.kanji) ?? []).find((w) => w.kana === m.kana) ?? { kanji: m.kanji, kana: m.kana, gloss: "" };
}

/** 印の語が、学ぶ人にとって何か：集めた語（また出会った）／集めた字の音で読める語／まだの語。 */
export type MarkStatus = "owned" | "readable" | "new";

export function markStatus(m: Pick<SentenceMark, "kanji" | "kana">, sounds: Set<string>, owned: Set<string>): MarkStatus {
  if (owned.has(key(m.kanji, m.kana))) return "owned";
  const w = wordOf(m);
  if (!composable(w)) return "new";
  const own = wordSounds(w);
  return own.length > 0 && own.every((s) => sounds.has(s)) ? "readable" : "new";
}

const NONE: ReadonlySet<string> = new Set();

/** 語の段（1 N5・N4、2 N3、3 N2・N1・よく使う語、4 それ以外）。 */
export type LevelOf = (m: Pick<SentenceMark, "kanji" | "kana">) => number;

/** 辞書から語の段を引く（resolver の commonRank）。 */
export const dictLevel: LevelOf = (m) => {
  const w = kanjiToWords.get(m.kanji)?.find((x) => x.kana === m.kana);
  return w ? Math.min(commonRank(w), 4) : 4;
};

/** この段の語を何語集めたら、その段の文をふつうに出すか。 */
const ENOUGH = 30;

/**
 * 学ぶ人の段階：集めた語が30語以上ある、いちばん上の段（無ければ 1＝N5・N4）。
 * 集めた語に N3 の語が増えてくれば、N3 のまだの語が入った文もふつうに降る。
 */
export function learnerLevel(owned: Iterable<string>, levelOf: LevelOf = dictLevel): number {
  const counts = [0, 0, 0, 0, 0];
  for (const k of owned) {
    const at = k.indexOf("|");
    counts[levelOf({ kanji: k.slice(0, at), kana: k.slice(at + 1) })]++;
  }
  let level = 1;
  for (let lv = 2; lv <= 4; lv++) if (counts[lv] >= ENOUGH) level = lv;
  return level;
}

export interface ScoreOptions {
  /** ふりかえりどきの集めた語（表記|読み）。 */
  due?: ReadonlySet<string>;
  /** 学ぶ人の段階（learnerLevel）。 */
  level?: number;
  levelOf?: LevelOf;
}

/**
 * 文の点：集めた語ほど高く（また出会う）、読める語、知っている字の入った語の順。
 * ふりかえりどきの集めた語（due）はもう少し高く、文の中でまた出会いやすくする。
 * まだ読めない語が学ぶ人の段階より上の段なら、上の分だけ下げる（はじめたばかりの人に N1 の語の文を降らせない）。
 */
export function sentenceScore(
  s: Sentence,
  sounds: Set<string>,
  owned: Set<string>,
  { due = NONE, level = 1, levelOf = dictLevel }: ScoreOptions = {}
): number {
  const chars = new Set([...sounds].map((x) => x.slice(0, x.indexOf("|"))));
  let score = 0;
  for (const m of s.marks) {
    const status = markStatus(m, sounds, owned);
    if (status === "owned") score += due.has(key(m.kanji, m.kana)) ? 5 : 3;
    else if (status === "readable") score += 2;
    else {
      if (splitKanji(m.kanji).some((c) => chars.has(c))) score += 1;
      score -= Math.max(0, levelOf(m) - level);
    }
  }
  return score;
}

export interface RainOptions {
  /** ひと雨の文の数。 */
  size?: number;
  /** ふりかえりどきの集めた語（表記|読み）。 */
  due?: ReadonlySet<string>;
  levelOf?: LevelOf;
  random?: () => number;
}

/**
 * ひと雨ぶんの文を選ぶ。まだ出していない文を混ぜてから点の高い順に並べ、上のほうから size 文。
 * 点が同じなら毎回違う文になる。出していない文が足りなければ、出した文もまた使う。
 * 点は、集めた語から求めた学ぶ人の段階に合わせる（sentenceScore）。
 */
export function pickRain(
  list: readonly Sentence[],
  sounds: Set<string>,
  owned: Set<string>,
  seen: Set<number>,
  { size = 4, due = NONE, levelOf = dictLevel, random = Math.random }: RainOptions = {}
): Sentence[] {
  const level = learnerLevel(owned, levelOf);
  let pool = list.filter((s) => !seen.has(s.id));
  if (pool.length < size) pool = [...list];
  // 混ぜる（Fisher–Yates）→ 点で安定に並べる。上位から少しだけ散らして選ぶ。
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const scored = pool
    .map((s) => ({ s, score: sentenceScore(s, sounds, owned, { due, level, levelOf }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(size * 4, 16));
  const out: Sentence[] = [];
  const used = new Map<string, number>();
  for (const { s } of scored) {
    // 同じ語ばかりの雨にならないよう、ひと雨で同じ語は2文まで。もう出た語だけの文は後回し。
    const keys = s.marks.map((m) => key(m.kanji, m.kana));
    if (keys.some((k) => (used.get(k) ?? 0) >= 2) || !keys.some((k) => !used.has(k))) continue;
    out.push(s);
    for (const k of new Set(keys)) used.set(k, (used.get(k) ?? 0) + 1);
    if (out.length === size) break;
  }
  // 足りなければ、同じ語2文までは守って足し、それでも足りなければ何でも。
  for (const capped of [true, false]) {
    for (const { s } of scored) {
      if (out.length === size) break;
      if (out.includes(s)) continue;
      const keys = s.marks.map((m) => key(m.kanji, m.kana));
      if (capped && keys.some((k) => (used.get(k) ?? 0) >= 2)) continue;
      out.push(s);
      for (const k of new Set(keys)) used.set(k, (used.get(k) ?? 0) + 1);
    }
  }
  return out;
}

/** 文を、印の語とそれ以外の切れ目に分ける（描くため）。 */
export function segments(
  s: Pick<Sentence, "ja" | "marks"> & Partial<Pick<Sentence, "rubies">>
): ({ text: string } | { text: string; mark: SentenceMark } | { text: string; ruby: SentenceMark })[] {
  const out: ({ text: string } | { text: string; mark: SentenceMark } | { text: string; ruby: SentenceMark })[] = [];
  let at = 0;
  const all = [...s.marks.map((m) => ({ m, ruby: false })), ...(s.rubies ?? []).map((m) => ({ m, ruby: true }))];
  for (const { m, ruby } of all.sort((a, b) => a.m.start - b.m.start)) {
    if (m.start < at) continue;
    if (m.start > at) out.push({ text: s.ja.slice(at, m.start) });
    out.push(ruby ? { text: s.ja.slice(m.start, m.end), ruby: m } : { text: s.ja.slice(m.start, m.end), mark: m });
    at = m.end;
  }
  if (at < s.ja.length) out.push({ text: s.ja.slice(at) });
  return out;
}
