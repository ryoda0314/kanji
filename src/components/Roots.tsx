import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { getCharData, koGlyph, splitKanji } from "../data/dataset";
import { toHiragana } from "../data/kana";
import { baseAt, hasParts, isOnReading } from "../data/sounds";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/**
 * あつめたときの字ごとの添え書き。before = あつめる前に、その字が入った語をいくつ持っていたか。
 * はじめての字はアクセントの色、また出会った字は紫（ことのあめ の「前にも降ったかたち」と同じ）。
 */
export function rootNotes(before: number[]): ReactNode[] {
  return before.map((n, i) =>
    n === 0 ? (
      <span key={i} className={`${styles.note} ${styles.noteNew}`}>
        {t.collect.rootNew}
      </span>
    ) : (
      <span key={i} className={`${styles.note} ${styles.noteAgain}`}>
        {t.collect.rootAgain}
        <br />
        {t.collect.rootAgainCount(n + 1)}
      </span>
    )
  );
}

/**
 * 語を漢字の根に分けて並べる：いちばん上に 소리 짝（韓国語の音 → この語での日本語の読み：학 → がく）、字、韓国語の訓、
 * 音読みか訓読みか。韓国語の漢字語の音から、日本語の音へ渡るところ。訓読み（산 · やま）は音の対応ではないので矢印にしない。
 * 熟字訓（今日 きょう）は字に分けられないので、字ごとの読みは出さない。字を押すとその字のページへ。
 */
export function Roots({
  word,
  notes,
  grow = false,
}: {
  word: Pick<WordData, "kanji" | "rt" | "base" | "odd">;
  /** 字ごとの添え書き（はじめての字・また出会った字）。 */
  notes?: (ReactNode | null)[];
  /** 根が伸びるように一つずつ現れる（あつめた直後）。 */
  grow?: boolean;
}) {
  const { script } = usePrefs();
  const chars = splitKanji(word.kanji);
  const parts = hasParts(word);

  return (
    <ol className={styles.roots} style={{ gridTemplateColumns: `repeat(${Math.min(chars.length, 4)}, minmax(0, 1fr))` }}>
      {chars.map((c, i) => {
        const d = getCharData(c);
        const ko = koGlyph(c, script);
        const here = parts ? word.rt?.[i] : undefined;
        const usual = parts ? baseAt(word, i) : undefined;
        const odd = word.odd?.includes(i);
        const kind = !here ? null : odd ? t.roots.odd : isOnReading(c, toHiragana(usual ?? "")) ? t.roots.on : t.roots.kun;
        return (
          <li key={i} className={grow ? styles.grow : undefined} style={{ "--i": i } as CSSProperties}>
            <Link to={`/hanja/${encodeURIComponent(c)}`} className={styles.root}>
              <span className={styles.pair}>
                {d?.sounds[0] ? (
                  <span className="t-ko" lang="ko">
                    {d.sounds[0].eum}
                  </span>
                ) : null}
                {here ? (
                  <>
                    <span className={styles.pairArrow} aria-hidden="true">
                      {kind === t.roots.on ? "→" : "·"}
                    </span>
                    <span className={`t-ja ${styles.pairJa}`} lang="ja">
                      {here}
                    </span>
                  </>
                ) : null}
              </span>
              <span className={`hanja ${styles.glyph}`} lang="ja">
                {c}
              </span>
              {ko ? (
                <span className={`hanja-ko ${styles.jpMark}`} lang="ko">
                  {ko}
                </span>
              ) : null}
              {d?.sounds[0]?.hun ? (
                <span className={`${styles.reading} t-ko`} lang="ko">
                  <span className={styles.hun}>{d.sounds[0].hun}</span>
                </span>
              ) : null}
              {kind ? (
                <span className={styles.ja}>
                  {kind}
                  {usual && here && usual !== here ? (
                    <>
                      {" · "}
                      <span className="t-ja" lang="ja">
                        {t.read.usualSound(usual)}
                      </span>
                    </>
                  ) : null}
                </span>
              ) : null}
              {notes?.[i] ?? null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
