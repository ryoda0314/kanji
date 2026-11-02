// 組み合わせ・発見機能のロジック。
// 「集めた字の音（字と読みの組）だけで読める実在の語」と「あと1音で読める語」を逆引きインデックスから列挙する。
// 造語の自動生成は行わず、辞書に存在する語のみを対象とする。

import { charMap, charToWords, kanjiToWords, splitKanji } from "./dataset";
import { commonRank, enrich, isRare } from "./resolver";
import { baseAt, composable, hasParts, isOnReading, soundParts, wordSounds } from "./sounds";
import type { ResolvedWord, WordData } from "./types";

/** 語を一意に表すキー。同じ表記で読みの違う語（今日 きょう / こんにち）を別の語として扱うため読みも含める。 */
export function wordKey(w: { kanji: string; kana: string }): string {
  return `${w.kanji.normalize("NFC")}|${w.kana}`;
}

/** 発見結果。alreadyOwned = すでに単語帳に持っている語かどうか。 */
export interface DiscoverResult extends ResolvedWord {
  alreadyOwned: boolean;
}

/**
 * 韓国語の漢字語が、そのまま日本語の語になる語か：同じ漢字・同じ意味で、韓国語でもふつうに使う語（말씨앗 の読める語は、
 * 知っている韓国語の語を日本語で言える語）。ほとんど使わない語は覚えても使わないので、入れない。
 */
export function sameHanjaeo(w: WordData): boolean {
  return !!w.ks && !!w.ko && (w.kl ?? 5) <= 4 && !isRare(w);
}

/** 集めた音の字を1つでも含む、同じ漢字語（全件走査を避けるための候補）。 */
function candidatesFor(sounds: Iterable<string>): Set<WordData> {
  const chars = new Set<string>();
  for (const s of sounds) chars.add(soundParts(s).char);
  const candidates = new Set<WordData>();
  for (const ch of chars) {
    for (const w of charToWords.get(ch) ?? []) if (sameHanjaeo(w) && composable(w)) candidates.add(w);
  }
  return candidates;
}

/** 構成漢字がすべて常用漢字か。よく使う語ほどそうなりやすい。 */
function allJoyo(w: WordData): boolean {
  return splitKanji(w.kanji).every((c) => charMap.get(c)?.joyo);
}

/** 1字だけの語（山 やま）は字そのものなので、2字以上の語のあとに回す。 */
function easeLength(w: WordData): number {
  const n = splitKanji(w.kanji).length;
  return n === 1 ? 99 : n;
}

/**
 * 読みやすい順：1字語は最後 → よく使う語（JLPT の級）→ 韓国語でよく使う語（知っている語から）→ 字幕での頻度 → 字数の少ない語
 * → 常用漢字だけでできた語 → あいうえお順。
 */
export function byEase(a: WordData, b: WordData): number {
  return (
    Number(easeLength(a) === 99) - Number(easeLength(b) === 99) ||
    commonRank(a) - commonRank(b) ||
    (a.kl ?? 5) - (b.kl ?? 5) ||
    (b.fq ?? 0) - (a.fq ?? 0) ||
    easeLength(a) - easeLength(b) ||
    Number(allJoyo(b)) - Number(allJoyo(a)) ||
    a.kana.localeCompare(b.kana, "ja")
  );
}

/** 語の音がすべて集めた音にあるか。 */
function readableWith(w: WordData, sounds: Set<string>): boolean {
  const own = wordSounds(w);
  return own.length > 0 && own.every((s) => sounds.has(s));
}

/**
 * 集めた字の音だけで読める実在の語を列挙する（読みやすい順）。
 * 字に分けられない語（熟字訓）・その語だけの読みの字がある語・1字の語は含めない。
 *
 * @param sounds  集めた字の音（字|読み）の集合
 * @param owned   すでに単語帳に持っている語のキー（wordKey）の集合
 * @param onlyNew true の場合、まだ持っていない語のみを返す（＝発見すべき新語）
 */
export function discoverWords(sounds: Set<string>, owned: Set<string>, onlyNew = false): DiscoverResult[] {
  const results: DiscoverResult[] = [];
  for (const w of candidatesFor(sounds)) {
    if (!readableWith(w, sounds)) continue;
    const alreadyOwned = owned.has(wordKey(w));
    if (onlyNew && alreadyOwned) continue;
    results.push({ ...enrich(w, "seed"), alreadyOwned });
  }
  results.sort(byEase);
  return results;
}

/** あと1音で読める語と、その足りない音（字|読み）。 */
export interface NearResult {
  word: WordData;
  missing: string;
}

/** 足りない音が1つだけの、まだ持っていない語（読みやすい順）。次に覚える字の手がかりにする。 */
export function nearWords(sounds: Set<string>, owned: Set<string>): NearResult[] {
  const out: NearResult[] = [];
  for (const w of candidatesFor(sounds)) {
    if (owned.has(wordKey(w))) continue;
    const missing = wordSounds(w).filter((s) => !sounds.has(s));
    if (missing.length === 1) out.push({ word: w, missing: missing[0] });
  }
  out.sort((a, b) => byEase(a.word, b.word));
  return out;
}

