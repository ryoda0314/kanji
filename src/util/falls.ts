// みんなの雨（見つける → みんなの雨、pages/Everyone）：集めた語を、名前も端末の番号も付けずに送り、この1時間に
// みんなが集めた語を読んで降らせる（supabase/falls.sql）。送るのは辞書（words.json）の中の語の番号と辞書の版だけ。
// 手で登録した語・辞書に無い語は送らない（番号なので、辞書に無い言葉は降らない）。自分 で止められる（SHARE_PREF）。
// 数えるのと同じく、公開先で開いたときだけ送る（util/usage）。
import { wordByNumber, wordNumber, wordsVersion } from "../data/dataset";
import type { ResolvedWord, WordData } from "../data/types";
import { onPublicSite, rpc } from "./usage";

/** 自分 の「集めた語を、みんなの雨に降らせる」（util/local の usePref と同じ形：1 か 0。既定はオン）。 */
export const SHARE_PREF = "shareWords";
const KEY = `kotonohashi.${SHARE_PREF}`;

export function shareAllowed(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

/** 降らせるのを止める（引き継ぎのリンクで、前のところで止めていたとき）。 */
export function stopSharing(): void {
  try {
    localStorage.setItem(KEY, "0");
  } catch {
    /* 残らないだけ */
  }
}

/** 集めた語を、みんなの雨に一つ降らせる（待たない。送れなくても何も起きない）。 */
export function shareWord(word: Pick<ResolvedWord, "kanji" | "kana" | "source">): void {
  if (word.source === "manual" || !onPublicSite() || !shareAllowed()) return;
  const n = wordNumber(word.kanji, word.kana);
  if (n === undefined) return;
  rpc("kh_fall", { p_ver: wordsVersion(), p_word: n })?.catch(() => {
    /* 降らなかっただけ */
  });
}

export interface Fall {
  id: number;
  word: WordData;
  /** 集められた時（epoch ミリ秒）。 */
  at: number;
}

/**
 * この1時間に降った語（after より新しい分。同じ語は一度、新しい順）と、この1時間に降った数。読めなければ null。
 * 番号がいまの辞書に無い語は除く。
 */
export async function readFalls(after = 0): Promise<{ falls: Fall[]; total: number } | null> {
  const version = wordsVersion();
  if (!version) return null;
  try {
    const res = await rpc("kh_recent", { p_ver: version, p_after: after });
    if (!res?.ok) return null;
    const data = (await res.json()) as { total: number; falls: { id: number; word: number; at: string }[] };
    const falls = data.falls.flatMap((f) => {
      const word = wordByNumber(f.word);
      return word ? [{ id: f.id, word, at: Date.parse(f.at) }] : [];
    });
    return { falls, total: data.total };
  } catch {
    return null;
  }
}

/** この1時間に降った数だけ（あつめる の入口に添える）。after をいちばん大きくすると、語は返らず数だけ返る。 */
export async function readFallsTotal(): Promise<number | null> {
  return (await readFalls(Number.MAX_SAFE_INTEGER))?.total ?? null;
}
