import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discoverWords, wordKey } from "../data/combine";
import { charMap, getCharData, joyoChars, jpForm } from "../data/dataset";
import { toKatakana } from "../data/kana";
import { isOnReading, kunLabel, soundParts } from "../data/sounds";
import type { KanjiData, WordData } from "../data/types";
import { t } from "../copy";
import type { CollectedChar } from "../db";
import { useChars, useSounds, useWords } from "../util/live";
import { CharCard, CharCell } from "../components/CharCard";
import { Icon } from "../components/Icon";
import { Sprout } from "../components/Sprout";
import { WordSheet } from "../components/WordSheet";
import { koreanOf } from "../components/WordRow";
import { compareKo } from "../util/korean";
import app from "../app.module.css";
import hs from "../components/hanja.module.css";
import { Build } from "./Build";
import styles from "./Hanja.module.css";

type View = "pairs" | "mine" | "joyo" | "build";
const VIEWS: View[] = ["pairs", "mine", "joyo", "build"];
type Sort = "count" | "recent" | "strokes";

const WEEK = 7 * 86_400_000;
const SEARCH_LIMIT = 60;

/** 字を、字そのもの・韓国で書く形・韓国語の音や訓・日本語の読み（音読みはひらがなでも）で探す。常用漢字を先に、画数の少ない順。 */
function searchChars(q: string): KanjiData[] {
  const kata = toKatakana(q);
  const jp = jpForm(q);
  const out: KanjiData[] = [];
  for (const c of charMap.values()) {
    if (
      c.char === jp ||
      c.ko === q ||
      c.sounds.some((r) => r.eum === q || r.hun === q) ||
      c.on?.includes(kata) ||
      c.kun?.some((k) => kunLabel(k).replace(/[()]/g, "") === q || kunLabel(k).startsWith(q + "("))
    )
      out.push(c);
  }
  return out
    .sort((a, b) => Number(Boolean(b.joyo)) - Number(Boolean(a.joyo)) || (a.strokes || 99) - (b.strokes || 99))
    .slice(0, SEARCH_LIMIT);
}