/**
 * この語をあつめると新しく読めるようになる語（読みやすい順）。語の中のはじめての音が鍵になるので、
 * 知っている音だけの語なら空。あつめる語そのものと、持っている語は含めない。
 */
export function unlockedBy(word: Pick<WordData, "kanji" | "kana" | "rt" | "base">, sounds: Set<string>, owned: Set<string>): WordData[] {
  const own = wordSounds(word);
  const fresh = own.filter((s) => !sounds.has(s));
  if (fresh.length === 0) return [];
  const after = new Set([...sounds, ...own]);
  const self = wordKey(word);
  const out = new Map<string, WordData>();
  for (const s of fresh) {
    for (const w of charToWords.get(soundParts(s).char) ?? []) {
      const key = wordKey(w);
      if (key === self || owned.has(key) || out.has(key) || !sameHanjaeo(w) || !composable(w)) continue;
      if (wordSounds(w).includes(s) && readableWith(w, after)) out.set(key, w);
    }
  }
  return [...out.values()].sort(byEase);
}

/**
 * 次に出会うと読める語が増える音。よく使う語（JLPT N5〜N3）が多く増える音から、同じなら増える語数、
 * 常用漢字の順。まれな語ばかり増える音より、学ぶ人がよく出会う語の増える音を先に。
 */
export function unlockers(near: NearResult[]): { sound: string; count: number }[] {
  const counts = new Map<string, { count: number; common: number }>();
  for (const n of near) {
    const c = counts.get(n.missing) ?? { count: 0, common: 0 };
    c.count++;
    if (commonRank(n.word) <= 2) c.common++;
    counts.set(n.missing, c);
  }
  const joyo = (s: string) => Number(Boolean(charMap.get(soundParts(s).char)?.joyo));
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y.common - x.common || y.count - x.count || joyo(b) - joyo(a) || a.localeCompare(b))
    .map(([sound, { count }]) => ({ sound, count }));
}

/**
 * 字で書く語の、ひとまとまり。字の読みが多いのではなく、その字で書く言葉が多い：生 は いきる・うまれる・なま・はえる
 * という別々の言葉に当てた字で、せい・しょう は 学生・一生 のような漢語の中の音。
 * on：音読み（漢語の中の音。せい）、kun：訓読み（その字の意味の日本語の言葉。い → 生きる・生かす・生き物）、
 * whole：字に分けずに語ぜんたいで読む語（熟字訓。芝生 しばふ）。
 */
export interface WrittenGroup {
  kind: "on" | "kun" | "whole";
  /** 字のふだんの読み（ひらがな。訓読みは字の受け持つ部分：い・うま）。熟字訓は ""。 */
  reading: string;
  /** その読みでこの字を書く語（訓読みは、この字だけで書く語＝言葉そのもの（生きる）を先に。ほかはよく使う順）。 */
  words: WordData[];
}

/** 字で書く語を、音読み（よく使う音から）→ 訓読みの言葉（よく使う言葉から）→ 熟字訓 の順に。ほとんど使わない語は入れない。 */
export function wordsWrittenWith(char: string): WrittenGroup[] {
  const groups = new Map<string, WrittenGroup>();
  const whole: WordData[] = [];
  for (const w of charToWords.get(char) ?? []) {
    if (isRare(w)) continue;
    if (!hasParts(w)) {
      whole.push(w);
      continue;
    }
    const seen = new Set<string>();
    splitKanji(w.kanji).forEach((c, i) => {
      if (c !== char || w.odd?.includes(i)) return;
      const reading = baseAt(w, i);
      if (seen.has(reading)) return;
      seen.add(reading);
      const kind = isOnReading(char, reading) ? "on" : "kun";
      const key = `${kind}|${reading}`;
      const g = groups.get(key) ?? groups.set(key, { kind, reading, words: [] }).get(key)!;
      g.words.push(w);
    });
  }
  const alone = (w: WordData) => Number(splitKanji(w.kanji).length === 1);
  const byUse = (a: WordData, b: WordData) => commonRank(a) - commonRank(b) || (b.fq ?? 0) - (a.fq ?? 0) || a.kana.length - b.kana.length;
  const list = [...groups.values()];
  for (const g of list) g.words.sort((a, b) => (g.kind === "kun" ? alone(b) - alone(a) : 0) || byUse(a, b));
  const best = (g: WrittenGroup) => Math.min(...g.words.map(commonRank));
  const order = (a: WrittenGroup, b: WrittenGroup) => best(a) - best(b) || b.words.length - a.words.length;
  return [
    ...list.filter((g) => g.kind === "on").sort(order),
    ...list.filter((g) => g.kind === "kun").sort(order),
    ...(whole.length ? [{ kind: "whole" as const, reading: "", words: whole.sort(byUse) }] : []),
  ];
}

/** 並べた漢字とまったく同じ表記の実在語（読みが複数ある語もあるので全部。よく使う語が先）。 */
export function findWordsByKanji(chars: string[]): ResolvedWord[] {
  if (chars.length === 0) return [];
  return [...(kanjiToWords.get(chars.join("").normalize("NFC")) ?? [])]
    .sort((a, b) => commonRank(a) - commonRank(b))
    .map((w) => enrich(w, "seed"));
}
