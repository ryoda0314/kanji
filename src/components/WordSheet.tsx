import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type FormEvent } from "react";
import { unlockedBy, wordKey } from "../data/combine";
import { kanjiToWords, splitKanji } from "../data/dataset";
import { glossLang, glossText } from "../data/gloss";
import { isSameReading, readingNotes } from "../data/reading";
import { enrich } from "../data/resolver";
import { wordOf } from "../data/sentences";
import { hasParts, wordSounds } from "../data/sounds";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, removeWord, type CollectedWord } from "../db";
import { useChars, useSentences, useSounds, useWords } from "../util/live";
import appStyles from "../app.module.css";
import { Gain } from "./Gain";
import { KanaInput } from "./KanaInput";
import KanjiText from "./KanjiText";
import { Roots, rootNotes } from "./Roots";
import { SentenceRows } from "./SentenceView";
import { Sheet } from "./Sheet";
import { SpeakButton } from "./SpeakButton";
import { StageTrack } from "./Stage";
import { DiffNote } from "./DiffNote";
import { diffOf, koreanOf, WordRow } from "./WordRow";
import styles from "./WordSheet.module.css";

type Word = Pick<WordData, "kanji" | "kana" | "gloss"> & Partial<WordData>;

/** 辞書の語（字ごとの読み・同じ漢字の韓国語の語つき）。辞書に無ければ、渡された語のまま。 */
function fullWord(w: Word, owned: CollectedWord | null): WordData {
  const dict = (kanjiToWords.get(w.kanji.normalize("NFC")) ?? []).find((d) => d.kana === w.kana);
  return dict ?? (owned ? { ...owned } : { ...w });
}

/**
 * 一つの語を開いたところ：表記、読み、意味、漢字の根。集めた語なら、同じ字でつながった語と外す操作。
 * まだ集めていない語は、読みを自分の指で打ってあつめる（ボタン一つでは集めない。打つ一手間で、音が手に残る）。
 * あつめると根が下から伸び、字ごとに韓国語の音と日本語の読みが並ぶ。
 */
export function WordSheet({ word, onClose }: { word: Word; onClose: () => void }) {
  const [current, setCurrent] = useState<Word>(word);
  const kanji = current.kanji.normalize("NFC");
  const owned = useLiveQuery(
    () => db.words.get({ kanji, kana: current.kana }).then((w) => w ?? null),
    [kanji, current.kana]
  );

  return (
    <Sheet
      label={owned === undefined ? "" : owned ? t.sheet.owned : t.sheet.unowned}
      labelledBy="word-sheet-title"
      onClose={onClose}
    >
      {owned === undefined ? null : (
        <Body key={wordKey(current)} word={fullWord(current, owned)} owned={owned} onOpen={setCurrent} onClose={onClose} />
      )}
    </Sheet>
  );
}

