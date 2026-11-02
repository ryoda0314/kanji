// アカウントに置く記録（ことのあめ のアカウントでログインしたとき。util/account）：集めた語（書き出しと同じ形。覚え具合の出来事も）と、
// 消した語（表記|読み → 消した時刻）。
//
// 端末の記録とアカウントの記録は、上書きせずに合わせる（mergeRecords）。両方の語を合わせ、同じ語は 集めた日の早いほう・数の多いほう・
// 時刻の遅いほう を取る（スマホとパソコンで同じ日に読めても、二日には数えない）。消した語は、消した時刻より後に集め直したり
// 読んだりしていなければ消えたまま（別の端末の記録から生き返らない）。純粋：record.test.ts で確かめる。
import type { WordProgress } from "./stage";

/** 記録の1語。辞書の語は表記・読みと覚え具合だけ（意味・字ごとの読みは読み込むときに辞書から付け直す）。 */
export type RecordWord = Pick<WordProgress, "addedAt" | "metDays" | "lastMetAt" | "readDays" | "lastReadAt" | "missedAt"> & {
  kanji: string;
  kana: string;
  source: "seed" | "manual";
  /** 手で登録した語だけ。 */
  rt?: string[];
  base?: string[];
  gloss?: string;
};

export interface RecordState {
  app: string;
  version: 1;
  words: RecordWord[];
  /** 消した語（表記|読み → 消した時刻）。 */
  removed: Record<string, number>;
}

const COUNTS = ["metDays", "readDays"] as const;
const TIMES = ["lastMetAt", "lastReadAt", "missedAt"] as const;

export const recordKey = (w: Pick<RecordWord, "kanji" | "kana">) => `${w.kanji.normalize("NFC")}|${w.kana}`;

type Touched = Pick<RecordWord, "kanji" | "kana" | "addedAt" | "lastMetAt" | "lastReadAt" | "missedAt">;

/** その語に最後に何かあった時刻（集めた・出会った・読んだ・答えを見た）。 */
const lastTouched = (w: Touched) => Math.max(w.addedAt, ...TIMES.map((k) => w[k] ?? 0));

/** 消した語で、消したあとに集め直しても触ってもいないか。 */
export function isRemoved(w: Touched, removed: Record<string, number>): boolean {
  const at = removed[recordKey(w)];
  return at !== undefined && lastTouched(w) <= at;
}

/** いつも同じ並びの形に（アカウントの jsonb は鍵の並びを変えるので、比べるときもこの形で）。 */
function canonicalWord(w: RecordWord): RecordWord {
  const out: RecordWord = { kanji: w.kanji.normalize("NFC"), kana: w.kana, source: w.source, addedAt: w.addedAt };
  for (const k of [...COUNTS, ...TIMES]) if (w[k] !== undefined) out[k] = w[k];
  if (w.source === "manual") {
    if (w.rt) out.rt = w.rt;
    if (w.base) out.base = w.base;
    if (w.gloss !== undefined) out.gloss = w.gloss;
  }
  return out;
}

/** 同じ語の二つの写しを一つに。手で登録した語の意味・読みは a（この端末）を先に。 */
function mergeWord(a: RecordWord, b: RecordWord): RecordWord {
  const out: RecordWord = { ...b, ...a, addedAt: Math.min(a.addedAt, b.addedAt) };
  for (const k of [...COUNTS, ...TIMES]) {
    const v = Math.max(a[k] ?? -Infinity, b[k] ?? -Infinity);
    if (Number.isFinite(v)) out[k] = v;
    else delete out[k];
  }
  return out;
}

/** 二つの記録を一つに（a はこの端末、b はアカウント）。並びは集めた順。 */
export function mergeRecords(a: RecordState, b: RecordState): RecordState {
  const removed: Record<string, number> = { ...b.removed };
  for (const [k, at] of Object.entries(a.removed)) removed[k] = Math.max(at, removed[k] ?? 0);
  const byKey = new Map<string, RecordWord>();
  // 消したあとに集め直した・触った写しだけが残る。
  for (const w of [...b.words, ...a.words]) {
    if (isRemoved(w, removed)) continue;
    const key = recordKey(w);
    const had = byKey.get(key);
    byKey.set(key, had ? mergeWord(w, had) : w);
  }
  const words = [...byKey.values()]
    .map(canonicalWord)
    .sort((x, y) => x.addedAt - y.addedAt || (recordKey(x) < recordKey(y) ? -1 : recordKey(x) > recordKey(y) ? 1 : 0));
  const sorted = Object.keys(removed).sort();
  return { app: a.app, version: 1, words, removed: Object.fromEntries(sorted.map((k) => [k, removed[k]])) };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;

/** アカウントから読んだ記録（jsonb）。形が違えば null（どこも書き換えない）。読めない語は捨てる。 */
export function reviveRecord(value: unknown, app: string): RecordState | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { app?: unknown; words?: unknown; removed?: unknown };
  if (v.app !== app || !Array.isArray(v.words)) return null;
  const words: RecordWord[] = [];
  for (const raw of v.words) {
    if (typeof raw !== "object" || raw === null) continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.kanji !== "string" || typeof w.kana !== "string" || !w.kanji.trim() || !w.kana.trim() || !finite(w.addedAt)) continue;
    const word: RecordWord = { kanji: w.kanji.trim(), kana: w.kana.trim(), source: w.source === "manual" ? "manual" : "seed", addedAt: w.addedAt };
    for (const k of [...COUNTS, ...TIMES]) {
      const n = w[k];
      if (finite(n)) word[k] = n;
    }
    if (word.source === "manual") {
      const rt = strings(w.rt);
      const base = strings(w.base);
      if (rt) word.rt = rt;
      if (base) word.base = base;
      if (typeof w.gloss === "string") word.gloss = w.gloss;
    }
    words.push(word);
  }
  const removed: Record<string, number> = {};
  if (typeof v.removed === "object" && v.removed !== null) {
    for (const [k, at] of Object.entries(v.removed as Record<string, unknown>)) if (finite(at)) removed[k] = at;
  }
  return { app, version: 1, words, removed };
}

/** 二つの記録が同じか（合わせたあと、書き直す・送る必要があるか）。 */
export function sameRecord(a: RecordState, b: RecordState): boolean {
  return JSON.stringify(mergeRecords(a, a)) === JSON.stringify(mergeRecords(b, b));
}
