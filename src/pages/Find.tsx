import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { discoverWords, nearWords, unlockedBy, unlockers, wordKey } from "../data/combine";
import { getCharData } from "../data/dataset";
import { learnerLevel } from "../data/sentences";
import { pairLabel, soundParts } from "../data/sounds";
import { dueWords } from "../data/stage";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { useSentences, useSounds, useWords } from "../util/live";
import { hasServer } from "../util/usage";
import { Icon } from "../components/Icon";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Find.module.css";
import { Everyone } from "./Everyone";
import { Meet } from "./Meet";
import { TryRead } from "./TryRead";
import { TryWrite } from "./TryWrite";

type View = "meet" | "read" | "write" | "readable" | "near" | "everyone";
const VIEWS: View[] = ["meet", "read", "write", "readable", "near", "everyone"];
/** 戻るボタンで、直に開いたときに戻る先。 */
const PARENT: Record<View, View> = { meet: "meet", readable: "meet", near: "meet", read: "readable", write: "readable", everyone: "meet" };
type Word = Pick<WordData, "kanji" | "kana" | "gloss">;

const PAGE = 40;

/**
 * 見つける：開くと、文の中で出会う（ことのあめ の例文の日本語訳の雨）。雨のあとに、ほかの見つけ方として
 * 集めた字の音だけで読める語（そこから読んでみる）と、あと1音で読める語と、みんなの雨（この1時間にみんなが集めた語）。
 * どれも戻るボタンの付いた画面で開く（みんなの雨は #/find?view=everyone で、X などに貼れる）。
 * 読みたい語は開いて、自分で打ってあつめる。
 */
