import type { ReactNode } from "react";
import { dictWord } from "../data/dataset";
import { glossLang, glossText } from "../data/gloss";
import type { WordData } from "../data/types";
import styles from "../app.module.css";
import KanjiText from "./KanjiText";
import { Icon } from "./Icon";

/** 語の、同じ漢字・同じ意味の韓国語の語（학생）。集めた語には無いので辞書から引く。無ければ null。 */
export function koreanOf(word: Pick<WordData, "kanji" | "kana"> & Partial<Pick<WordData, "ko" | "ks">>): string | null {
  const w = word.ko !== undefined ? word : dictWord(word.kanji, word.kana);
  return w?.ks && w.ko ? w.ko : null;
}

/** 語の、韓国語の同じ漢字の語との意味・使い方のちがい（洋服 ↔ 양복）。集めた語には無いので辞書から引く。無ければ null。 */
export function diffOf(word: Pick<WordData, "kanji" | "kana"> & Partial<Pick<WordData, "ko" | "kd">>): string | null {
  const w = word.ko !== undefined ? word : dictWord(word.kanji, word.kana);
  return w?.ko && w.kd ? w.kd : null;
}

/**
 * 語の一行：韓国語の漢字語があればそれを先に（학생 学生 がくせい）。日本語では別の言い方の語は、表記・読み・意味。
 * 押すとその語が開く。
 */
export function WordRow({
  word,
  meta,
  missing,
  hideKana = false,
  onOpen,
}: {
  word: Pick<WordData, "kanji" | "kana" | "gloss" | "en"> & Partial<Pick<WordData, "ko" | "ks">>;
  meta?: ReactNode;
  /** あと1音で読める語の、まだ読めない字。 */
  missing?: string;
  /** 読みを伏せる（言える語の一覧：読みは自分で言ってみる）。 */
  hideKana?: boolean;
  onOpen: () => void;
}) {
  const korean = koreanOf(word);
  return (
    <li>
      <button type="button" className={styles.wordRow} onClick={onOpen}>
        <span className={styles.wordText}>
          <span className={styles.wordLine}>
            {korean ? (
              <span className={`${styles.wordHangul} t-ko`} lang="ko">
                {korean}
              </span>
            ) : null}
            <KanjiText text={word.kanji} missing={missing} className={korean ? styles.wordHanja : styles.wordHangul} />
            {hideKana ? null : (
              <span className={`${styles.wordHanja} t-ja`} lang="ja">
                {word.kana}
              </span>
            )}
          </span>
          {word.gloss && !korean ? (
            <span className={styles.wordGloss} lang={glossLang(word)}>
              {glossText(word)}
            </span>
          ) : null}
          {meta ? <span className={styles.wordMeta}>{meta}</span> : null}
        </span>
        <span className={styles.chev}>
          <Icon name="back" size={18} />
        </span>
      </button>
    </li>
  );
}
