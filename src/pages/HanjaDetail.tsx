import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { discoverWords, nearWords, unlockedBy, wordKey, wordsWrittenWith } from "../data/combine";
import { charToWords, getCharData, jpForm } from "../data/dataset";
import { pairLabel, soundKey, soundParts } from "../data/sounds";
import type { KoreanSound, WordData } from "../data/types";
import { t } from "../copy";
import { useChars, useSentences, useSounds, useWords } from "../util/live";
import { learnerLevel, sentenceScore, wordOf } from "../data/sentences";
import { usePrefs } from "../prefs";
import { Icon } from "../components/Icon";
import { SentenceRows } from "../components/SentenceView";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import hs from "../components/hanja.module.css";
import styles from "./HanjaDetail.module.css";

type Word = Pick<WordData, "kanji" | "kana" | "gloss">;

const PAGE = 20;

function decode(raw: string) {
  try {
    return jpForm(decodeURIComponent(raw).normalize("NFC"));
  } catch {
    return raw.normalize("NFC");
  }
}

/**
 * 一つの字：田字格に大きく、韓国語の訓と音。そして、この字で書く言葉（読みの一覧ではなく、言葉のまとまりで）。
 * この字が入った集めた語、この字で読める語、あと1音で読める語。
 */
export default function HanjaDetail() {
  const params = useParams();
  const char = decode(params.char ?? "");
  const data = getCharData(char);
  const navigate = useNavigate();
  const location = useLocation();
  const { script } = usePrefs();
  const [sheet, setSheet] = useState<Word | null>(null);

  const words = useWords();
  const chars = useChars();
  const stat = chars && (chars.find((c) => c.char === char) ?? null);
  const mine = words?.filter((w) => w.chars.includes(char));

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const sounds = useSounds(words);
  const readable = useMemo(
    () => discoverWords(sounds, ownedKeys, true).filter((w) => w.chars.includes(char)),
    [sounds, ownedKeys, char]
  );
  const near = useMemo(
    () => nearWords(sounds, ownedKeys).filter((n) => n.word.kanji.includes(char)),
    [sounds, ownedKeys, char]
  );
  // あと1音の語：足りない音と、あつめると増える読める語の数。
  function nearMeta(w: WordData, missing: string) {
    const { char: c, reading } = soundParts(missing);
    const more = unlockedBy(w, sounds, ownedKeys).length;
    return more > 0 ? `${t.find.missingNote(pairLabel(c, reading))} · ${t.gain.row(more)}` : t.find.missingNote(pairLabel(c, reading));
  }

  function back() {
    // ほかの画面から来たなら戻る。直接開いたなら漢字の一覧へ。
    if (location.key !== "default") navigate(-1);
    else navigate("/hanja");
  }

  const r = data?.sounds[0];
  const ko = data?.ko && data.ko !== char ? data.ko : null;
  const total = charToWords.get(char)?.length ?? 0;
  const others = Math.max(0, total - (mine?.length ?? 0) - readable.length - near.length);

  return (
    <>
      <header className={app.subbar}>
        <button type="button" className={app.iconLink} onClick={back} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>
        <h1 className={`${app.subtitleStrong} ${app.withBack}`}>
          <span className="hanja" lang="ja">
            {char}
          </span>
          {r ? (
            <span className={`t-ko ${styles.titleEum}`} lang="ko">
              {r.eum}
            </span>
          ) : null}
        </h1>
      </header>

      {!data ? (
        <div className={app.bodyTight}>
          <p className={app.lead}>{t.char.unknown(char)}</p>
        </div>
      ) : (
        <div className={`${app.bodyTight} ${app.split}`}>
          <div className={`${app.col} ${app.stick}`}>
            <section className={hs.hero}>
              <div className={hs.grid}>
                <span className={`hanja ${hs.gridGlyph}`} lang="ja">
                  {char}
                </span>
              </div>
              <dl className={hs.facts}>
                {r ? (
                  <div>
                    <dt>{t.char.korean}</dt>
                    <dd>
                      <span className={`t-ko ${hs.eum}`} lang="ko">
                        {r.hun ? `${r.hun} ${r.eum}` : r.eum}
                        {data.sounds.length > 1 ? (
                          <span className={hs.eumMore}>
                            {data.sounds
                              .slice(1)
                              .map((x) => x.eum)
                              .join("·")}
                          </span>
                        ) : null}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {ko && script === "both" ? (
                  <div>
                    <dt>{t.char.koForm}</dt>
                    <dd className={`hanja-ko ${hs.factJp}`} lang="ko">
                      {ko}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
            {data.meaning ? (
              <div className={styles.meaning}>
                <span className="label">{t.char.meaning}</span>
                <p lang="en">{data.meaning}</p>
              </div>
            ) : null}
            <div className={hs.tags}>
              {data.strokes ? <span className={hs.tag}>{t.char.strokes(data.strokes)}</span> : null}
              {data.joyo ? (
                <span className={`${hs.tag} ${hs.tagEdu}`}>
                  {t.char.joyo} · {t.hanja.grade(data.grade ?? 8)}
                </span>
              ) : null}
              {data.n ? <span className={hs.tag}>{t.char.jlpt(data.n)}</span> : null}
              {data.edu ? <span className={hs.tag}>{t.char.edu}</span> : null}
            </div>
            {stat === undefined ? null : stat ? (
              <p className={styles.owned}>{t.char.owned(stat.count, stat.firstAddedAt)}</p>
            ) : (
              <p className={app.note}>{t.char.notOwned}</p>
            )}
            <Written char={char} korean={r} sounds={sounds} owned={ownedKeys} onOpen={setSheet} />
          </div>

          <div className={app.col}>
            {mine && mine.length > 0 ? (
              <List title={t.char.mine} count={mine.length}>
                {mine.map((w) => (
                  <WordRow key={w.id} word={w} meta={t.common.ago(w.addedAt)} onOpen={() => setSheet(w)} />
                ))}
              </List>
            ) : null}
            <CharSentences char={char} sounds={sounds} owned={ownedKeys} onOpen={setSheet} />
            {stat ? (
              <Paged
                title={t.char.readable}
                empty={t.char.readableNone}
                items={readable}
                render={(w) => <WordRow key={wordKey(w)} word={w} hideKana onOpen={() => setSheet(w)} />}
              />
            ) : null}
            <Paged
              title={t.char.near}
              empty={t.char.nearNone}
              items={near}
              render={(n) => (
                <WordRow
                  key={wordKey(n.word)}
                  word={n.word}
                  missing={soundParts(n.missing).char}
                  meta={nearMeta(n.word, n.missing)}
                  onOpen={() => setSheet(n.word)}
                />
              )}
            />
            {others > 0 ? <p className={app.note}>{t.char.others(others)}</p> : null}
          </div>
        </div>
      )}
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

function List({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className={app.listHead}>
        <h2>{title}</h2>
        <span className={app.count}>{t.common.words(count)}</span>
      </div>
      <ul className={app.plainList}>{children}</ul>
    </section>
  );
}

function Paged<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <section className={styles.paged}>
      <div className={app.listHead}>
        <h2>{title}</h2>
        <span className={app.count}>{t.common.words(items.length)}</span>
      </div>
      {items.length === 0 ? (
        <p className={app.empty}>{empty}</p>
      ) : (
        <ul className={app.plainList}>{items.slice(0, limit).map(render)}</ul>
      )}
      {items.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more} ({items.length - limit})
        </button>
      ) : null}
    </section>
  );
}

/** この字が出てくる文。印の語を押すとその語が開く。 */
function CharSentences({
  char,
  sounds,
  owned,
  onOpen,
}: {
  char: string;
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: Word) => void;
}) {
  const data = useSentences();
  const [limit, setLimit] = useState(4);
  // 集めた語の入った文から（また出会う）。学ぶ人の段階より難しい語の文は後ろに。
  const ids = useMemo(() => {
    if (!data) return [];
    const list = data.byChar.get(char) ?? [];
    const level = learnerLevel(owned);
    const score = (id: number) => sentenceScore(data.list[id], sounds, owned, { level });
    return [...list].sort((a, b) => score(b) - score(a));
  }, [data, char, sounds, owned]);
  if (!data || ids.length === 0) return null;
  return (
    <section className={styles.paged}>
      <div className={app.listHead}>
        <h2>{t.char.inSentences}</h2>
        <span className={app.count}>{ids.length}</span>
      </div>
      <SentenceRows data={data} ids={ids.slice(0, limit)} sounds={sounds} owned={owned} onWord={(m) => onOpen(wordOf(m))} />
      {ids.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + 8)}>
          {t.common.more} ({ids.length - limit})
        </button>
      ) : null}
    </section>
  );
}

