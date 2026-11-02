import { useEffect, useMemo, useRef, useState } from "react";
import { wordKey, type DiscoverResult } from "../data/combine";
import { getCharData, splitKanji } from "../data/dataset";
import { glossLang, glossText } from "../data/gloss";
import { pickToRead, readingNotes } from "../data/reading";
import { commonRank, enrich } from "../data/resolver";
import { wordStage, type Stage } from "../data/stage";
import type { WordData } from "../data/types";
import { checkSlots, sameReadingAt, slotChars, tilesFor, writeParts, type Tile } from "../data/write";
import { t } from "../copy";
import { addWord, db, recordRead, removeWord } from "../db";
import { RATES, usePrefs } from "../prefs";
import { useChars } from "../util/live";
import { speak, useJapaneseVoice } from "../util/speech";
import { Icon } from "../components/Icon";
import KanjiText from "../components/KanjiText";
import { Roots, rootNotes } from "../components/Roots";
import { SpeakButton } from "../components/SpeakButton";
import { StageGauge } from "../components/Stage";
import app from "../app.module.css";
import read from "./TryRead.module.css";
import styles from "./TryWrite.module.css";

/**
 * 써 보기：集めた字の音だけでできた、まだ習っていない語を、言葉（音と意味）から字の札を並べて書く（読んでみる の逆向き）。
 * 合っていればそのまま集まる。出す語は 読んでみる と同じく、学ぶ人の段階の一つ上の段までから。
 */
export function TryWrite({ pool, level, onNear }: { pool: DiscoverResult[]; level: number; onNear: () => void }) {
  const fits = (w: DiscoverResult) => commonRank(w) <= level + 1;
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [current, setCurrent] = useState<DiscoverResult | null>(() => pickToRead(pool, () => false, Math.random, fits));

  useEffect(() => {
    if (!current) setCurrent(pickToRead(pool, (w) => seen.has(wordKey(w)), Math.random, fits));
  }, [current, pool, seen]);

  function next() {
    if (!current) return;
    const nextSeen = new Set(seen).add(wordKey(current));
    setSeen(nextSeen);
    setCurrent(pickToRead(pool, (w) => nextSeen.has(wordKey(w)), Math.random, fits));
  }

  if (!current) {
    if (pool.length === 0) {
      return (
        <section className={app.stack}>
          <p className={app.lead}>{t.write.empty}</p>
          <button type="button" className={app.quietAction} onClick={onNear}>
            {t.read.toNear}
            <Icon name="arrow" size={16} />
          </button>
        </section>
      );
    }
    return (
      <section className={app.stack}>
        <p className={app.lead}>{t.read.allSeen}</p>
        <button type="button" className="btn-quiet" onClick={() => setSeen(new Set())}>
          {t.read.restart}
        </button>
      </section>
    );
  }

  return <WriteCard key={wordKey(current)} word={current} mode="new" onNext={next} />;
}

type Phase = "ask" | "retry" | "done";

/**
 * 言葉を聞いて（かなと韓国語の意味も見て）、その言葉を書く字を札から選んで升に並べるカード。
 * 札を押すと次の空いた升へ、升を押すと札に戻る。全部の升が埋まったら答え合わせ。違った升は、置いた字の訓と音
 * （回 돌 회）を見せて札に戻す（字は意味で選ぶ）。点数は出さない。
 * new：まだ集めていない語。書けたら集まり、はじめの一回で書けたら「読めた」から始まる（読んでみる と同じ）。
 * review：集めた語のふりかえり。はじめの一回で書けたら覚え具合が進み、違えたり答えを見たりしたら、あすまた出てくる。
 * practice：集めた語を、ふりかえりどきを待たずに書いてみる（覚え具合には数えない）。
 */
