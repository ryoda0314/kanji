import { useEffect, useRef, useState } from "react";
import { glossLang, glossText } from "../data/gloss";
import { markStatus, type MarkStatus } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { readFalls, shareAllowed, type Fall } from "../util/falls";
import app from "../app.module.css";
import styles from "./Everyone.module.css";
import { EveryonePile } from "./EveryonePile";

/** 新しく降った分を読みに行く間（ミリ秒）。 */
const POLL = 8000;
/** 一つずつ降らせる間。待っている語が多いときは速く。 */
const DROP = 1400;
/** 開いたときに降らせる、この1時間の分。 */
const FIRST = 24;
/** 積もったまま見せる数。 */
const KEEP = 30;

const keyOf = (w: Pick<WordData, "kanji" | "kana">) => `${w.kanji}|${w.kana}`;

type Look = "list" | "pile";
const LOOKS: Look[] = ["list", "pile"];

interface Props {
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: WordData) => void;
}

/**
 * みんなの雨（util/falls）：この1時間に、みんなが集めた語が降ってくる。見え方は二つで、開くといつも 一覧
 * （語と意味を一行ずつ。学ぶには読みやすい）。積もる雨（EveryonePile：語が雨になって降り、下に積もって山になる）にも切り替えられる。
 */
export function Everyone(props: Props) {
  const [look, setLook] = useState<Look>("list");
  return (
    <section className={styles.wrap}>
      <p className={app.lead}>{look === "list" ? t.everyone.lead : t.everyone.pileLead}</p>
      <div className={styles.looks} role="radiogroup" aria-label={t.everyone.lookLabel}>
        {LOOKS.map((l) => (
          <label key={l} className={styles.look}>
            <input type="radio" name="everyone-look" checked={look === l} onChange={() => setLook(l)} />
            {t.everyone.looks[l]}
          </label>
        ))}
      </div>
      {look === "list" ? <RainList {...props} /> : <EveryonePile {...props} />}
      <p className={app.note}>{shareAllowed() ? t.everyone.yours : t.everyone.yoursOff}</p>
    </section>
  );
}

/**
 * 一覧：みんなが集めた語が一つずつ降ってきて、上に積もる。開いたときはこの1時間の分から、そのあとは新しく集められた語が
 * 届きしだい降る。押すとその語が開く。集めていない語は、ほかと同じく漢字を ？？ で伏せる。
 */
function RainList({ sounds, owned, onOpen }: Props) {
  // undefined：読んでいる、null：読めない
  const [total, setTotal] = useState<number | null | undefined>(undefined);
  const [shown, setShown] = useState<Fall[]>([]);
  const waiting = useRef<Fall[]>([]);
  const last = useRef(0);

  useEffect(() => {
    let active = true;
    async function read(first: boolean) {
      const result = await readFalls(last.current);
      if (!active) return;
      if (!result) {
        if (first) setTotal(null);
        return;
      }
      setTotal(result.total);
      if (!result.falls.length) return;
      last.current = Math.max(last.current, ...result.falls.map((f) => f.id));
      // 新しい順で届くので、古い順にして待たせる（いちばん新しい語が最後に降って、いちばん上に来る）。
      waiting.current.push(...(first ? result.falls.slice(0, FIRST) : result.falls).reverse());
    }
    void read(true);
    const timer = window.setInterval(() => void read(false), POLL);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    const drop = () => {
      const next = waiting.current.shift();
      if (next) setShown((list) => [next, ...list.filter((f) => keyOf(f.word) !== keyOf(next.word))].slice(0, KEEP));
      timer = window.setTimeout(drop, waiting.current.length > 8 ? DROP / 3 : DROP);
    };
    timer = window.setTimeout(drop, 300);
    return () => window.clearTimeout(timer);
  }, []);

  if (total === undefined) return <p className={app.note}>{t.everyone.loading}</p>;
  if (total === null) return <p className={app.error}>{t.everyone.failed}</p>;
  return (
    <>
      <p className={styles.count}>
        {t.everyone.totalBefore}
        <b>{total}</b>단어
      </p>
      {total === 0 ? <p className={app.note}>{t.everyone.quiet}</p> : null}
      {shown.length ? (
        <ol className={styles.list} aria-live="polite">
          {shown.map((f) => (
            <Drop key={f.id} fall={f} status={markStatus(f.word, sounds, owned)} onOpen={() => onOpen(f.word)} />
          ))}
        </ol>
      ) : null}
    </>
  );
}

/** 降ってきた語の一行：雨粒の印、表記、読み（集めた字の音で読める語は伏せる）、意味、いつ。 */
function Drop({ fall, status, onOpen }: { fall: Fall; status: MarkStatus; onOpen: () => void }) {
  const w = fall.word;
  const gloss = glossText(w);
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={`${styles.drop} ${styles[status]}`} aria-hidden="true" />
        <span className={styles.main}>
          <span className={styles.line}>
            <span className={`${styles.hangul} hanja`} lang="ja">
              {w.kanji}
            </span>
            {status === "readable" ? null : (
              <span className={`${styles.hanja} t-ja`} lang="ja">
                {w.kana}
              </span>
            )}
          </span>
          {gloss ? (
            <span className={styles.gloss} lang={glossLang(w)}>
              {gloss}
            </span>
          ) : null}
        </span>
        <span className={styles.when}>{t.everyone.ago(fall.at)}</span>
      </button>
    </li>
  );
}