function Body({
  word,
  owned,
  onOpen,
  onClose,
}: {
  word: WordData;
  owned: CollectedWord | null;
  onOpen: (w: Word) => void;
  onClose: () => void;
}) {
  const kanji = word.kanji.normalize("NFC");
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const [before, setBefore] = useState<number[] | null>(null);
  // あつめて新しく読めるようになった語（あつめる前の手持ちで数えておく）。
  const [unlocked, setUnlocked] = useState<WordData[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const words = useWords();
  const chars = useChars();
  const sounds = useSounds(words);
  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const gain = useMemo(
    () => (owned || !words ? [] : unlockedBy(word, sounds, ownedKeys)),
    [owned, words, word, sounds, ownedKeys]
  );
  const fresh = wordSounds(word).filter((s) => !sounds.has(s)).length;
  const notes = readingNotes(word);
  const diff = diffOf(word);
  const sentences = useSentences();
  const sentenceIds = useMemo(
    () => (sentences?.byWord.get(`${kanji}|${word.kana}`) ?? []).slice(0, 3),
    [sentences, kanji, word.kana]
  );
  // この語が出てくる文。印の別の語を押すと、その語に替わる。
  const examples =
    sentences && sentenceIds.length > 0 ? (
      <section className={styles.section}>
        <h3 className="label">{t.sheet.inSentences}</h3>
        <SentenceRows
          data={sentences}
          ids={sentenceIds}
          sounds={sounds}
          owned={ownedKeys}
          target={{ kanji, kana: word.kana }}
          onWord={(m) => onOpen(wordOf(m))}
        />
      </section>
    ) : null;

  const linked = useLiveQuery(async () => {
    const lists = await Promise.all([...new Set(splitKanji(kanji))].map((c) => db.words.where("chars").equals(c).toArray()));
    const byId = new Map<number, CollectedWord>();
    for (const w of lists.flat()) if (!(w.kanji === kanji && w.kana === word.kana)) byId.set(w.id, w);
    return [...byId.values()].sort((a, b) => b.addedAt - a.addedAt);
  }, [kanji, word.kana]);

  async function collect(e: FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    if (!isSameReading(typed, word.kana)) {
      setWrong(true);
      return;
    }
    const counts = await Promise.all(splitKanji(kanji).map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
    const opened = gain;
    await addWord(enrich({ ...word, kanji }, "seed"));
    setBefore(counts);
    setUnlocked(opened);
  }

  async function remove() {
    if (!owned) return;
    await removeWord(owned.id);
    onClose();
  }

  return (
    <>
      <div className={styles.top}>
        <div className={styles.names}>
          {koreanOf(word) ? (
            <span className={`${styles.koWord} t-ko`} lang="ko">
              {koreanOf(word)}
              <span className={styles.koArrow} aria-hidden="true">
                →
              </span>
            </span>
          ) : null}
          <h2 id="word-sheet-title" className={styles.big}>
            <KanjiText text={kanji} />
          </h2>
          <span className={`${styles.bigHanja} t-ja`} lang="ja">
            {word.kana}
          </span>
        </div>
        <SpeakButton text={word.kana} size="lg" />
      </div>
      {word.gloss ? (
        <p className={styles.gloss} lang={glossLang(word)}>
          {word.en ? <span className={appStyles.note}>{t.common.english} · </span> : null}
          {glossText(word)}
        </p>
      ) : null}
      {word.ko || word.n ? (
        <p className={styles.facts}>
          {word.ko ? (
            <span>
              {t.sheet.cognate} <strong className="t-ko">{word.ko}</strong>
            </span>
          ) : null}
          {word.n ? <span className={styles.level}>N{word.n}</span> : null}
        </p>
      ) : null}
      {diff ? <DiffNote note={diff} /> : null}

      <section className={styles.section}>
        <Roots word={word} notes={before ? rootNotes(before) : undefined} grow={before !== null} />
        {hasParts(word) ? <p className={appStyles.note}>{t.sheet.rootsNote}</p> : <p className={appStyles.note}>{t.sheet.whole}</p>}
        {notes.length > 0 ? (
          <ul className={styles.notes}>
            {notes.map((n) => (
              <li key={`${n.char}${n.here}`}>{t.read.variant(n.char, n)}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {owned ? (
        <>
          <p className={styles.since}>{before ? t.collect.collectedTitle(kanji) : t.sheet.since(owned.addedAt)}</p>
          {unlocked && unlocked.length > 0 ? (
            <section className={styles.section}>
              <Gain count={unlocked.length} when="after" />
              <ul className={appStyles.plainList}>
                {unlocked.slice(0, 4).map((w) => (
                  <WordRow key={wordKey(w)} word={w} hideKana onOpen={() => onOpen(w)} />
                ))}
              </ul>
            </section>
          ) : null}
          <section className={styles.section}>
            <h3 className="label">{t.stage.label}</h3>
            <StageTrack word={owned} now={Date.now()} />
          </section>
          <section className={styles.section}>
            <h3 className="label">{t.sheet.linked}</h3>
            {linked === undefined ? null : linked.length === 0 ? (
              <p className={appStyles.empty}>{t.sheet.linkedNone}</p>
            ) : (
              <ul className={appStyles.plainList}>
                {linked.slice(0, 12).map((w) => (
                  <WordRow key={w.id} word={w} onOpen={() => onOpen(w)} />
                ))}
              </ul>
            )}
          </section>
          {examples}
          <div className={styles.dangerRow}>
            {confirming ? (
              <div className={styles.confirm}>
                <p className={appStyles.note}>{t.sheet.deleteNote}</p>
                <button type="button" className={styles.danger} onClick={remove} autoFocus>
                  {t.sheet.confirmDelete}
                </button>
                <button type="button" className={styles.quietDanger} onClick={() => setConfirming(false)}>
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.quietDanger} onClick={() => setConfirming(true)}>
                {t.sheet.delete}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {gain.length > 0 ? (
            <Gain count={gain.length} when="before" />
          ) : chars ? (
            <p className={appStyles.note}>{!hasParts(word) ? t.gain.whole : fresh === 0 ? t.gain.known : t.gain.firstRoots(fresh)}</p>
          ) : null}
          <form className={styles.typeBox} onSubmit={collect}>
            <label htmlFor="type-word" className="label">
              {t.sheet.typeLabel}
            </label>
            <div className={styles.typeRow}>
              <KanaInput
                id="type-word"
                className={styles.typeInput}
                value={typed}
                onValue={(v) => {
                  setTyped(v);
                  setWrong(false);
                }}
                enterKeyHint="done"
              />
              <button type="submit" className="btn" disabled={!typed.trim()}>
                {t.collect.collect}
              </button>
            </div>
            <p className={wrong ? appStyles.error : appStyles.note} role={wrong ? "alert" : undefined}>
              {wrong ? t.sheet.typeWrong(word.kana) : t.sheet.typeHint}
            </p>
          </form>
          {examples}
        </>
      )}
    </>
  );
}
