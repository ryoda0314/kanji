// 集めた語の覚え具合（ことのあめ の メモの段階 と同じ考え方）と、次にふりかえる日。
//   あつめた → また出会った（集めた日とは別の日に、文で出会う の文の中で）→ 読めた（漢字からハングルを、答えを見ずに）
//   → 身についた（日をあけて、もう一度読めた）。
// 段階は語に残した出来事（出会った日数・読めた日数・最後に答えを見た時）から毎回求める。保存するのは出来事だけ。

/** 段階の計算に使う、語に残す出来事。前の版の語には無いので、無ければ 0 として扱う。 */
export interface WordProgress {
  addedAt: number;
  /** 集めた日とは別の日に、文で出会う の文の中でまた出会った日数（一日一度だけ数える）。 */
  metDays?: number;
  lastMetAt?: number;
  /** 漢字からハングルを、答えを見ずに読めた日数（一日一度だけ数える）。 */
  readDays?: number;
  lastReadAt?: number;
  /** 最後にふりかえりで読めずに答えを見た時。これが最後に読めた時より後なら、段階は「また出会った」に戻る。 */
  missedAt?: number;
}

export type Stage = "collected" | "met" | "read" | "known";
export const STAGES: Stage[] = ["collected", "met", "read", "known"];

export const DAY = 24 * 60 * 60 * 1000;

/** その日（端末の暦）の名前。同じ日のくり返しを数えないため。 */
export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function missedSinceRead(w: WordProgress): boolean {
  return (w.missedAt ?? 0) > (w.lastReadAt ?? 0);
}

export function wordStage(w: WordProgress): Stage {
  const read = w.readDays ?? 0;
  if (!missedSinceRead(w)) {
    if (read >= 2) return "known";
    if (read >= 1) return "read";
  }
  return (w.metDays ?? 0) >= 1 || read >= 1 ? "met" : "collected";
}

/**
 * 次にふりかえる時。あつめた 1日後、また出会った 2日後、読めた 6日後、身についた 20日後から読めるたびに倍（120日まで）。
 * 読めずに答えを見たら、その翌日。
 */
export function nextReviewAt(w: WordProgress): number {
  if (missedSinceRead(w)) return (w.missedAt ?? 0) + DAY;
  switch (wordStage(w)) {
    case "collected":
      return w.addedAt + DAY;
    case "met":
      return (w.lastMetAt ?? w.addedAt) + 2 * DAY;
    case "read":
      return (w.lastReadAt ?? w.addedAt) + 6 * DAY;
    case "known":
      return (w.lastReadAt ?? w.addedAt) + Math.min(120, 20 * 2 ** ((w.readDays ?? 2) - 2)) * DAY;
  }
}

export function isDue(w: WordProgress, now: number): boolean {
  return nextReviewAt(w) <= now;
}

/** ふりかえりどきの語を、待たせている順（ふりかえる時の早い順）に。 */
export function dueWords<T extends WordProgress>(words: readonly T[], now: number): T[] {
  return words.filter((w) => isDue(w, now)).sort((a, b) => nextReviewAt(a) - nextReviewAt(b));
}

/** 文で出会う でまた出会ったときの出来事。集めた日と、すでに数えた日は数えない。変わらなければ null。 */
export function metUpdate(w: WordProgress, at: number): Pick<WordProgress, "metDays" | "lastMetAt"> | null {
  const today = dayKey(at);
  if (dayKey(w.addedAt) === today || (w.lastMetAt !== undefined && dayKey(w.lastMetAt) === today)) return null;
  return { metDays: (w.metDays ?? 0) + 1, lastMetAt: at };
}

/** 漢字から読めた（ok）・答えを見た（!ok）ときの出来事。読めた日は一日一度だけ数える。 */
export function readUpdate(w: WordProgress, ok: boolean, at: number): Partial<WordProgress> {
  if (!ok) return { missedAt: at };
  const newDay = w.lastReadAt === undefined || dayKey(w.lastReadAt) !== dayKey(at);
  return { readDays: (w.readDays ?? 0) + (newDay ? 1 : 0), lastReadAt: at };
}
