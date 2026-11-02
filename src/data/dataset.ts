// 辞書データの読込とインデックス構築。
//
// 2段構え:
//   ① curated-*.json（辞書の生成で書き出す小さな一部）を import で即時ロード → テストや初期表示の土台。
//   ② public/data/*.json（JMdict・KANJIDIC2 ほか由来の全データ）を起動時に fetch してマージ。
//
// charMap / kanaToWords / charToWords などは永続的な Map インスタンスで、
// rebuildIndexes() が中身を入れ替える（参照は保たれるので各モジュールの import が有効なまま）。

import curatedCharsJson from "./curated-chars.json";
import curatedWordsJson from "./curated-words.json";
import { normalizeReading } from "./kana";
import type { ScriptPref } from "../prefs";
import type { KanjiData, WordData } from "./types";

const curatedChars = curatedCharsJson as KanjiData[];
const curatedWords = curatedWordsJson as WordData[];

const isHan = (c: string) => /\p{Script=Han}/u.test(c) && c !== "々" && c !== "〆" && c !== "〇";

/**
 * 表記を漢字1字ずつに分ける（かなは除く）。々 は前の字（人々 → 人・人）。
 * 互換漢字は NFC で統合漢字にそろえる。語の rt（字ごとの読み）と同じ並びになる。
 */
export function splitKanji(text: string): string[] {
  const out: string[] = [];
  for (const c of Array.from(text.normalize("NFC"))) {
    if (isHan(c)) out.push(c);
    else if (c === "々" && out.length) out.push(out[out.length - 1]);
  }
  return out;
}

/** 漢字1字 → 辞書エントリ。 */
export const charMap: Map<string, KanjiData> = new Map();
/** 読み（ひらがな）→ 語（同じ読みの語があるので配列）。 */
export const kanaToWords: Map<string, WordData[]> = new Map();
/** 表記 → 語（同じ表記で読みの違う語もあるので配列）。 */
export const kanjiToWords: Map<string, WordData[]> = new Map();
/** 漢字1字 → その字を含む語の一覧（逆引き。読める語・発見で使用）。 */
export const charToWords: Map<string, WordData[]> = new Map();
/** 韓国語の語（意味・同じ漢字の韓国語の語）→ 日本語の語。학생 と打って 学生 を探すため。 */
export const koreanToWords: Map<string, WordData[]> = new Map();
/** 韓国の字 → 日本の字（學 → 学）。韓国の字で打った語を引くときに使う。 */
export const koToJp: Map<string, string> = new Map();
/** 全語リスト（参照用）。中身は rebuildIndexes で入れ替える。 */
export const seedWords: WordData[] = [];
/** 語（表記|読み）から、全語リストの中の番号へ。 */
const numbers: Map<string, number> = new Map();

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** 意味の韓国語を、語ごとに（"학생, 학도" → 학생・학도。括弧の添え書きは外す）。 */
export function koreanItems(w: Pick<WordData, "gloss" | "en" | "ko">): string[] {
  const items = w.en ? [] : w.gloss.split(/,\s*/).map((s) => s.replace(/\s*\(.*?\)\s*/g, "").trim());
  return [...new Set([...items, ...(w.ko ? [w.ko] : [])].filter((s) => /^[가-힣 ]+$/.test(s)))];
}

function rebuildIndexes(charList: KanjiData[], wordList: WordData[]): void {
  charMap.clear();
  koToJp.clear();
  for (const c of charList) {
    charMap.set(c.char, c);
    if (c.ko && c.ko !== c.char) koToJp.set(c.ko, c.char);
  }

  kanaToWords.clear();
  kanjiToWords.clear();
  charToWords.clear();
  koreanToWords.clear();
  numbers.clear();
  seedWords.length = 0;
  for (const w of wordList) {
    numbers.set(`${w.kanji}|${w.kana}`, seedWords.length);
    seedWords.push(w);
    push(kanaToWords, normalizeReading(w.kana), w);
    push(kanjiToWords, w.kanji.normalize("NFC"), w);
    for (const ch of new Set(splitKanji(w.kanji))) push(charToWords, ch, w);
    for (const k of koreanItems(w)) push(koreanToWords, k.replace(/\s+/g, ""), w);
  }
}

