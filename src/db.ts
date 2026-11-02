// 端末内保存（IndexedDB）の定義と収集ロジック。
// Dexie を使い、Web ブラウザでも Capacitor の WebView でも同じコードで永続化する。
// アカウント不要・オフライン完結。書き出し・読み込みで端末を移せる。ことのあめ のアカウントでログインすれば、
// アカウントの記録とも合わせる（util/account。recordWords・applyRecord）。

import Dexie, { type EntityTable } from "dexie";
import type { ResolvedWord } from "./data/types";
import { kanjiToWords, splitKanji } from "./data/dataset";
import { isRemoved, recordKey, type RecordWord } from "./data/record";
import { metUpdate, readUpdate, type WordProgress } from "./data/stage";
import { wordSounds } from "./data/sounds";
import { shareWord } from "./util/falls";
import { noteRemoved } from "./util/removed";
import { countUsage } from "./util/usage";

/** ユーザーが集めた語1件。覚え具合の出来事（WordProgress）も持つ。 */
export interface CollectedWord extends WordProgress {
  id: number;
  kanji: string;
  kana: string;
  /** 字ごとのこの語での読み・ふだんの読み（辞書と同じ。手で登録した語は分けられたときだけ）。 */
  rt?: string[];
  base?: string[];
  odd?: number[];
  gloss: string;
  en?: boolean;
  /** 構成漢字（検索・漢字のページ連携のため multiEntry インデックス対象）。 */
  chars: string[];
  /** この語で手に入る字の音（字|読み。読める語を数えるため）。 */
  sounds: string[];
  source: ResolvedWord["source"];
  /** 追加日時（epoch ミリ秒）。 */
  addedAt: number;
}

/** 漢字1字の収集状態。 */
export interface CollectedChar {
  /** 漢字1文字（主キー）。 */
  char: string;
  /** この漢字を含む語を集めた延べ回数（根の深さ）。 */
  count: number;
  /** 初めて収集した日時。 */
  firstAddedAt: number;
  /** 最後に収集した日時。 */
  lastAddedAt: number;
}

const db = new Dexie("kotonohashi") as Dexie & {
  words: EntityTable<CollectedWord, "id">;
  chars: EntityTable<CollectedChar, "char">;
};

db.version(1).stores({
  // &[kanji+kana] で同一語の重複登録を防ぐ。*chars で構成漢字から、*sounds で字の音から逆引き可能。
  words: "++id, &[kanji+kana], kana, *chars, *sounds, addedAt",
  chars: "char, count, firstAddedAt, lastAddedAt",
});

/** 語の一覧から字ごとの集計（その字が入った語の数・最初と最後の日時）を作る。 */
export function tallyChars(words: Pick<CollectedWord, "chars" | "addedAt">[]): CollectedChar[] {
  const map = new Map<string, CollectedChar>();
  for (const w of words) {
    for (const ch of new Set(w.chars)) {
      const c = map.get(ch);
      if (c) {
        c.count++;
        c.firstAddedAt = Math.min(c.firstAddedAt, w.addedAt);
        c.lastAddedAt = Math.max(c.lastAddedAt, w.addedAt);
      } else {
        map.set(ch, { char: ch, count: 1, firstAddedAt: w.addedAt, lastAddedAt: w.addedAt });
      }
    }
  }
  return [...map.values()];
}

/** 集めた語の字の音を一つにまとめる（読める語を数えるため）。 */
export function soundsOf(words: readonly Pick<CollectedWord, "sounds">[]): Set<string> {
  const out = new Set<string>();
  for (const w of words) for (const s of w.sounds ?? []) out.add(s);
  return out;
}

/** 既に同じ語（表記+読み）を登録済みか。 */
export async function hasWord(kanji: string, kana: string): Promise<boolean> {
  const found = await db.words.get({ kanji: kanji.normalize("NFC"), kana });
  return found != null;
}

type NewWord = Pick<CollectedWord, "kanji" | "kana" | "rt" | "base" | "odd" | "gloss" | "en" | "source"> & Omit<WordProgress, "addedAt">;

/** 語を1件入れ、構成漢字の集計を進める（トランザクション内で呼ぶ）。同じ語があれば false。 */
async function putWord(word: NewWord, at: number): Promise<boolean> {
  const kanji = word.kanji.normalize("NFC");
  if (await hasWord(kanji, word.kana)) return false;
  const chars = splitKanji(kanji);
  const row: Omit<CollectedWord, "id"> = {
    kanji,
    kana: word.kana,
    gloss: word.gloss,
    chars,
    sounds: wordSounds({ kanji, rt: word.rt, base: word.base }),
    source: word.source,
    addedAt: at,
    ...progressOf(word),
  };
  if (word.rt) row.rt = word.rt;
  if (word.base) row.base = word.base;
  if (word.odd?.length) row.odd = word.odd;
  if (word.en) row.en = true;
  await db.words.add(row as CollectedWord);

  // 構成漢字ごとに収集状態を更新（重複字は1語につき1回だけ数える）。
  for (const ch of new Set(chars)) {
    const existing = await db.chars.get(ch);
    if (existing) {
      await db.chars.update(ch, {
        count: existing.count + 1,
        firstAddedAt: Math.min(existing.firstAddedAt, at),
        lastAddedAt: Math.max(existing.lastAddedAt, at),
      });
    } else {
      await db.chars.add({ char: ch, count: 1, firstAddedAt: at, lastAddedAt: at });
    }
  }
  return true;
}

