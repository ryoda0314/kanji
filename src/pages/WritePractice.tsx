import { useMemo, useState } from "react";
import { wordKey } from "../data/combine";
import { t } from "../copy";
import type { CollectedWord } from "../db";
import { Icon } from "../components/Icon";
import app from "../app.module.css";
import styles from "./Review.module.css";
import { WriteCard } from "./TryWrite";

/** ひと回りで書く語の数。 */
const ROUND = 10;

/** 集めた語を混ぜて、ひと回りぶん。 */
function nextRound(words: CollectedWord[]): string[] {
  const keys = words.map(wordKey);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice(0, ROUND);
}

/**
 * 모은 단어 써 보기：集めた語を、ふりかえりどきを待たずに書く（言葉を聞いて、字の札を並べる）。
 * 覚え具合には数えない（ふりかえりの間隔はそのまま）。ひと回り10語、終わればもうひと回り。
 */
export function WritePractice({ words, onBack }: { words: CollectedWord[]; onBack: () => void }) {
  const [round, setRound] = useState(() => nextRound(words));
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const byKey = useMemo(() => new Map(words.map((w) => [wordKey(w), w])), [words]);
  const rest = round.filter((k) => !done.has(k) && byKey.has(k));
  const current = rest.length > 0 ? byKey.get(rest[0])! : null;

  return (
    <>
      <header className={app.subbar}>
        <button type="button" className={app.iconLink} onClick={onBack} aria-label={t.review.back}>
          <Icon name="back" size={22} />
        </button>
        <h1 className={`${app.subtitleStrong} ${app.withBack}`}>{t.write.practiceTitle}</h1>
        {current ? <span className={app.subCount}>{t.review.left(rest.length)}</span> : null}
      </header>
      <div className={app.bodyTight}>
        {current ? (
          <WriteCard
            key={`p${wordKey(current)}`}
            word={current}
            mode="practice"
            onNext={() => setDone((d) => new Set(d).add(wordKey(current)))}
          />
        ) : (
          <section className={styles.end}>
            <p className={styles.endTitle}>{t.write.practiceDone}</p>
            <div className={styles.endActions}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRound(nextRound(words));
                  setDone(new Set());
                }}
              >
                {t.write.practiceAgain}
              </button>
              <button type="button" className="btn-quiet" onClick={onBack}>
                {t.review.back}
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
