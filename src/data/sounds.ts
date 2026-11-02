// 字の音：字と、その語での字のふだんの読みの組（学|がく）。
// 日本語の字は読みが一つではない（生 は せい・しょう・なま・い …）ので、「集めた字で読める」は字ではなく、
// 字と読みの組で数える。学生 を集めると 学|がく と 生|せい が手に入り、大学（大|だい）を足すと 大学生 が読める。
// 学校 の 学 は がっ と読むが、ふだんの読み がく として数える（がっ になるわけは reading.ts が言う）。

import { charMap, splitKanji } from "./dataset";
import { changesOf, findBase, kunStem, toHiragana, type SoundChange } from "./kana";
import type { KanjiData, WordData } from "./types";

/** 字の音の名前（学|がく）。 */
export function soundKey(char: string, reading: string): string {
  return `${char}|${reading}`;
}

/** 字の音の名前を、字と読みに。 */
export function soundParts(key: string): { char: string; reading: string } {
  const at = key.indexOf("|");
  return { char: key.slice(0, at), reading: key.slice(at + 1) };
}

/** 字に分けて読みが分かる語か（熟字訓の 今日 きょう・大人 おとな は、字の読みに分けられない）。 */
export function hasParts<T extends Pick<WordData, "kanji" | "rt">>(w: T): w is T & { rt: string[] } {
  return !!w.rt && w.rt.length === splitKanji(w.kanji).length;
}

/** 語の i 番目の字の、ふだんの読み。 */
export function baseAt(w: Pick<WordData, "rt" | "base">, i: number): string {
  return w.base?.[i] ?? w.rt?.[i] ?? "";
}

/** 語を集めると手に入る字の音（字の並び順。同じ音は一度）。熟字訓の語は字に分けられないので []。 */
export function wordSounds(w: Pick<WordData, "kanji" | "rt" | "base">): string[] {
  if (!hasParts(w)) return [];
  return [...new Set(splitKanji(w.kanji).map((c, i) => soundKey(c, baseAt(w, i))))];
}

/**
 * 字の音をつなげれば読める語か：字に分けられて、その語だけの特別な読みの字が無く、2字以上。
 * 1字の語（山 やま）は字そのものなので、読める語には数えない。
 */
export function composable(w: Pick<WordData, "kanji" | "rt" | "odd">): boolean {
  return hasParts(w) && !w.odd?.length && splitKanji(w.kanji).length > 1;
}

/** 語の i 番目の字の読みが、ふだんの読みからどう変わったか（学校 の 学 は ["sokuon"]）。同じなら []、特別な読みなら null。 */
export function changesAt(w: Pick<WordData, "rt" | "base" | "odd">, i: number): SoundChange[] | null {
  if (w.odd?.includes(i)) return null;
  const here = w.rt?.[i];
  if (!here) return null;
  return changesOf(baseAt(w, i), here);
}

/** 字のふだんの読み（ひらがな。音読みはひらがなに、訓読みは字の受け持つ部分）。 */
export function readingsOf(c: Pick<KanjiData, "on" | "kun"> | undefined): string[] {
  if (!c) return [];
  return [...new Set([...(c.on ?? []).map(toHiragana), ...(c.kun ?? []).map(kunStem)].filter(Boolean))];
}

/** 字の読みが音読みか（カタカナで辞書にある読み）。 */
export function isOnReading(char: string, reading: string): boolean {
  return (charMap.get(char)?.on ?? []).some((o) => toHiragana(o) === reading);
}

/** 訓読みを見せる形：まな.ぶ → まな(ぶ)、なま- → なま、-がた → がた。 */
export function kunLabel(kun: string): string {
  const plain = kun.replace(/^-|-$/g, "");
  const [stem, okuri] = plain.split(".");
  return okuri ? `${stem}(${okuri})` : stem;
}

/** 訓読みの一覧から、字の受け持つ部分が同じものを一つに（なま となま- …）。 */
export function distinctKun(kun: readonly string[]): string[] {
  const seen = new Set<string>();
  return kun.filter((k) => {
    const label = kunLabel(k);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

/**
 * 手で登録する語の読みを、字ごとに分ける（字のふだんの読みと、促音・連濁などの変わり方から）。
 * 漢字でないところ（送り仮名）はそのまま合わせる。分けられなければ null（熟字訓などは字に分けない語として登録）。
 */
export function alignReading(kanji: string, kana: string): { rt: string[]; base: string[] } | null {
  const text = Array.from(kanji.normalize("NFC"));
  const reading = toHiragana(kana.normalize("NFC")).replace(/\s+/g, "");
  const chars = splitKanji(kanji);
  let found: { rt: string[]; base: string[] } | null = null;
  const go = (ti: number, ri: number, ci: number, rt: string[], base: string[]) => {
    if (found) return;
    if (ti === text.length) {
      if (ri === reading.length) found = { rt: [...rt], base: [...base] };
      return;
    }
    const c = text[ti];
    if (!/\p{Script=Han}/u.test(c) || c === "〆" || c === "〇") {
      if (toHiragana(c) === reading[ri]) go(ti + 1, ri + 1, ci, rt, base);
      return;
    }
    const char = chars[ci];
    const options = readingsOf(charMap.get(char));
    for (let len = Math.min(6, reading.length - ri); len >= 1; len--) {
      const here = reading.slice(ri, ri + len);
      const match = findBase(options, here);
      if (!match) continue;
      go(ti + 1, ri + len, ci + 1, [...rt, here], [...base, match.base]);
    }
  };
  go(0, 0, 0, [], []);
  return found;
}

/** 字の音を、韓国語の音との「소리 짝」として見せる形（學 + がく → 학 → がく）。韓国語の音が分からない字は 字 読み。 */
export function pairLabel(char: string, reading: string): string {
  const eum = charMap.get(char)?.sounds[0]?.eum;
  return eum ? `${eum} → ${reading}` : `${char} ${reading}`;
}
