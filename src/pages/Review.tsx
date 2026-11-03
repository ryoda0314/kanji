import { useMemo, useState } from "react";
import { wordKey } from "../data/combine";
import { dueWords, wordStage } from "../data/stage";
import { t } from "../copy";
import type { CollectedWord } from "../db";
import { Icon } from "../components/Icon";
import { daysUntilReview, StageGauge } from "../components/Stage";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Review.module.css";
import { usePref } from "../util/local";
import { ReadCard } from "./TryRead";
import { WriteCard } from "./TryWrite";

/** ひと回りで出す語の数。多いと重くなるので区切り、終わればもうひと回りできる。 */
export const ROUND = 10;

function nextRound(words: CollectedWord[]) {
  return { keys: dueWords(words, Date.now()).slice(0, ROUND).map(wordKey), startedAt: Date.now() };
}

/**
 * ふりかえる：ふりかえりどきの語を、読んでみる と同じカードで一語ずつ。漢字を見て、字の音をつなげてハングルで打つ。
 * 始めたときの順のまま進む（途中で覚え具合が変わっても並べ替えない）。点数は出さず、終わったら語ごとの覚え具合だけ。
 */
export function Review({ words, onBack }: { words: CollectedWord[]; onBack: () => void }) {
  const [round, setRound] = useState(() => nextRound(words));
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 복습の向き：읽기（字を見て読みを打つ）・쓰기（言葉を聞いて字の札を並べる）。
  const [write, setWrite] = usePref("reviewWrite", false);
  // 말하기 で、한글（韓国語の語と字の下の音）を隠して漢字だけ見せるか。
  const [hideKorean, setHideKorean] = usePref("reviewHideKorean", false);
  const byKey = useMemo(() => new Map(words.map((w) => [wordKey(w), w])), [words]);
  // 途中で外した語は飛ばす。
  const rest = round.keys.filter((k) => !done.has(k) && byKey.has(k));
  const current = rest.length > 0 ? byKey.get(rest[0])! : null;
  const more = current ? 0 : dueWords(words, Date.now()).length;
  // このひと回りで読んだか答えを見た語（あとで にした語は入れない）。
  const reviewed = round.keys
    .map((k) => byKey.get(k))
    .filter((w): w is CollectedWord => !!w && Math.max(w.lastReadAt ?? 0, w.missedAt ?? 0) >= round.startedAt);
  const open = openKey ? (byKey.get(openKey) ?? null) : null;

  return (
    <>
      <header className={app.subbar}>
        <button type="button" className={app.iconLink} onClick={onBack} aria-label={t.review.back}>
          <Icon name="back" size={22} />
        </button>
        <h1 className={`${app.subtitleStrong} ${app.withBack}`}>{t.review.title}</h1>
        {current ? <span className={app.subCount}>{t.review.left(rest.length)}</span> : null}
      </header>
      <div className={app.bodyTight}>
        {current ? (
          <>
            <div className={`${app.views} ${styles.modes}`} role="group" aria-label={t.review.modesLabel}>
              {([false, true] as const).map((w) => (
                <button key={String(w)} type="button" className={app.view} aria-pressed={write === w} onClick={() => setWrite(w)}>
                  {w ? t.review.modes.write : t.review.modes.read}
                </button>
              ))}
            </div>
            {write ? null : (
              <label className={styles.toggle}>
                <input type="checkbox" checked={hideKorean} onChange={(e) => setHideKorean(e.target.checked)} />
                {t.review.hideKorean}
              </label>
            )}
            {write ? (
              <WriteCard
                key={`w${wordKey(current)}`}
                word={current}
                mode="review"
                onNext={() => setDone((d) => new Set(d).add(wordKey(current)))}
              />
            ) : (
              <ReadCard
                key={wordKey(current)}
                word={current}
                mode="review"
                focus
                hideKorean={hideKorean}
                onNext={() => setDone((d) => new Set(d).add(wordKey(current)))}
              />
            )}
          </>
        ) : (
          <section className={styles.end}>
            <p className={styles.endTitle}>
              {round.keys.length === 0 ? t.review.none : more > 0 ? t.review.roundDone : t.review.done}
            </p>
            {round.keys.length > 0 && more > 0 ? <p className={app.note}>{t.review.more(more)}</p> : null}
            <div className={styles.endActions}>
              {more > 0 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setRound(nextRound(words));
                    setDone(new Set());
                  }}
                >
                  {t.review.again}
                </button>
              ) : null}
              <button type="button" className={more > 0 ? "btn-quiet" : "btn"} onClick={onBack} autoFocus={more === 0}>
                {t.review.back}
              </button>
            </div>
            {reviewed.length > 0 ? (
              <section className={styles.reviewed}>
                <h2 className="label">{t.review.reviewed}</h2>
                <ul className={app.plainList}>
                  {reviewed.map((w) => (
                    <WordRow
                      key={w.id}
                      word={w}
                      meta={
                        <span className={app.metaRow}>
                          <StageGauge stage={wordStage(w)} />
                          <span>{t.stage.dueIn(Math.max(1, daysUntilReview(w, Date.now())))}</span>
                        </span>
                      }
                      onOpen={() => setOpenKey(wordKey(w))}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        )}
      </div>
      {open ? <WordSheet key={openKey} word={open} onClose={() => setOpenKey(null)} /> : null}
    </>
  );
}
