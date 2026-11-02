// 써 보기：言葉（音と意味）を先に出し、その言葉を書く字を札から選んで並べる（音 → 字）。字は音ではなく言葉の意味で決まる
// （かいしゃ は 会社。回・絵 も かい と読むが、別の言葉の字）。だから札には、まぎらわしい字を混ぜる：
//   ① 同じ読みの別の言葉の字（こうこう：高校 に 孝行・航行 の字）
//   ② 同じ読みで書く字（かい：会・回・絵・界）。韓国語の音まで同じ字（会 と 回 は どちらも かい・회）を先に：
//      音ではどちらとも決まらず、言葉の意味でしか選べない。次に集めた字、よく使う字
//   ③ 同じ韓国語の音の字（生・省 생。韓国語を話す人は字を音で呼ぶので、取り違えやすい）
//   ④ 集めた字、よく使う字（足りなければ）
// 点数は付けない。違う札を置いたら、その字の訓と音（回 돌 회）を見せて、意味で選び直す。

import { charMap, kanaToWords, seedWords, splitKanji } from "./dataset";
import { normalizeReading } from "./kana";
import { baseAt, hasParts } from "./sounds";
import type { WordData } from "./types";

const isSlotChar = (c: string) => /\p{Script=Han}/u.test(c) && c !== "々" && c !== "〆" && c !== "〇";

/** 表記を、札を置く升（漢字。slot は升の番号）と、はじめから見えている文字（送り仮名・々）に分ける。 */
export function writeParts(kanji: string): { text: string; slot?: number }[] {
  const out: { text: string; slot?: number }[] = [];
  let slot = 0;
  for (const c of Array.from(kanji.normalize("NFC"))) {
    if (isSlotChar(c)) out.push({ text: c, slot: slot++ });
    else if (out.length && out[out.length - 1].slot === undefined) out[out.length - 1].text += c;
    else out.push({ text: c });
  }
  return out;
}

/** 升に入る字（並び順）。 */
export function slotChars(kanji: string): string[] {
  return writeParts(kanji).flatMap((p) => (p.slot === undefined ? [] : [p.text]));
}

/** 升ごとの、字のふだんの読み（熟字訓など字に分けられない語は undefined）。 */
function slotReadings(w: Pick<WordData, "kanji" | "rt" | "base">): (string | undefined)[] {
  if (!hasParts(w)) return slotChars(w.kanji).map(() => undefined);
  const out: string[] = [];
  let i = 0;
  for (const c of Array.from(w.kanji.normalize("NFC"))) {
    if (c === "々") i++;
    else if (isSlotChar(c)) out.push(baseAt(w, i++));
  }
  return out;
}

// 読み → その読みで書く字（よく使う語ほど重く）。韓国語の音 → 常用漢字。全データを読んだら作り直す。
let byReading = new Map<string, Map<string, number>>();
let byEum = new Map<string, string[]>();
let indexedSize = -1;

function indexes() {
  if (indexedSize === seedWords.length) return { byReading, byEum };
  byReading = new Map();
  for (const w of seedWords) {
    if (!hasParts(w)) continue;
    const weight = Math.max(1, 5 - (w.lv ?? 4));
    splitKanji(w.kanji).forEach((c, i) => {
      const r = baseAt(w, i);
      const m = byReading.get(r) ?? byReading.set(r, new Map()).get(r)!;
      m.set(c, (m.get(c) ?? 0) + weight);
    });
  }
  byEum = new Map();
  for (const c of charMap.values()) {
    const eum = c.sounds[0]?.eum;
    if (!eum || !c.joyo) continue;
    (byEum.get(eum) ?? byEum.set(eum, []).get(eum)!).push(c.char);
  }
  for (const list of byEum.values()) list.sort((a, b) => (charMap.get(a)?.grade ?? 9) - (charMap.get(b)?.grade ?? 9));
  indexedSize = seedWords.length;
  return { byReading, byEum };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 札一枚（同じ字が語に二度あれば、二枚）。 */
export interface Tile {
  id: number;
  char: string;
}

/**
 * 札を作る：語の字（升の数だけ）と、まぎらわしい字を合わせて6〜8枚。混ぜて返す。
 * collected（集めた字）は、同じ読みの字の中で先に選ぶ（自分の根の中で見分ける）。
 */
export function tilesFor(
  w: Pick<WordData, "kanji" | "kana" | "rt" | "base">,
  collected: ReadonlySet<string> = new Set(),
  random: () => number = Math.random
): Tile[] {
  const { byReading, byEum } = indexes();
  const answer = slotChars(w.kanji);
  const total = Math.min(8, Math.max(6, answer.length + 4));
  const own = new Set(answer);
  const extra: string[] = [];
  const add = (c: string | undefined) => {
    if (!c || own.has(c) || extra.includes(c) || !charMap.has(c) || answer.length + extra.length >= total) return;
    extra.push(c);
  };
  // ① 同じ読みの別の言葉の、同じ升の字
  for (const other of kanaToWords.get(normalizeReading(w.kana)) ?? []) {
    if (other.kanji === w.kanji) continue;
    const chars = slotChars(other.kanji);
    if (chars.length === answer.length) chars.forEach(add);
  }
  // ② 同じ読みで書く字：升ごとに一つずつ順に（どの升にも迷う字があるように）。韓国語の音も同じ字を先に。
  const eumOf = (c: string) => charMap.get(c)?.sounds[0]?.eum;
  const readings = slotReadings(w);
  const lists = readings.map((r, k) => {
    const same = (c: string) => Number(!!eumOf(c) && eumOf(c) === eumOf(answer[k]));
    return [...(r ? (byReading.get(r) ?? new Map<string, number>()) : new Map<string, number>()).entries()]
      .filter(([c]) => c !== answer[k])
      .sort((a, b) => same(b[0]) - same(a[0]) || Number(collected.has(b[0])) - Number(collected.has(a[0])) || b[1] - a[1])
      .map(([c]) => c);
  });
  for (let round = 0; round < 3; round++) for (const list of lists) add(list[round]);
  // ③ 同じ韓国語の音の字
  for (const c of answer) {
    const eum = charMap.get(c)?.sounds[0]?.eum;
    for (const x of (eum ? byEum.get(eum) : undefined) ?? []) if (x !== c) {
      add(x);
      break;
    }
  }
  // ④ 集めた字、よく使う字
  for (const c of shuffle([...collected], random)) add(c);
  for (const c of charMap.values()) if (c.grade && c.grade <= 2) add(c.char);

  const tiles = [...answer, ...extra].map((char, id) => ({ id, char }));
  return shuffle(tiles, random);
}

/** 置いた札が合っているか（升ごと）。 */
export function checkSlots(answer: readonly string[], placed: readonly (string | null)[]): boolean[] {
  return answer.map((c, i) => placed[i] === c);
}

/** 違う札の字が、その升の字と同じ読みか（「소리는 같아도」と言えるか）。 */
export function sameReadingAt(w: Pick<WordData, "kanji" | "rt" | "base">, slot: number, chosen: string): boolean {
  const r = slotReadings(w)[slot];
  return !!r && (indexes().byReading.get(r)?.has(chosen) ?? false);
}