/** 漢字：集めた字のカード（根の深さつき）、常用漢字2136字の一覧、集めた字を並べて組み立てる。字・音・読みで探せる。 */
export default function Hanja() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "pairs";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("count");
  const chars = useChars();
  const words = useWords();
  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const [sheet, setSheet] = useState<Pick<WordData, "kanji" | "kana" | "gloss"> | null>(null);
  const sounds = useSounds(words);
  // 일본어로 말할 수 있는 한자어（集めた同じ漢字語と、集めた音だけで言える語）。
  const sayable = useMemo(
    () => (words ?? []).filter((w) => koreanOf(w)).length + (sounds.size ? discoverWords(sounds, ownedKeys, true).length : 0),
    [words, sounds, ownedKeys]
  );
  // 字ごとの、集めた語でのその字の読み（学 → がく）。
  const readingsByChar = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of sounds) {
      const { char, reading } = soundParts(s);
      m.set(char, [...(m.get(char) ?? []), reading]);
    }
    return m;
  }, [sounds]);
  const countByChar = useMemo(() => new Map((chars ?? []).map((c) => [c.char, c.count])), [chars]);
  const q = query.trim();
  const results = useMemo(() => (q ? searchChars(q) : []), [q]);

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.hanja.title}</h1>
        {chars?.length ? <span className={app.subCount}>{t.common.chars(chars.length)}</span> : null}
      </header>
      <div className={app.bodyTight}>
        <div className={app.tools}>
          <input
            type="search"
            className={app.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.hanja.search}
            aria-label={t.hanja.search}
          />
          {q ? null : (
            <nav className={app.views} aria-label={t.hanja.viewsLabel}>
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={app.view}
                  aria-pressed={view === v}
                  onClick={() => setParams(v === "pairs" ? {} : { view: v }, { replace: true })}
                >
                  {t.hanja.views[v]}
                </button>
              ))}
            </nav>
          )}
        </div>

        {q ? (
          results.length === 0 ? (
            <p className={app.empty}>{t.hanja.noMatch}</p>
          ) : (
            <ul className={hs.cards}>
              {results.map((c) => (
                <li key={c.char}>
                  <CharCard char={c.char} count={countByChar.get(c.char)} readings={readingsByChar.get(c.char)} />
                </li>
              ))}
            </ul>
          )
        ) : chars === undefined ? null : view === "pairs" ? (
          <Pairs sounds={sounds} sayable={sayable} />
        ) : view === "build" ? (
          <Build
            chars={[...chars].sort((a, b) => b.count - a.count).map((c) => c.char)}
            ownedKeys={ownedKeys}
            onOpen={setSheet}
          />
        ) : view === "joyo" ? (
          <Joyo countByChar={countByChar} />
        ) : chars.length === 0 ? (
          <div className={styles.empty}>
            <Sprout className={styles.sprout} />
            <p>{t.hanja.empty}</p>
            <Link to="/" className={app.quietAction}>
              <Icon name="collect" size={18} />
              {t.nav.collect}
            </Link>
          </div>
        ) : (
          <Mine chars={chars} readings={readingsByChar} sort={sort} onSort={setSort} />
        )}
      </div>
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** 集めた字：最近また出会った字、並べ替え、カード。 */
function Mine({
  chars,
  readings,
  sort,
  onSort,
}: {
  chars: CollectedChar[];
  readings: Map<string, string[]>;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const now = Date.now();
  const again = chars
    .filter((c) => c.count >= 2 && c.lastAddedAt > c.firstAddedAt && now - c.lastAddedAt < WEEK)
    .sort((a, b) => b.lastAddedAt - a.lastAddedAt)
    .slice(0, 10);
  const sorted = [...chars].sort((a, b) => {
    if (sort === "recent") return b.firstAddedAt - a.firstAddedAt;
    if (sort === "strokes")
      return (charMap.get(a.char)?.strokes || 99) - (charMap.get(b.char)?.strokes || 99) || b.count - a.count;
    return b.count - a.count || b.lastAddedAt - a.lastAddedAt;
  });

  return (
    <>
      {again.length > 0 ? (
        <section className={app.stackSm}>
          <h2 className="label">{t.hanja.again}</h2>
          <ul className={hs.again}>
            {again.map((c) => (
              <li key={c.char}>
                <Link to={`/hanja/${encodeURIComponent(c.char)}`} className={hs.againCard}>
                  <span className={`hanja ${hs.againGlyph}`} lang="ja">
                    {c.char}
                  </span>
                  <span className={hs.againWhen}>
                    {t.common.ago(c.lastAddedAt)} · {t.hanja.depth(c.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={app.stackSm}>
        <div className={app.filters} role="group" aria-label={t.hanja.sortLabel}>
          {(["count", "recent", "strokes"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={s === sort ? `${app.filter} ${app.filterOn}` : app.filter}
              aria-pressed={s === sort}
              onClick={() => onSort(s)}
            >
              {t.hanja.sorts[s]}
            </button>
          ))}
        </div>
        <ul className={hs.cards}>
          {sorted.map((c) => (
            <li key={c.char}>
              <CharCard char={c.char} count={c.count} readings={readings.get(c.char)} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** 常用漢字2136字を、日本の学年ごとに（小学校1〜6年、中学校以上）。それぞれ韓国語の音の가나다順。集めた字は濃く。 */
function Joyo({ countByChar }: { countByChar: Map<string, number> }) {
  const groups = useMemo(() => {
    const map = new Map<number, KanjiData[]>();
    for (const c of joyoChars()) {
      const g = c.grade && c.grade <= 6 ? c.grade : 8;
      (map.get(g) ?? map.set(g, []).get(g)!).push(c);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([grade, list]) => ({
        grade,
        list: list.sort(
          (a, b) => compareKo(a.sounds[0]?.eum ?? "힣", b.sounds[0]?.eum ?? "힣") || (a.strokes || 99) - (b.strokes || 99)
        ),
      }));
  }, []);
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  const have = groups.reduce((n, g) => n + g.list.filter((c) => countByChar.has(c.char)).length, 0);

  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.hanja.joyoLead}</p>
      <div className={styles.progress}>
        <span className={styles.progressText}>{t.hanja.joyoCount(have)}</span>
        <span className={styles.bar} aria-hidden="true">
          <span style={{ width: `${(have / Math.max(total, 1)) * 100}%` }} />
        </span>
      </div>
      {groups.map((g) => (
        <section key={g.grade}>
          <h2 className={app.groupHead}>
            <span className={styles.lead}>{t.hanja.grade(g.grade)}</span>
            <small>{t.hanja.groupCount(g.list.filter((c) => countByChar.has(c.char)).length, g.list.length)}</small>
          </h2>
          <ul className={`${hs.cells} ${styles.cells}`}>
            {g.list.map((c) => (
              <li key={c.char}>
                <CharCell char={c.char} owned={countByChar.has(c.char)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** 韓国語の音の終声（받침）。학 → ㄱ、하 → none。ハングルの音節でなければ other。 */
function finalOf(eum: string): string {
  const code = (eum.codePointAt(0) ?? 0) - 0xac00;
  if (code < 0 || code > 11171) return "other";
  return ({ 0: "none", 1: "ㄱ", 4: "ㄴ", 8: "ㄹ", 16: "ㅁ", 17: "ㅂ", 21: "ㅇ" } as Record<number, string>)[code % 28] ?? "other";
}

const FINALS = ["none", "ㄱ", "ㄴ", "ㄹ", "ㅁ", "ㅂ", "ㅇ", "other"];

/**
 * 소리 짝：集めた字の音（音読み）を、韓国語の音の終声（받침）ごとに並べる（학 → がく・국 → こく・일 → いち …）。
 * 規則は書かない。並べると、ㄱ のあとは く・き、ㄹ は つ・ち、ㅇ は う・い、ㄴ・ㅁ は ん …が自分で見えてくる。
 * 訓読み（메 · やま）は音の対応ではないので、最後に別に。押すとその字のページへ。
 */
function Pairs({ sounds, sayable }: { sounds: Set<string>; sayable: number }) {
  const rows = useMemo(
    () =>
      [...sounds]
        .map(soundParts)
        .map(({ char, reading }) => {
          const k = getCharData(char)?.sounds[0];
          return { char, reading, eum: k?.eum ?? "", hun: k?.hun, on: isOnReading(char, reading) };
        })
        .sort((a, b) => a.eum.localeCompare(b.eum, "ko") || a.reading.localeCompare(b.reading, "ja")),
    [sounds]
  );
  if (rows.length === 0) return <p className={app.lead}>{t.hanja.pairsEmpty}</p>;
  const groups = FINALS.map((f) => ({ f, list: rows.filter((r) => r.on && r.eum && finalOf(r.eum) === f) })).filter((g) => g.list.length);
  const kun = rows.filter((r) => !r.on || !r.eum);
  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.hanja.pairsLead}</p>
      <p className={styles.pairsCount}>{t.hanja.pairsCount(sounds.size, sayable)}</p>
      {groups.map((g) => (
        <section key={g.f}>
          <h2 className={app.groupHead}>
            <span className={styles.lead}>{t.hanja.finals[g.f]}</span>
            <small>{g.list.length}</small>
          </h2>
          <ul className={styles.pairs}>
            {g.list.map((r) => (
              <li key={`${r.char}|${r.reading}`}>
                <Link to={`/hanja/${encodeURIComponent(r.char)}`} className={styles.pair}>
                  <span className="t-ko" lang="ko">
                    {r.eum}
                  </span>
                  <span className={styles.pairArrow} aria-hidden="true">
                    →
                  </span>
                  <span className={`t-ja ${styles.pairJa}`} lang="ja">
                    {r.reading}
                  </span>
                  <span className={`hanja ${styles.pairChar}`} lang="ja">
                    {r.char}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {kun.length ? (
        <section>
          <h2 className={app.groupHead}>
            <span className={styles.lead}>{t.hanja.pairsKun}</span>
            <small>{kun.length}</small>
          </h2>
          <ul className={styles.pairs}>
            {kun.map((r) => (
              <li key={`${r.char}|${r.reading}`}>
                <Link to={`/hanja/${encodeURIComponent(r.char)}`} className={styles.pair}>
                  <span className="t-ko" lang="ko">
                    {r.hun ?? r.eum}
                  </span>
                  <span className={styles.pairArrow} aria-hidden="true">
                    ·
                  </span>
                  <span className={`t-ja ${styles.pairJa}`} lang="ja">
                    {r.reading}
                  </span>
                  <span className={`hanja ${styles.pairChar}`} lang="ja">
                    {r.char}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