/** 一つのまとまりに並べる語の数（ほかは +n）。 */
const GROUP_LIMIT = 5;

/**
 * この字で書く言葉。字の読みを並べて覚えさせるのではなく、言葉のまとまりで見せる（読みが多いのではなく、この字で書く言葉が多い）。
 * 音読み：漢語の中の音（생 ↔ せい）と、その音の語。訓読み：この字の意味の日本語の言葉（生きる・生まれる・生）と、
 * その言葉からできた語（生き物）。韓国語の訓（날 생 の 날）と同じく、字の意味を表す言葉。熟字訓は語ぜんたいで読む語。
 * 集めた語は濃く、集めた音・言葉には印。押すと語が開く。
 */
function Written({
  char,
  korean,
  sounds,
  owned,
  onOpen,
}: {
  char: string;
  korean: KoreanSound | undefined;
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: Word) => void;
}) {
  const groups = useMemo(() => wordsWrittenWith(char), [char]);
  if (groups.length === 0) return null;
  const firstOn = groups.find((g) => g.kind === "on")?.reading;
  const chip = (w: WordData) => (
    <button
      key={wordKey(w)}
      type="button"
      className={owned.has(wordKey(w)) ? `${styles.word} ${styles.wordOwned}` : styles.word}
      onClick={() => onOpen(w)}
      lang="ja"
    >
      <span className="hanja">{w.kanji}</span>
    </button>
  );
  return (
    <section className={styles.written}>
      <h2 className="label">{t.char.written}</h2>
      <p className={app.note}>{t.char.writtenLead(korean?.hun, korean?.eum, firstOn)}</p>
      <ul className={styles.groups}>
        {groups.map((g) => {
          const have = g.kind !== "whole" && sounds.has(soundKey(char, g.reading));
          const [head, ...rest] = g.words;
          const shown = g.kind === "kun" ? rest : g.words;
          return (
            <li key={`${g.kind}|${g.reading}`} className={styles.group}>
              <div className={styles.groupHead}>
                {g.kind === "on" ? (
                  <>
                    <span className={`t-ja ${styles.groupReading}`} lang="ja">
                      {g.reading}
                    </span>
                    <span className={styles.groupKind}>
                      {t.char.on}
                      {korean ? ` · ${korean.eum} ↔ ${g.reading}` : ""}
                    </span>
                  </>
                ) : g.kind === "kun" ? (
                  <>
                    <button type="button" className={styles.headWord} onClick={() => onOpen(head)} lang="ja">
                      <span className="hanja">{head.kanji}</span>
                      <span className={`t-ja ${styles.headKana}`}>{head.kana}</span>
                    </button>
                    <span className={styles.groupKind}>{t.char.kun}</span>
                    {head.gloss && !head.en ? (
                      <span className={`t-ko ${styles.headGloss}`} lang="ko">
                        {head.gloss}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className={styles.groupKind}>{t.char.whole}</span>
                )}
                {have ? <span className={styles.have}>{t.char.have}</span> : null}
              </div>
              {shown.length ? (
                <div className={styles.groupWords}>
                  {shown.slice(0, GROUP_LIMIT).map(chip)}
                  {shown.length > GROUP_LIMIT ? <span className={styles.groupMore}>+{shown.length - GROUP_LIMIT}</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
