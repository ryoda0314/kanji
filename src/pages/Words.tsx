import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { wordKey } from "../data/combine";
import { jpForm, koForm, splitKanji } from "../data/dataset";
import { normalizeReading } from "../data/kana";
import { dueWords, STAGES, wordStage, type Stage } from "../data/stage";
import { t } from "../copy";
import type { CollectedWord } from "../db";
import { useWords } from "../util/live";
import { Icon } from "../components/Icon";
import { Sprout } from "../components/Sprout";
import { StageGauge } from "../components/Stage";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Words.module.css";
import { Review, ROUND } from "./Review";
import { WritePractice } from "./WritePractice";

type SortMode = "recent" | "alpha";
type LenFilter = "1" | "2" | "3+";

/** 五十音の行（あ か さ … わ）。にごった音は同じ行に。 */
const ROWS = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];
const ROW_STARTS = "あかさたなはまやらわ";
function rowOf(kana: string): string {
  const first = normalizeReading(kana).normalize("NFD")[0] ?? "";
  for (let i = ROW_STARTS.length - 1; i >= 0; i--) if (first >= ROW_STARTS[i]) return ROWS[i];
  return "#";
}

/** 読みの行（あ か さ …）でまとめ、それぞれをあいうえお順に。 */
function byRow(words: CollectedWord[]) {
  const map = new Map<string, CollectedWord[]>();
  for (const w of words) {
    const k = rowOf(w.kana);
    (map.get(k) ?? map.set(k, []).get(k)!).push(w);
  }
  return [...map.entries()]
    .sort((a, b) => ROWS.indexOf(a[0]) - ROWS.indexOf(b[0]))
    .map(([key, ws]) => ({ key, words: ws.sort((x, y) => normalizeReading(x.kana).localeCompare(normalizeReading(y.kana), "ja")) }));
}

/**
 * ことば：集めた語と、それぞれの覚え具合。探す・覚え具合や字数で絞る・新しい順かあいうえお順。押すと語が開く。
 * ふりかえりどきの語があれば上に出し、そこから ふりかえる（?view=review）。
 */