// 起動直後は curated データで初期化（テスト環境ではこれだけで動く）。
rebuildIndexes(curatedChars, curatedWords);

let fullLoaded = false;

/**
 * public/data/*.json（全データ）を取得してインデックスを再構築する。
 * 取得に失敗した場合は curated データのまま継続する（オフライン耐性）。読めたら true。
 * ブラウザ実行時にアプリ起動で一度だけ呼ぶ。
 */
export async function initFullDataset(): Promise<boolean> {
  if (fullLoaded) return true;
  const baseRaw = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
  try {
    const [chars, wordsText] = await Promise.all([
      fetch(`${base}data/kanji.json`).then((r) => r.json() as Promise<KanjiData[]>),
      fetch(`${base}data/words.json`).then((r) => r.text()),
    ]);
    rebuildIndexes(chars, JSON.parse(wordsText) as WordData[]);
    version = versionOf(wordsText);
    fullLoaded = true;
  } catch (e) {
    console.warn("전체 사전을 읽지 못했습니다. 기본 단어로만 동작합니다.", e);
  }
  return fullLoaded;
}

let version = "";

/** words.json の中身から作る短い名前（FNV-1a）。番号の指す語は版ごとに違うので、同じ版どうしでだけ受け渡す。 */
export function versionOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

/** 全データ（words.json）の版（みんなの雨で、語の番号に添える）。全データを読めていなければ ""。 */
export function wordsVersion(): string {
  return version;
}

/**
 * 全データ（words.json）の中での語の番号（みんなの雨で、語の代わりに送る）。辞書に無い語や、全データを読めていない
 * とき（番号が words.json と合わない）は undefined。
 */
export function wordNumber(kanji: string, kana: string): number | undefined {
  return fullLoaded ? numbers.get(`${kanji.normalize("NFC")}|${kana}`) : undefined;
}

/** wordNumber の逆。 */
export function wordByNumber(n: number): WordData | undefined {
  return fullLoaded ? seedWords[n] : undefined;
}

/** 漢字1字の辞書エントリを取得（未収録なら undefined）。 */
export function getCharData(char: string): KanjiData | undefined {
  return charMap.get(char);
}

/** 韓国で書く形の表記。字形が同じ字や辞書に無い字はそのまま。例: 学生 → 學生 */
export function koForm(text: string): string {
  return Array.from(text.normalize("NFC"))
    .map((c) => charMap.get(c)?.ko ?? c)
    .join("");
}

/** 韓国の字を日本の字に（學生 → 学生）。日本の字や辞書に無い字はそのまま。 */
export function jpForm(text: string): string {
  return Array.from(text.normalize("NFC"))
    .map((c) => koToJp.get(c) ?? c)
    .join("");
}

/** 字の、韓国で書く形（字形の設定で両方を選んでいて、形が違うときだけ）。無ければ null。 */
export function koGlyph(char: string, script: ScriptPref): string | null {
  const ko = charMap.get(char)?.ko;
  return script === "both" && ko && ko !== char ? ko : null;
}

/** 常用漢字（2136字）の辞書エントリ。全データの読込後に中身がそろう。 */
export function joyoChars(): KanjiData[] {
  return [...charMap.values()].filter((c) => c.joyo);
}

/** 辞書の語（同じ漢字の韓国語の語など、辞書にだけある項目つき）。辞書に無ければ undefined。 */
export function dictWord(kanji: string, kana: string): WordData | undefined {
  return kanjiToWords.get(kanji.normalize("NFC"))?.find((w) => w.kana === kana);
}
