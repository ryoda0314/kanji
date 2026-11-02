import { DAY, nextReviewAt, STAGES, wordStage, type Stage, type WordProgress } from "../data/stage";
import { t } from "../copy";
import styles from "./Stage.module.css";

/** 覚え具合の小さな目盛り：段階が進むごとに雨粒が一つ増える（ことのあめ の メモと同じ形）。 */
export function StageGauge({ stage }: { stage: Stage }) {
  const level = STAGES.indexOf(stage);
  return (
    <span className={styles.gauge} data-stage={stage}>
      <span className={styles.drops} aria-hidden="true">
        {STAGES.map((s, k) => (
          <i key={s} data-on={k <= level || undefined} />
        ))}
      </span>
      {t.stage.names[stage]}
    </span>
  );
}

/** 次のふりかえりまでの日数（今日なら 0 以下）。 */
export function daysUntilReview(w: WordProgress, now: number): number {
  return Math.ceil((nextReviewAt(w) - now) / DAY);
}

/**
 * 一つの語の覚え具合：4つの段階のどこにいて、何をすると次に進むか、次にふりかえるのはいつか。
 * 点数ではなく、道のり。
 */
export function StageTrack({ word, now }: { word: WordProgress; now: number }) {
  const stage = wordStage(word);
  const level = STAGES.indexOf(stage);
  const days = daysUntilReview(word, now);
  return (
    <section className={styles.box}>
      <div className={styles.track} aria-label={t.stage.label}>
        {STAGES.map((s, k) => (
          <span
            key={s}
            className={[styles.step, k <= level ? styles.stepOn : "", k === level ? styles.stepNow : ""].filter(Boolean).join(" ")}
            aria-current={k === level ? "step" : undefined}
          >
            <i aria-hidden="true" />
            {t.stage.names[s]}
          </span>
        ))}
      </div>
      <p className={styles.hint}>{t.stage.next[stage]}</p>
      <p className={styles.facts}>
        <span className={days <= 0 ? styles.due : undefined}>{days <= 0 ? t.stage.due : t.stage.dueIn(days)}</span>
        {word.metDays ? <span>{t.stage.met(word.metDays)}</span> : null}
        {word.readDays ? <span>{t.stage.read(word.readDays)}</span> : null}
      </p>
    </section>
  );
}