/**
 * 解決済みの語を1件追加する。
 * 同時に構成漢字の収集状態（count / 日時）を更新する。
 * すでに同じ語が存在する場合は false を返す（何もしない）。
 */
export async function addWord(word: ResolvedWord): Promise<boolean> {
  const added = await db.transaction("rw", db.words, db.chars, () => putWord(word, Date.now()));
  if (added) {
    void askPersist();
    countUsage("collect");
    shareWord(word);
  }
  return added;
}

let persistAsked = false;

/** 集めた語をブラウザに消されにくくするよう頼む（語を集めたときに一度だけ。対応していなければ何もしない）。 */
async function askPersist(): Promise<void> {
  if (persistAsked || typeof navigator === "undefined" || !navigator.storage?.persist) return;
  persistAsked = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* 頼めなくても、集めた語はそのまま */
  }
}

/** 覚え具合の出来事だけを取り出す（数でないものは捨てる）。 */
function progressOf(w: Partial<WordProgress>): Omit<WordProgress, "addedAt"> {
  const out: Omit<WordProgress, "addedAt"> = {};
  for (const k of ["metDays", "lastMetAt", "readDays", "lastReadAt", "missedAt"] as const) {
    const v = w[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 辞書から集めた語のうち、意味がいまの辞書と違う語（辞書を作り直して意味が変わったときなど）。手で登録した語はそのまま。 */
export function staleGlosses(
  words: Pick<CollectedWord, "id" | "kanji" | "kana" | "gloss" | "source">[],
  lookup: (w: { kanji: string; kana: string }) => { gloss: string; en?: boolean } | undefined
): { id: number; gloss: string; en?: boolean }[] {
  const out: { id: number; gloss: string; en?: boolean }[] = [];
  for (const w of words) {
    if (w.source !== "seed") continue;
    const found = lookup(w);
    if (found && found.gloss !== w.gloss) out.push({ id: w.id, gloss: found.gloss, en: found.en });
  }
  return out;
}

/** 集めた語の意味を、読み込んだ辞書の意味にそろえる（起動して辞書を読んだあとに一度）。 */
export async function refreshGlosses(): Promise<number> {
  return db.transaction("rw", db.words, async () => {
    const updates = staleGlosses(await db.words.toArray(), (w) => kanjiToWords.get(w.kanji)?.find((d) => d.kana === w.kana));
    for (const u of updates) await db.words.update(u.id, { gloss: u.gloss, en: u.en });
    return updates.length;
  });
}

/** 文で出会う で、集めた語にまた出会った（集めた日とは別の日に、一日一度だけ数える）。 */
export async function recordMet(keys: { kanji: string; kana: string }[], at = Date.now()): Promise<void> {
  await db.transaction("rw", db.words, async () => {
    for (const k of keys) {
      const w = await db.words.get({ kanji: k.kanji.normalize("NFC"), kana: k.kana });
      const update = w ? metUpdate(w, at) : null;
      if (w && update) await db.words.update(w.id, update);
    }
  });
}

/** 漢字から読みを読めた（ok）・答えを見た（!ok）。読めた日は一日一度だけ数える。 */
export async function recordRead(key: { kanji: string; kana: string }, ok: boolean, at = Date.now()): Promise<void> {
  await db.transaction("rw", db.words, async () => {
    const w = await db.words.get({ kanji: key.kanji.normalize("NFC"), kana: key.kana });
    if (w) await db.words.update(w.id, readUpdate(w, ok, at));
  });
  if (ok) countUsage("read");
}

/**
 * 語を1件削除する。構成漢字の count を減らし、0 になった漢字は外す。消したことを残し、アカウントの記録から生き返らないようにする。
 */
export async function removeWord(id: number): Promise<void> {
  await db.transaction("rw", db.words, db.chars, async () => {
    const word = await db.words.get(id);
    if (!word) return;
    noteRemoved(recordKey(word));
    await db.words.delete(id);
    for (const ch of new Set(word.chars)) {
      const existing = await db.chars.get(ch);
      if (!existing) continue;
      if (existing.count <= 1) {
        await db.chars.delete(ch);
      } else {
        await db.chars.update(ch, { count: existing.count - 1 });
      }
    }
  });
}

// --- 書き出し・読み込み（端末を移す・消える前に残す） -------------------------

/** 書き出しファイルの1語（覚え具合の出来事も）。字の集計は読み込み時に語から作り直すので持たない。 */
export type BackupWord = Pick<CollectedWord, "kanji" | "kana" | "rt" | "base" | "odd" | "gloss" | "en" | "source" | "addedAt"> &
  Omit<WordProgress, "addedAt">;

const BACKUP_APP = "kotonohashi";

/** 集めた語をすべて、読み込み直せる JSON 文字列にする（pretty でなければ詰めて。引き継ぎのリンク用）。 */
export async function exportBackup(pretty = true): Promise<string> {
  const words = await db.words.orderBy("addedAt").toArray();
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map((w) => ({
        kanji: w.kanji,
        kana: w.kana,
        ...(w.source === "manual" ? { rt: w.rt, base: w.base, gloss: w.gloss } : {}),
        source: w.source,
        addedAt: w.addedAt,
        ...progressOf(w),
      })),
    },
    null,
    pretty ? 1 : undefined
  );
}

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;

/** 書き出しファイルの中身を読む。形が違えば null（どこも書き換えない）。辞書の語は、いまの辞書から意味と読みを付け直す。 */
export function parseBackup(text: string): BackupWord[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { app, words } = data as { app?: unknown; words?: unknown };
  if (app !== BACKUP_APP || !Array.isArray(words)) return null;
  return backupWordsOf(words);
}

/** 書き出し・アカウントの記録の語を、いまの辞書で読み直す（辞書の語は意味と読みを付け直す）。形が違えば null。 */
function backupWordsOf(words: readonly unknown[]): BackupWord[] | null {
  const out: BackupWord[] = [];
  for (const w of words) {
    if (typeof w !== "object" || w === null) return null;
    const { kanji, kana, gloss, source, addedAt, rt, base } = w as Record<string, unknown>;
    if (typeof kanji !== "string" || typeof kana !== "string" || !kanji.trim() || !kana.trim()) return null;
    const dict = kanjiToWords.get(kanji.trim().normalize("NFC"))?.find((d) => d.kana === kana.trim());
    const manual = source === "manual" || !dict;
    out.push({
      kanji: kanji.trim(),
      kana: kana.trim(),
      ...(manual
        ? { rt: strings(rt), base: strings(base), gloss: typeof gloss === "string" ? gloss : "" }
        : { rt: dict.rt, base: dict.base, odd: dict.odd, gloss: dict.gloss, en: dict.en }),
      source: manual ? "manual" : "seed",
      addedAt: typeof addedAt === "number" && Number.isFinite(addedAt) ? addedAt : Date.now(),
      ...progressOf(w as Partial<WordProgress>),
    });
  }
  return out;
}

/** 書き出した語を足す。持っている語はそのまま（上書きしない）。 */
export async function restoreWords(words: BackupWord[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  await db.transaction("rw", db.words, db.chars, async () => {
    for (const w of [...words].sort((a, b) => a.addedAt - b.addedAt)) {
      if (await putWord(w, w.addedAt)) added++;
    }
  });
  return { added, skipped: words.length - added };
}

// --- アカウントの記録と合わせる（util/account） ----------------------------------

/** 集めた語の写し（書き出しと同じ形。data/record）。 */
export async function recordWords(): Promise<RecordWord[]> {
  const words = await db.words.orderBy("addedAt").toArray();
  return words.map((w) => ({
    kanji: w.kanji,
    kana: w.kana,
    source: w.source,
    addedAt: w.addedAt,
    ...(w.source === "manual" ? { rt: w.rt, base: w.base, gloss: w.gloss } : {}),
    ...progressOf(w),
  }));
}

const PROGRESS = ["addedAt", "metDays", "lastMetAt", "readDays", "lastReadAt", "missedAt"] as const;

/**
 * アカウントの記録と合わせた語（data/record の mergeRecords）を、この端末に入れる。無い語は足し、ある語は覚え具合をそろえ、
 * 消した語（removed の時刻より後に触っていない語）は外す。合わせているあいだにここで集めた語はそのまま残る。字の集計は語から作り直す。
 */
export async function applyRecord(words: RecordWord[], removed: Record<string, number>): Promise<void> {
  const incoming = backupWordsOf(words) ?? [];
  await db.transaction("rw", db.words, db.chars, async () => {
    for (const w of incoming) {
      const here = await db.words.get({ kanji: w.kanji.normalize("NFC"), kana: w.kana });
      if (!here) {
        await putWord(w, w.addedAt);
        continue;
      }
      const update: Partial<WordProgress> = {};
      for (const k of PROGRESS) if (w[k] !== undefined && w[k] !== here[k]) update[k] = w[k];
      if (Object.keys(update).length) await db.words.update(here.id, update);
    }
    for (const here of await db.words.toArray()) if (isRemoved(here, removed)) await db.words.delete(here.id);
    await db.chars.clear();
    await db.chars.bulkAdd(tallyChars(await db.words.toArray()));
  });
}

export { db };