export default function Words() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [len, setLen] = useState<LenFilter | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const words = useWords();
  const all = words ?? [];
  const q = query.trim();

  const stages = useMemo(() => new Map(all.map((w) => [w.id, wordStage(w)])), [all]);
  const stageCounts = useMemo(() => {
    const c: Record<Stage, number> = { collected: 0, met: 0, read: 0, known: 0 };
    for (const s of stages.values()) c[s]++;
    return c;
  }, [stages]);
  const due = useMemo(() => dueWords(all, Date.now()).length, [all]);

  const lengthOf = (w: CollectedWord) => splitKanji(w.kanji).length;
  const lengthCounts = useMemo(() => {
    const c = { "1": 0, "2": 0, "3+": 0 };
    for (const w of all) {
      const n = lengthOf(w);
      if (n === 1) c["1"]++;
      else if (n === 2) c["2"]++;
      else if (n >= 3) c["3+"]++;
    }
    return c;
  }, [all]);

  const filtered = all.filter((w) => {
    if (
      q &&
      !(
        w.kanji.includes(jpForm(q)) ||
        koForm(w.kanji).includes(q) ||
        normalizeReading(w.kana).includes(normalizeReading(q)) ||
        w.gloss.toLowerCase().includes(q.toLowerCase())
      )
    )
      return false;
    if (stage !== "all" && stages.get(w.id) !== stage) return false;
    const n = lengthOf(w);
    if (len === "1" && n !== 1) return false;
    if (len === "2" && n !== 2) return false;
    if (len === "3+" && n < 3) return false;
    return true;
  });

  // あいうえお順のときは読みの行でまとめる。新しい順は一続き（addedAt の降順のまま）。
  const groups = sort === "recent" ? [{ key: "", words: filtered }] : byRow(filtered);

  const open = all.find((w) => wordKey(w) === openKey) ?? null;

  function startReview() {
    setParams({ view: "review" });
    window.scrollTo({ top: 0 });
  }

  function startWrite() {
    setParams({ view: "write" });
    window.scrollTo({ top: 0 });
  }

  function endReview() {
    // 一覧から来たなら戻る。直に開いたときは一覧に置き換える。
    if (location.key !== "default") navigate(-1);
    else setParams({}, { replace: true });
  }

  if (params.get("view") === "review" && words !== undefined) return <Review words={words} onBack={endReview} />;
  if (params.get("view") === "write" && words !== undefined && words.length > 0) return <WritePractice words={words} onBack={endReview} />;

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.words.title}</h1>
        {all.length ? <span className={app.subCount}>{t.common.words(all.length)}</span> : null}
      </header>
      <div className={app.bodyTight}>
        {words === undefined ? null : all.length === 0 ? (
          <div className={styles.empty}>
            <Sprout className={styles.sprout} />
            <p>{t.words.empty}</p>
            <Link to="/" className={app.quietAction}>
              <Icon name="collect" size={18} />
              {t.nav.collect}
            </Link>
          </div>
        ) : (
          <>
            {due > 0 ? (
              <section className={`${app.panel} ${styles.due}`} aria-labelledby="due-title">
                <h2 id="due-title" className={styles.dueTitle}>
                  {t.review.panel(due)}
                </h2>
                <p className={app.note}>{t.review.panelLead(ROUND)}</p>
                <button type="button" className={`btn ${styles.dueStart}`} onClick={startReview}>
                  {t.review.start}
                  <Icon name="arrow" size={18} />
                </button>
              </section>
            ) : null}
            <section className={`${app.panel} ${styles.due}`} aria-labelledby="write-title">
              <h2 id="write-title" className={styles.dueTitle}>
                {t.write.practiceTitle}
              </h2>
              <p className={app.note}>{t.write.practicePanel}</p>
              <button type="button" className={`btn-quiet ${styles.dueStart}`} onClick={startWrite}>
                {t.write.practiceStart}
                <Icon name="arrow" size={18} />
              </button>
            </section>

            <section>
              <div className={app.tools}>
                {all.length > 8 ? (
                  <input
                    type="search"
                    className={app.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.words.search}
                    aria-label={t.words.search}
                  />
                ) : null}
                <div className={app.filters} role="group" aria-label={t.stage.label}>
                  {(["all", ...STAGES] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={s === stage ? `${app.filter} ${app.filterOn}` : app.filter}
                      aria-pressed={s === stage}
                      onClick={() => setStage(s)}
                    >
                      {s === "all" ? t.stage.all : t.stage.names[s]}
                      <span className={app.filterCount}>{s === "all" ? all.length : stageCounts[s]}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.toolRow}>
                  <div className={app.filters} role="group" aria-label={t.words.lengthLabel}>
                    {(["1", "2", "3+"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={l === len ? `${app.filter} ${app.filterOn}` : app.filter}
                        aria-pressed={l === len}
                        onClick={() => setLen(l === len ? null : l)}
                      >
                        {t.words.lengths[l]}
                        <span className={app.filterCount}>{lengthCounts[l]}</span>
                      </button>
                    ))}
                  </div>
                  <div className={`${app.views} ${styles.sort}`} role="group" aria-label={t.words.sortLabel}>
                    {(["recent", "alpha"] as const).map((s) => (
                      <button key={s} type="button" className={app.view} aria-pressed={s === sort} onClick={() => setSort(s)}>
                        {t.words.sorts[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className={app.empty}>{t.words.noMatch}</p>
              ) : (
                <div className={styles.groups}>
                  {groups.map((g) => (
                    <section key={g.key || "all"}>
                      {g.key ? (
                        <h2 className={app.groupHead}>
                          <span className={`t-ja ${styles.lead}`} lang="ja">
                            {g.key}
                          </span>
                          <small>{t.common.words(g.words.length)}</small>
                        </h2>
                      ) : null}
                      <ul className={app.plainList}>
                        {g.words.map((w) => (
                          <WordRow
                            key={w.id}
                            word={w}
                            meta={
                              <span className={app.metaRow}>
                                <StageGauge stage={stages.get(w.id) ?? "collected"} />
                                <span>{t.common.ago(w.addedAt)}</span>
                              </span>
                            }
                            onOpen={() => setOpenKey(wordKey(w))}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              <p className={styles.footnote}>{t.stage.footnote}</p>
            </section>
          </>
        )}
      </div>
      {open ? <WordSheet key={openKey} word={open} onClose={() => setOpenKey(null)} /> : null}
    </>
  );
}
