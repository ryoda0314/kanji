// 集めた語と字の読み出し（Dexie の useLiveQuery）を、画面をまたいで覚えておく。
// 前に読んだ結果を最初の描画から使うので、タブを移っても一瞬空にならず、戻ったときにスクロール位置も戻る
// （中身の高さが先にそろうため）。中身はすぐに端末の最新の結果に入れ替わる。
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { loadSentences, type SentenceData } from "../data/sentences";
import { db, soundsOf, type CollectedChar, type CollectedWord } from "../db";

const last: { words?: CollectedWord[]; chars?: CollectedChar[] } = {};
let lastSentences: SentenceData | undefined;

/** 集めた語（新しい順）。 */
export function useWords(): CollectedWord[] | undefined {
  const words = useLiveQuery(() => db.words.orderBy("addedAt").reverse().toArray(), [], last.words);
  useEffect(() => {
    if (words) last.words = words;
  }, [words]);
  return words;
}

/** 集めた字（その字が入った語の数つき）。 */
export function useChars(): CollectedChar[] | undefined {
  const chars = useLiveQuery(() => db.chars.toArray(), [], last.chars);
  useEffect(() => {
    if (chars) last.chars = chars;
  }, [chars]);
  return chars;
}

/** 文で出会う の例文（使う画面が開いたときに一度だけ読む）。読んでいる間は undefined、読めなければ null。 */
export function useSentences(): SentenceData | null | undefined {
  const [data, setData] = useState<SentenceData | null | undefined>(() => lastSentences);
  useEffect(() => {
    let active = true;
    loadSentences().then((d) => {
      lastSentences = d ?? undefined;
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);
  return data;
}

/** 集めた字の音（字|読み）。集めた語から作る。 */
export function useSounds(words: readonly CollectedWord[] | undefined): Set<string> {
  return useMemo(() => soundsOf(words ?? []), [words]);
}
