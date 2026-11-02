import { useEffect, useMemo, useState } from "react";
import { markStatus, pickRain, wordOf, type MarkStatus, type Sentence, type SentenceData } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { recordMet } from "../db";
import { GlossText, MarkLegend, SentenceView } from "../components/SentenceView";
import { SpeakButton } from "../components/SpeakButton";
import { addSeen, readSeen, usePref } from "../util/local";
import app from "../app.module.css";
import styles from "./Meet.module.css";

type Word = Pick<WordData, "kanji" | "kana" | "gloss">;

const SEEN = "seenSentences";

/**
 * 文で出会う：姉妹アプリ ことのあめ の例文の日本語訳が、ひと雨4文ずつ降ってくる。集めた字の入った文ほど降りやすい。
 * 文の中の漢字の語は、集めた語（また出会った）・集めた字の音で読める語・まだの語で印が変わり、押すとその語が開く。
 * 自分から語を持ってこなくても、自分の根が文の中で見つかる。ふりかえりどきの集めた語（due）の入った文は降りやすい。
 */
export function Meet({
  data,
  sounds,
  owned,
  due,
  onOpen,
}: {
  data: SentenceData;
  sounds: Set<string>;
  owned: Set<string>;
  due: ReadonlySet<string>;
  onOpen: (w: Word) => void;
}) {
  const [showFurigana, setShowFurigana] = usePref("meetFurigana", true);
  const [hideGloss, setHideGloss] = usePref("meetHideGloss", false);
  const [round, setRound] = useState(0);
  const [rain, setRain] = useState<Sentence[]>(() => pickRain(data.list, sounds, owned, readSeen(SEEN), { due }));

  // 降った文は覚えておき、次の雨では別の文を。集めた語が入っていれば、また出会った（一日一度だけ数える）。
  useEffect(() => {
    addSeen(SEEN, rain.map((s) => s.id));
    void recordMet(rain.flatMap((s) => s.marks).filter((m) => owned.has(`${m.kanji}|${m.kana}`)));
  }, [rain]);

  function next() {
    setRain(pickRain(data.list, sounds, owned, readSeen(SEEN), { due }));
    setRound((r) => r + 1);
    window.scrollTo({ top: 0 });
  }

  // この雨で出会った語を、集めた語・読めそうな語・はじめての語に分ける（同じ語は一度）。
  const met = useMemo(() => {
    const groups: Record<MarkStatus, { key: string; kanji: string; kana: string }[]> = { owned: [], readable: [], new: [] };
    const seen = new Set<string>();
    for (const s of rain) {
      for (const m of s.marks) {
        const key = `${m.kanji}|${m.kana}`;
        if (seen.has(key)) continue;
        seen.add(key);
        groups[markStatus(m, sounds, owned)].push({ key, kanji: m.kanji, kana: m.kana });
      }
    }
    return groups;
  }, [rain, sounds, owned]);

  return (
    <section className={styles.wrap}>
      <p className={app.lead}>{sounds.size ? t.meet.lead : t.meet.leadFirst}</p>
      <div className={styles.toolbar}>
        <MarkLegend labels={t.meet.legend} />
        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={showFurigana} onChange={(e) => setShowFurigana(e.target.checked)} />
            {t.meet.showFurigana}
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={hideGloss} onChange={(e) => setHideGloss(e.target.checked)} />
            {t.meet.hideGloss}
          </label>
        </div>
      </div>

      <ol key={round} className={styles.list} aria-live="polite">
        {rain.map((s, i) => (
          <li key={s.id} className={styles.item} style={{ animationDelay: `${i * 0.35}s` }}>
            <span className={styles.drop} style={{ animationDelay: `${i * 0.35 + 0.25}s` }} aria-hidden="true" />
            <div className={styles.itemMain}>
              <SentenceView sentence={s} sounds={sounds} owned={owned} showFurigana={showFurigana} onWord={(m) => onOpen(wordOf(m))} />
              {hideGloss ? null : (
                <span className={styles.gloss}>
                  <GlossText ko={s.ko} />
                </span>
              )}
            </div>
            <SpeakButton text={s.ja} />
          </li>
        ))}
      </ol>

      <section className={styles.met}>
        <h2 className="label">{t.meet.met}</h2>
        {(["owned", "readable", "new"] as const).map((status) =>
          met[status].length ? (
            <div key={status} className={styles.group}>
              <span className={`${styles.groupName} ${styles[status]}`}>
                {t.meet.groups[status]} {met[status].length}
              </span>
              <div className={styles.chips}>
                {met[status].map((w) => (
                  <button key={w.key} type="button" className={`${styles.chip} ${styles[status]}`} onClick={() => onOpen(wordOf(w))}>
                    <span className="hanja" lang="ja">
                      {w.kanji}
                    </span>
                    {status === "readable" ? null : (
                      <span className={`${styles.chipHanja} t-ja`} lang="ja">
                        {w.kana}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        )}
      </section>

      <button type="button" className="btn" onClick={next}>
        {t.meet.next}
      </button>
    </section>
  );
}
