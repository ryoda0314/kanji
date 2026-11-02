import { useState } from "react";
import { findWordsByKanji, wordKey } from "../data/combine";
import { getCharData, jpForm } from "../data/dataset";
import { kunStem, toKatakana } from "../data/kana";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { WordRow } from "../components/WordRow";
import app from "../app.module.css";
import styles from "./Build.module.css";

type Word = Pick<WordData, "kanji" | "kana" | "gloss">;

/** 集めた字を押して並べ、その並びの語が辞書にあるかを見る。 */
export function Build({ chars, ownedKeys, onOpen }: { chars: string[]; ownedKeys: Set<string>; onOpen: (w: Word) => void }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const q = filter.trim();
  const tray = q
    ? chars.filter((c) => {
        const d = getCharData(c);
        return (
          c === jpForm(q) ||
          d?.sounds.some((r) => r.eum === q || r.hun === q) ||
          d?.on?.includes(toKatakana(q)) ||
          d?.kun?.some((k) => kunStem(k) === q)
        );
      })
    : chars;
  const found = findWordsByKanji(sequence);

  return (
    <section className={app.stack}>
      <p className={app.lead}>{t.find.buildLead}</p>
      <div className={styles.board}>
        <div className={styles.sequence} aria-live="polite">
          {sequence.length ? (
            <span className={`hanja ${styles.sequenceText}`} lang="ja">
              {sequence.join("")}
            </span>
          ) : (
            <span className={styles.sequenceEmpty}>{t.find.buildEmpty}</span>
          )}
        </div>
        <div className={styles.boardActions}>
          <button type="button" className={styles.small} disabled={!sequence.length} onClick={() => setSequence((s) => s.slice(0, -1))}>
            {t.find.undo}
          </button>
          <button type="button" className={styles.small} disabled={!sequence.length} onClick={() => setSequence([])}>
            {t.find.clear}
          </button>
        </div>
      </div>

      {sequence.length > 0 ? (
        found.length ? (
          <div className={app.stackSm}>
            <p className={styles.found}>{t.find.buildFound}</p>
            <ul className={app.plainList}>
              {found.map((w) => (
                <WordRow
                  key={wordKey(w)}
                  word={w}
                  meta={ownedKeys.has(wordKey(w)) ? t.sheet.owned : undefined}
                  onOpen={() => onOpen(w)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className={app.note}>{t.find.buildNone}</p>
        )
      ) : null}

      {chars.length > 16 ? (
        <input
          type="search"
          className={app.search}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.find.buildFilter}
          aria-label={t.find.buildFilter}
        />
      ) : null}
      <ul className={styles.tray}>
        {tray.map((c) => (
          <li key={c}>
            <button type="button" className={styles.trayChar} onClick={() => setSequence((s) => [...s, c].slice(0, 8))}>
              <span className="hanja" lang="ja">
                {c}
              </span>
              <span className={`${styles.trayRead} t-ko`}>{getCharData(c)?.sounds[0]?.eum}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
