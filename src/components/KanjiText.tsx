import { koForm } from "../data/dataset";
import { rubyParts } from "../data/reading";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/**
 * 語の表記（日本の字）を描く。字形の設定が 両方 なら、形の違う字のある語だけ韓国で書く形を小さく添える（学生 學生）。
 * missing の字（あと1音で読める語の、まだ読めない字）は点線で示す。word を渡すと、字ごとにふりがなを付ける。
 */
export default function KanjiText({
  text,
  className = "",
  missing,
  word,
}: {
  text: string;
  className?: string;
  missing?: string;
  /** ふりがなを付けるとき（読み・字ごとの読み）。 */
  word?: Pick<WordData, "kanji" | "kana" | "rt">;
}) {
  const { script } = usePrefs();
  const ko = koForm(text);
  const showKo = script === "both" && ko !== text;

  return (
    <span className={`hanja ${className}`} lang="ja">
      {word
        ? rubyParts(word, text).map((p, i) =>
            p.rt ? (
              <ruby key={i}>
                {p.text}
                <rt>{p.rt}</rt>
              </ruby>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )
        : missing
          ? Array.from(text).map((c, i) =>
              c === missing ? (
                <span key={i} className={styles.missing}>
                  {c}
                </span>
              ) : (
                c
              )
            )
          : text}
      {showKo ? (
        <span className={`hanja-ko ${styles.jp}`} lang="ko" title={t.common.koForm}>
          {ko}
        </span>
      ) : null}
    </span>
  );
}
