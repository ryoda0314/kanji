import { Link } from "react-router-dom";
import { getCharData, koGlyph } from "../data/dataset";
import { toHiragana } from "../data/kana";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/** 根の深さ：その字が入った集めた語の数を、雨粒の目盛りで（1・2・3〜4・5語以上）。 */
export function Gauge({ count }: { count: number }) {
  const level = count >= 5 ? 4 : count >= 3 ? 3 : count;
  return (
    <span className={styles.gauge}>
      <span className={styles.drops} aria-hidden="true">
        {[1, 2, 3, 4].map((k) => (
          <i key={k} data-on={k <= level || undefined} />
        ))}
      </span>
      {t.hanja.depth(count)}
    </span>
  );
}

/**
 * 字のカード：明朝の字、韓国語の音と日本語の読み、根の深さ。集めていない字は薄く。
 * readings（集めた語でのこの字の読み）があればそれを、無ければいちばんよく使う音読み。
 */
export function CharCard({ char, count, readings }: { char: string; count?: number; readings?: string[] }) {
  const { script } = usePrefs();
  const d = getCharData(char);
  const ko = koGlyph(char, script);
  const owned = count != null && count > 0;
  const ja = readings?.length ? readings.join("·") : d?.on?.[0] ? toHiragana(d.on[0]) : "";
  return (
    <Link to={`/hanja/${encodeURIComponent(char)}`} className={owned ? styles.card : `${styles.card} ${styles.cardOff}`}>
      {ko ? (
        <span className={`hanja-ko ${styles.cardJp}`} lang="ko">
          {ko}
        </span>
      ) : null}
      <span className={`hanja ${styles.cardGlyph}`} lang="ja">
        {char}
      </span>
      <span className={styles.cardRead}>
        <span className="t-ko" lang="ko">
          {d?.sounds[0]?.eum ?? ""}
        </span>
        {ja ? (
          <span className={`${styles.cardOn} t-ja`} lang="ja">
            {ja}
          </span>
        ) : null}
      </span>
      {owned ? <Gauge count={count} /> : <span className={styles.cardNot}>{t.hanja.notYet}</span>}
    </Link>
  );
}

/** 常用漢字の一覧の小さな升：集めた字は濃く、まだの字は薄く。 */
export function CharCell({ char, owned }: { char: string; owned: boolean }) {
  const d = getCharData(char);
  return (
    <Link
      to={`/hanja/${encodeURIComponent(char)}`}
      className={owned ? `${styles.cell} ${styles.cellOn}` : styles.cell}
      aria-label={`${char} ${d?.sounds[0]?.eum ?? ""}`}
    >
      <span className={`hanja ${styles.cellGlyph}`} lang="ja">
        {char}
      </span>
      <span className={`${styles.cellRead} t-ko`}>{d?.sounds[0]?.eum ?? ""}</span>
    </Link>
  );
}