export function WriteCard({ word, mode, onNext }: { word: WordData; mode: "new" | "review" | "practice"; onNext: () => void }) {
  const { rate } = usePrefs();
  const voice = useJapaneseVoice();
  const chars = useChars();
  const answer = useMemo(() => slotChars(word.kanji), [word.kanji]);
  const parts = useMemo(() => writeParts(word.kanji), [word.kanji]);
  // 札はカードが出たときに一度だけ作る（集めた字を、同じ読みの字の中で先に選ぶ）。
  const [tiles] = useState<Tile[]>(() => tilesFor(word, new Set((chars ?? []).map((c) => c.char))));
  const [placed, setPlaced] = useState<(Tile | null)[]>(() => answer.map(() => null));
  const [phase, setPhase] = useState<Phase>("ask");
  const [shown, setShown] = useState(false);
  const [hint, setHint] = useState(false);
  // 違った札（訓と音を見せる）。
  const [wrong, setWrong] = useState<{ slot: number; char: string }[]>([]);
  const [before, setBefore] = useState<number[] | null>(null);
  const [firstTry, setFirstTry] = useState(false);
  const [stageAfter, setStageAfter] = useState<Stage | null>(null);
  const [undone, setUndone] = useState(false);
  const key = { kanji: word.kanji.normalize("NFC"), kana: word.kana };
  const spoken = useRef(false);

  // カードが出たら、言葉を一度読み上げる（言葉が先）。
  useEffect(() => {
    if (spoken.current || !voice) return;
    spoken.current = true;
    void speak(word.kana, voice, RATES[rate]);
  }, [voice]);

  const used = new Set(placed.flatMap((p) => (p ? [p.id] : [])));

  function put(tile: Tile) {
    if (phase === "done" || used.has(tile.id)) return;
    const at = placed.findIndex((p) => p === null);
    if (at < 0) return;
    const next = placed.map((p, i) => (i === at ? tile : p));
    setPlaced(next);
    setWrong([]);
    if (next.every(Boolean)) void check(next);
  }

  function takeBack(slot: number) {
    if (phase === "done") return;
    setPlaced(placed.map((p, i) => (i === slot ? null : p)));
  }

  async function check(next: (Tile | null)[]) {
    const marks = checkSlots(
      answer,
      next.map((p) => p?.char ?? null)
    );
    if (marks.every(Boolean)) {
      const ok = phase === "ask";
      if (mode === "new") {
        const counts = await Promise.all(splitKanji(word.kanji).map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
        await addWord(enrich(word, "seed"));
        setBefore(counts);
      }
      if (ok && mode !== "practice") {
        await recordRead(key, true);
        const saved = await db.words.get(key);
        if (saved) setStageAfter(wordStage(saved));
      }
      setFirstTry(ok);
      setPhase("done");
      if (voice) void speak(word.kana, voice, RATES[rate]);
      return;
    }
    // 違った升は、置いた字を見せて札に戻す。ふりかえりでは、あすまた出てくる。
    if (phase === "ask" && mode === "review") void recordRead(key, false);
    setPhase("retry");
    setWrong(marks.flatMap((m, i) => (m ? [] : [{ slot: i, char: next[i]!.char }])));
    setPlaced(next.map((p, i) => (marks[i] ? p : null)));
  }

  function reveal() {
    if (phase === "ask" && mode === "review") void recordRead(key, false);
    setShown(true);
    setPhase("retry");
    setWrong([]);
    setPlaced(answer.map(() => null));
  }

  async function undo() {
    const owned = await db.words.get(key);
    if (owned) await removeWord(owned.id);
    setUndone(true);
  }

  const notes = readingNotes(word);

  if (phase === "done") {
    return (
      <section className={read.wrap} aria-live="polite">
        <p className={read.success}>
          <Icon name="check" size={18} />
          {mode === "new"
            ? firstTry
              ? t.write.done
              : t.collect.collectedTitle(word.kanji)
            : firstTry
              ? t.write.doneReview
              : mode === "review"
                ? t.write.retried
                : t.write.practiceRetried}
        </p>
        {stageAfter ? (
          <p className={read.stageAfter}>
            <StageGauge stage={stageAfter} />
          </p>
        ) : null}
        <div className={read.answer}>
          <div className={read.names}>
            <KanjiText text={word.kanji} className={read.big} />
            <span className={`${read.bigHanja} t-ja`} lang="ja">
              {word.kana}
            </span>
          </div>
          <SpeakButton text={word.kana} size="lg" />
        </div>
        {word.gloss ? (
          <p className={read.gloss} lang={glossLang(word)}>
            {glossText(word)}
          </p>
        ) : null}
        <Roots word={word} notes={before ? rootNotes(before) : undefined} grow />
        {notes.length > 0 ? (
          <ul className={read.notes}>
            {notes.map((n) => (
              <li key={`${n.char}${n.here}`}>{t.read.variant(n.char, n)}</li>
            ))}
          </ul>
        ) : null}
        {mode === "new" ? (
          <p className={app.note}>
            {undone ? t.read.undone : t.read.collected}
            {undone ? null : (
              <button type="button" className={read.quiet} onClick={undo}>
                {t.read.undo}
              </button>
            )}
          </p>
        ) : null}
        <button type="button" className="btn" onClick={onNext} autoFocus>
          {t.read.next}
        </button>
      </section>
    );
  }

  return (
    <section className={read.wrap} aria-live="polite">
      <p className={app.lead}>{mode === "new" ? t.write.lead : t.write.reviewLead}</p>
      <div className={styles.word}>
        <div className={styles.wordText}>
          <span className={`${styles.kana} t-ja`} lang="ja">
            {word.kana}
          </span>
          {word.gloss ? (
            <span className={styles.gloss} lang={glossLang(word)}>
              {glossText(word)}
            </span>
          ) : null}
        </div>
        <SpeakButton text={word.kana} size="lg" />
      </div>

      <div className={styles.slots} role="group" aria-label={t.write.slotsLabel}>
        {parts.map((p, i) =>
          p.slot === undefined ? (
            <span key={i} className={`${styles.fixed} t-ja`} lang="ja">
              {p.text}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              className={[styles.slot, placed[p.slot] ? styles.slotFilled : "", wrong.some((w) => w.slot === p.slot) ? styles.slotWrong : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => takeBack(p.slot!)}
              aria-label={placed[p.slot]?.char ?? t.write.slotEmpty}
              lang="ja"
            >
              <span className="hanja">{placed[p.slot]?.char ?? (shown ? <span className={styles.ghost}>{answer[p.slot]}</span> : "")}</span>
            </button>
          )
        )}
      </div>

      {wrong.length > 0 ? (
        <ul className={styles.wrongs} aria-live="assertive">
          {wrong.map((w) => {
            const s = getCharData(w.char)?.sounds[0];
            const label = `${w.char}${s ? ` ${s.hun ? `${s.hun} ` : ""}${s.eum}` : ""}`;
            return <li key={w.slot}>{sameReadingAt(word, w.slot, w.char) ? t.write.wrongSame(label) : t.write.wrong(label)}</li>;
          })}
        </ul>
      ) : null}

      <ul className={styles.tray} aria-label={t.write.trayLabel}>
        {tiles.map((tile) => {
          // 훈음（모일 회）。会 と 回 は音がどちらも 회 なので、訓（意味）で選ぶ手がかりになる。
          const sound = getCharData(tile.char)?.sounds[0];
          return (
            <li key={tile.id}>
              <button type="button" className={styles.tile} disabled={used.has(tile.id)} onClick={() => put(tile)} lang="ja">
                <span className={`hanja ${styles.tileChar}`}>{tile.char}</span>
                {hint && sound ? (
                  <span className={`t-ko ${styles.tileEum}`} lang="ko">
                    {sound.hun ? `${sound.hun} ${sound.eum}` : sound.eum}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={read.actions}>
        <button type="button" className={read.small} onClick={() => setHint((h) => !h)} aria-pressed={hint}>
          {t.write.hint}
        </button>
        {shown ? null : (
          <button type="button" className={read.small} onClick={reveal}>
            {t.read.reveal}
          </button>
        )}
        <button type="button" className={read.small} onClick={onNext}>
          {mode === "review" ? t.review.skip : t.read.skip}
        </button>
      </div>
      {shown ? <p className={app.note}>{t.write.retry}</p> : null}
    </section>
  );
}
