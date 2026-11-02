import { rubyParts } from "../data/reading";
import { markStatus, segments, wordOf, type Sentence, type SentenceData, type SentenceMark } from "../data/sentences";
import { t } from "../copy";
import { usePref } from "../util/local";
import { SpeakButton } from "./SpeakButton";
import styles from "./SentenceView.module.css";

/**
 * 例文の日本語。漢字の語には印を付けて押せるようにする：集めた語は紫の点線（また出会った）、集めた字の音で読める語は
 * アクセントの線、まだの語は細い線。showFurigana なら字の上にふりがなを添える。ただし 集めた字の音で読める語は
 * ？ で伏せる（自分で読める語なので、押して読んでみる）。target の語は地の色で示す。
 */
export function SentenceView({
  sentence,
  sounds,
  owned,
  showFurigana,
  target,
  onWord,
}: {
  sentence: Pick<Sentence, "ja" | "marks"> & Partial<Pick<Sentence, "rubies">>;
  sounds: Set<string>;
  owned: Set<string>;
  showFurigana: boolean;
  /** 強めて見せる語（表記|読み）。 */
  target?: string;
  onWord: (m: SentenceMark) => void;
}) {
  return (
    <span className={`t-ja ${styles.ko}`} lang="ja">
      {segments(sentence).map((p, i) => {
        // 漢字語でない漢字の語：ふりがなだけ（押せない・印を付けない）。
        if ("ruby" in p) {
          return showFurigana ? (
            <span key={i}>
              {rubyParts(wordOf(p.ruby), p.text).map((part, k) =>
                part.rt ? (
                  <ruby key={k}>
                    {part.text}
                    <rt>{part.rt}</rt>
                  </ruby>
                ) : (
                  <span key={k}>{part.text}</span>
                )
              )}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          );
        }
        if (!("mark" in p)) return <span key={i}>{p.text}</span>;
        const m = p.mark;
        const status = markStatus(m, sounds, owned);
        const isTarget = target === `${m.kanji}|${m.kana}`;
        const className = [styles.mark, styles[status], isTarget ? styles.target : ""].filter(Boolean).join(" ");
        const masked = status === "readable";
        return (
          <button
            key={i}
            type="button"
            className={className}
            onClick={() => onWord(m)}
            aria-label={masked ? `${p.text}（${t.sheet.maskedLabel}）` : `${p.text} ${m.kana}`}
          >
            {showFurigana
              ? rubyParts(wordOf(m), p.text).map((part, k) =>
                  part.rt ? (
                    <ruby key={k}>
                      {part.text}
                      <rt className={masked ? styles.rtMasked : undefined}>{masked ? "？".repeat(Array.from(part.text).length) : part.rt}</rt>
                    </ruby>
                  ) : (
                    <span key={k}>{part.text}</span>
                  )
                )
              : p.text}
          </button>
        );
      })}
    </span>
  );
}

/** 韓国語訳。 */
export function GlossText({ ko }: { ko: string }) {
  return (
    <span className="t-ko" lang="ko">
      {ko}
    </span>
  );
}

/** 印の見方（文で出会う の上に小さく）。 */
export function MarkLegend({ labels }: { labels: { owned: string; readable: string; new: string } }) {
  return (
    <span className={styles.legend}>
      {(["owned", "readable", "new"] as const).map((s) => (
        <span key={s} className={styles.legendItem}>
          <span className={`${styles.mark} ${styles[s]} ${styles.sample}`} aria-hidden="true" lang="ja">
            漢字
          </span>
          {labels[s]}
        </span>
      ))}
    </span>
  );
}

/**
 * 例文を何文か、訳と読み上げつきで並べる（語のシート・字のページ）。印の語を押すとその語が開く。
 * target の語は地の色で示す。
 */
export function SentenceRows({
  data,
  ids,
  sounds,
  owned,
  target,
  onWord,
}: {
  data: SentenceData;
  ids: number[];
  sounds: Set<string>;
  owned: Set<string>;
  target?: { kanji: string; kana: string };
  onWord: (m: SentenceMark) => void;
}) {
  const [showFurigana] = usePref("meetFurigana", true);
  return (
    <ul className={styles.rows}>
      {ids.map((id) => {
        const s = data.list[id];
        return (
          <li key={id} className={styles.row}>
            <div className={styles.rowMain}>
              <SentenceView
                sentence={s}
                sounds={sounds}
                owned={owned}
                showFurigana={showFurigana}
                target={target ? `${target.kanji}|${target.kana}` : undefined}
                onWord={onWord}
              />
              <span className={styles.rowGloss}>
                <GlossText ko={s.ko} />
              </span>
            </div>
            <SpeakButton text={s.ja} />
          </li>
        );
      })}
    </ul>
  );
}