export default function Find() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "meet";
  const words = useWords();
  const sentences = useSentences();
  const [sheet, setSheet] = useState<Word | null>(null);

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const sounds = useSounds(words);
  const readable = useMemo(() => discoverWords(sounds, ownedKeys, true), [sounds, ownedKeys]);
  const near = useMemo(() => nearWords(sounds, ownedKeys), [sounds, ownedKeys]);
  const level = useMemo(() => learnerLevel(ownedKeys), [ownedKeys]);
  const due = useMemo(() => new Set(dueWords(words ?? [], Date.now()).map(wordKey)), [words]);

  const navigate = useNavigate();
  const location = useLocation();

  function open(next: View) {
    setParams(next === "meet" ? {} : { view: next });
    window.scrollTo({ top: 0 });
  }

  function back() {
    // 雨や一覧から来たなら戻る。直に開いたときは一つ上の画面に置き換える。
    if (location.key !== "default") navigate(-1);
    else setParams(PARENT[view] === "meet" ? {} : { view: PARENT[view] }, { replace: true });
  }

  const loaded = words !== undefined;
  const count = view === "readable" ? readable.length : view === "near" ? near.length : null;

  return (
    <>
      <header className={app.subbar}>
        {view === "meet" ? (
          <h1 className={app.subtitleStrong}>{t.find.title}</h1>
        ) : (
          <>
            <button type="button" className={app.iconLink} onClick={back} aria-label={t.common.back}>
              <Icon name="back" size={22} />
            </button>
            <h1 className={`${app.subtitleStrong} ${app.withBack}`}>{t.find.views[view]}</h1>
            {loaded && count !== null ? <span className={app.subCount}>{t.common.words(count)}</span> : null}
          </>
        )}
      </header>
      <div className={app.bodyTight}>
        {!loaded ? null : (
          <>
            {view === "meet" ? (
              <>
                {sentences === undefined ? (
                  <p className={app.note}>{t.meet.loading}</p>
                ) : sentences === null ? (
                  <p className={app.error}>{t.meet.failed}</p>
                ) : (
                  <Meet data={sentences} sounds={sounds} owned={ownedKeys} due={due} onOpen={setSheet} />
                )}
                <Paths readable={readable.length} near={near.length} own={sounds.size > 0} onOpen={open} />
                {sentences ? <p className={app.note}>{t.meet.source}</p> : null}
              </>
            ) : null}
            {view === "read" ? <TryRead pool={readable} level={level} onNear={() => open("near")} /> : null}
            {view === "write" ? <TryWrite pool={readable} level={level} onNear={() => open("near")} /> : null}
            {view === "readable" ? (
              <Readable words={readable} onRead={() => open("read")} onWrite={() => open("write")} onOpen={setSheet} />
            ) : null}
            {view === "near" ? (
              <Near near={near} gain={(w) => unlockedBy(w, sounds, ownedKeys).length} onOpen={setSheet} />
            ) : null}
            {view === "everyone" ? <Everyone sounds={sounds} owned={ownedKeys} onOpen={setSheet} /> : null}
          </>
        )}
      </div>
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** 雨のあとの、ほかの見つけ方（語の数つき）。集めた音から見つける二つは、語を集めてから。みんなの雨は送り先があればいつでも。 */
function Paths({ readable, near, own, onOpen }: { readable: number; near: number; own: boolean; onOpen: (v: View) => void }) {
  const rows: { view: View; count?: number; note: string }[] = [
    ...(own
      ? [
          { view: "readable" as const, count: readable, note: t.find.pathReadable },
          { view: "near" as const, count: near, note: t.find.pathNear },
        ]
      : []),
    ...(hasServer() ? [{ view: "everyone" as const, note: t.find.pathEveryone }] : []),
  ];
  if (rows.length === 0) return null;
  return (
    <section className={styles.paths} aria-labelledby="paths-title">
      <h2 id="paths-title" className={`label ${styles.pathsTitle}`}>
        {t.find.paths}
      </h2>
      <ul className={app.plainList}>
        {rows.map((r) => (
          <li key={r.view}>
            <button type="button" className={styles.path} onClick={() => onOpen(r.view)}>
              <span className={styles.pathText}>
                <span className={styles.pathTitle}>
                  {t.find.views[r.view]}
                  {r.count === undefined ? null : <span className={styles.pathCount}>{t.common.words(r.count)}</span>}
                </span>
                <span className={styles.pathNote}>{r.note}</span>
              </span>
              <span className={styles.chev}>
                <Icon name="back" size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 集めた字の音だけで読める語。読みは伏せる（自分で読んでみる）。上から 読んでみる・써 보기 へ。字で絞り込める。 */
function Readable({
  words,
  onRead,
  onWrite,
  onOpen,
}: {
  words: (WordData & { chars: string[] })[];
  onRead: () => void;
  onWrite: () => void;
  onOpen: (w: Word) => void;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of words) for (const c of new Set(w.chars)) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [words]);
  const shown = focus ? words.filter((w) => w.chars.includes(focus)) : words;

  if (words.length === 0) return <p className={app.lead}>{t.find.none}</p>;
  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.find.lead}</p>
      <div className={`${app.panel} ${styles.readPanel}`}>
        <p className={app.note}>{t.find.readPanel}</p>
        <div className={styles.readStarts}>
          <button type="button" className={`btn ${styles.readStart}`} onClick={onRead}>
            {t.find.views.read}
            <Icon name="arrow" size={18} />
          </button>
          <button type="button" className={`btn-quiet ${styles.readStart}`} onClick={onWrite}>
            {t.find.views.write}
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
      <div className={app.filters} role="group" aria-label={t.find.filterLabel}>
        <Chip on={focus === null} onClick={() => setFocus(null)} label={t.find.all} count={words.length} />
        {counts.map(([c, n]) => (
          <Chip key={c} on={focus === c} onClick={() => setFocus(focus === c ? null : c)} label={c} count={n} hanja />
        ))}
      </div>
      <ul className={app.plainList}>
        {shown.slice(0, limit).map((w) => (
          <WordRow key={wordKey(w)} word={w} hideKana onOpen={() => onOpen(w)} />
        ))}
      </ul>
      {shown.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more} ({shown.length - limit})
        </button>
      ) : null}
    </section>
  );
}

/** あと1音で読める語。次に出会うと読める語が増える音（字と読み）から絞り込める。 */
function Near({
  near,
  gain,
  onOpen,
}: {
  near: ReturnType<typeof nearWords>;
  /** その語をあつめると新しく読めるようになる語の数。 */
  gain: (w: WordData) => number;
  onOpen: (w: Word) => void;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const keys = useMemo(() => unlockers(near).slice(0, 24), [near]);
  const shown = focus ? near.filter((n) => n.missing === focus) : near;
  const focused = focus ? soundParts(focus) : null;

  if (near.length === 0) return <p className={app.lead}>{t.find.nearNone}</p>;
  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.find.nearLead}</p>
      <h2 className={`label ${styles.unlockLabel}`}>{t.find.unlockLabel}</h2>
      <div className={app.filters} role="group" aria-label={t.find.unlockLabel}>
        <Chip on={focus === null} onClick={() => setFocus(null)} label={t.find.all} count={near.length} />
        {keys.map((k) => {
          const { char, reading } = soundParts(k.sound);
          return (
            <Chip
              key={k.sound}
              on={focus === k.sound}
              onClick={() => setFocus(focus === k.sound ? null : k.sound)}
              label={char}
              sub={pairLabel(char, reading)}
              count={t.find.unlockCount(k.count)}
              hanja
            />
          );
        })}
      </div>
      {focused ? (
        <Link to={`/hanja/${encodeURIComponent(focused.char)}`} className={app.quietAction}>
          <span className="hanja" lang="ja">
            {focused.char}
          </span>
          <span className="t-ja" lang="ja">
            {focused.reading}
          </span>
          <span className="t-ko">{getCharData(focused.char)?.sounds[0]?.eum}</span>
          <Icon name="arrow" size={16} />
        </Link>
      ) : null}
      <ul className={app.plainList}>
        {shown.slice(0, limit).map((n) => {
          const more = gain(n.word);
          const { char, reading } = soundParts(n.missing);
          return (
            <WordRow
              key={wordKey(n.word)}
              word={n.word}
              missing={char}
              meta={
                <>
                  {t.find.missingNote(pairLabel(char, reading))}
                  {more > 0 ? <span className={styles.gain}> · {t.gain.row(more)}</span> : null}
                </>
              }
              onOpen={() => onOpen(n.word)}
            />
          );
        })}
      </ul>
      {shown.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more} ({shown.length - limit})
        </button>
      ) : null}
    </section>
  );
}

function Chip({
  on,
  onClick,
  label,
  sub,
  count,
  hanja = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  /** 字の読み（音で絞るとき）。 */
  sub?: string;
  count: number | string;
  hanja?: boolean;
}) {
  return (
    <button type="button" className={on ? `${app.filter} ${app.filterOn}` : app.filter} aria-pressed={on} onClick={onClick}>
      <span className={hanja ? app.filterHanja : undefined} lang={hanja ? "ja" : undefined}>
        {label}
      </span>
      {sub ? (
        <span className="t-ja" lang="ja">
          {sub}
        </span>
      ) : null}
      <span className={app.filterCount}>{count}</span>
    </button>
  );
}
