// 読んでみる：集めた字の音だけでできた、まだ習っていない語を、字の読みからかなで読む。
// 答え合わせは点数を付けず、どのかなが違ったかと、字のふだんの読みとこの語での読みが違うところ（学 がく → 学校 の がっ）、
// そのわけ（促音・連濁・半濁音・転音）を示すだけ。

import { splitKanji } from "./dataset";
import { normalizeReading, type SoundChange } from "./kana";
import { baseAt, changesAt, hasParts } from "./sounds";
import type { WordData } from "./types";

/** かな一つずつ合っているか（答えの長さで返す。打った読みが短ければ、足りないかなは違う扱い）。空白・カタカナの違いは見ない。 */
export function compareKana(typed: string, answer: string): boolean[] {
  const mine = Array.from(normalizeReading(typed));
  return Array.from(normalizeReading(answer)).map((s, i) => mine[i] === s);
}

/** 打った読みが答えと同じか（空白・カタカナの違いは見ない）。 */
export function isSameReading(typed: string, answer: string): boolean {
  return normalizeReading(typed) === normalizeReading(answer);
}

export interface ReadingNote {
  char: string;
  /** 字のふだんの読み（この語で数える読み）。 */
  usual: string;
  /** この語での読み。 */
  here: string;
  /** 変わり方。null は、この語だけの特別な読み。 */
  changes: SoundChange[] | null;
}

/**
 * この語で、字のふだんの読みと違う読みをする字と、そのわけ。
 * 学校（がっこう）なら 学 はふだん がく、後ろに か行 が来るので がっ。字の読みを足しても読めないところの手がかりにする。
 */
export function readingNotes(w: Pick<WordData, "kanji" | "rt" | "base" | "odd">): ReadingNote[] {
  if (!hasParts(w)) return [];
  const out: ReadingNote[] = [];
  splitKanji(w.kanji).forEach((c, i) => {
    const here = w.rt?.[i] ?? "";
    const usual = baseAt(w, i);
    const odd = w.odd?.includes(i) ?? false;
    if ((usual !== here || odd) && !out.some((o) => o.char === c && o.here === here)) {
      out.push({ char: c, usual, here, changes: odd ? null : changesAt(w, i) });
    }
  });
  return out;
}

/** 字のふだんの読みをつなげた読み（学校 なら がくこう）。字の読みどおりに読んだのに、この語では違ったかを見るため。 */
export function usualReading(w: Pick<WordData, "kanji" | "rt" | "base">): string {
  if (!hasParts(w)) return "";
  let i = 0;
  let out = "";
  for (const c of Array.from(w.kanji.normalize("NFC"))) {
    if (/\p{Script=Han}/u.test(c)) out += baseAt(w, i++);
    else out += c;
  }
  return out;
}

/** 表記を、字（とその字のこの語での読み）と送り仮名に分ける（ふりがなを付けて描くため）。熟字訓は漢字のひと続きに一つ。 */
export function rubyParts(w: Pick<WordData, "kanji" | "kana" | "rt">, text = w.kanji): { text: string; rt?: string }[] {
  const chars = Array.from(text.normalize("NFC"));
  const isKanji = (c: string) => /\p{Script=Han}/u.test(c);
  if (!w.rt) {
    // 字に分けられない語：漢字のひと続きに、送り仮名を除いた読みを一つ。
    const head = chars.findIndex(isKanji);
    let tail = chars.length;
    while (tail > head && !isKanji(chars[tail - 1])) tail--;
    if (head < 0) return [{ text }];
    const okuri = chars.slice(tail).join("");
    const kana = normalizeReading(w.kana);
    const reading = okuri && text === w.kanji && kana.endsWith(normalizeReading(okuri)) ? kana.slice(0, kana.length - okuri.length) : kana;
    const parts: { text: string; rt?: string }[] = [];
    if (head > 0) parts.push({ text: chars.slice(0, head).join("") });
    parts.push({ text: chars.slice(head, tail).join(""), rt: reading });
    if (okuri) parts.push({ text: okuri });
    return parts;
  }
  const parts: { text: string; rt?: string }[] = [];
  let i = 0;
  for (const c of chars) {
    if (isKanji(c) && i < w.rt.length) parts.push({ text: c, rt: w.rt[i++] });
    else if (parts.length && parts[parts.length - 1].rt === undefined) parts[parts.length - 1].text += c;
    else parts.push({ text: c });
  }
  return parts;
}

/**
 * 次に読んでみる語を選ぶ。読みやすい順に並んだ語の上から20語のうち、まだ出していない語をひとつ。
 * 毎回同じ順にならないよう、その中から無作為に選ぶ。prefer に合う語（学ぶ人の段階に合う語）があれば、その中から。
 */
export function pickToRead<T>(
  pool: readonly T[],
  skip: (w: T) => boolean,
  random: () => number = Math.random,
  prefer?: (w: T) => boolean
): T | null {
  const open = pool.filter((w) => !skip(w));
  const fit = prefer ? open.filter(prefer) : open;
  const top = (fit.length ? fit : open).slice(0, 20);
  return top.length ? top[Math.floor(random() * top.length)] : null;
}
