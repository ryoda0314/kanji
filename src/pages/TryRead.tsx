import { useEffect, useState, type FormEvent } from "react";
import { wordKey, type DiscoverResult } from "../data/combine";
import { getCharData, splitKanji } from "../data/dataset";
import { glossLang, glossText } from "../data/gloss";
import { normalizeReading } from "../data/kana";
import { compareKana, isSameReading, pickToRead, readingNotes, rubyParts, usualReading } from "../data/reading";
import { commonRank, enrich } from "../data/resolver";
import { baseAt } from "../data/sounds";
import { wordStage, type Stage } from "../data/stage";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, recordRead, removeWord } from "../db";
import { RATES, usePrefs } from "../prefs";
import { speak, useJapaneseVoice } from "../util/speech";
import { Icon } from "../components/Icon";
import { KanaInput } from "../components/KanaInput";
import KanjiText from "../components/KanjiText";
import { DiffNote } from "../components/DiffNote";
import { diffOf, koreanOf } from "../components/WordRow";
import { Roots, rootNotes } from "../components/Roots";
import { SpeakButton } from "../components/SpeakButton";
import { StageGauge } from "../components/Stage";
import app from "../app.module.css";
import styles from "./TryRead.module.css";

/**
 * 말해 보기：集めた字の音（소리 짝）だけでできた、まだ集めていない漢字語を、韓国語の語と漢字で見せて、日本語で言ってみる。字の読みをつなげてかなで打ち、
 * 合っていればそのまま集まる（打つ一手間が「写す」でなく「組み立てる」になる）。
 * 点数も連続記録もない。字を押せばその字の読み、「答えを見る」でいつでも答え（ことのあめ の「言ってみる」と同じ段）。
 * 出す語は、学ぶ人の段階（level：集めた語の段）の一つ上の段までから。無くなれば、ほかの語も。
 */
export function TryRead({ pool, level, onNear }: { pool: DiscoverResult[]; level: number; onNear: () => void }) {
  const fits = (w: DiscoverResult) => commonRank(w) <= level + 1;
  // このひとときに出した語（同じ語が続かないように）。開き直すとまた出る：忘れても、また出会う。
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [current, setCurrent] = useState<DiscoverResult | null>(() => pickToRead(pool, () => false, Math.random, fits));

  // 読める語がまだ無かったところへ増えたら、最初の語を出す。
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
          <p className={app.lead}>{t.read.empty}</p>
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

  return <ReadCard key={wordKey(current)} word={current} mode="new" focus={seen.size > 0} onNext={next} />;
}

type Phase = "ask" | "answer" | "read";

/**
 * 漢字だけ見せて、字の読みをつなげてかなで読むカード。
 * new：まだ集めていない語。読めたら（打てたら）集まり、答えを見ずに読めたら「読めた」から始まる。
 * review：集めた語のふりかえり。答えを見ずに読めたら覚え具合が進み、答えを見たらあすまた出てくる。
 */
export function ReadCard({
  word,
  mode,
  focus,
  onNext,
}: {
  word: WordData;
  mode: "new" | "review";
  focus: boolean;
  onNext: () => void;
}) {
  const { rate } = usePrefs();
  const voice = useJapaneseVoice();
  const chars = splitKanji(word.kanji);
  const [phase, setPhase] = useState<Phase>("ask");
  const [typed, setTyped] = useState("");
  const [hinted, setHinted] = useState<Set<number>>(() => new Set());
  // 違った読み（答えに印を付けるため）。答えを見ただけなら null。
  const [missed, setMissed] = useState<string | null>(null);
  const [retypeWrong, setRetypeWrong] = useState(false);
  const [before, setBefore] = useState<number[] | null>(null);
  // 答えを見ずに読めたか（読めました と言えるのはこのときだけ）。
  const [firstTry, setFirstTry] = useState(false);
  const [undone, setUndone] = useState(false);
  // 答えを見ずに読めたあとの覚え具合（読めた・身についた）。
  const [stageAfter, setStageAfter] = useState<Stage | null>(null);
  const notes = readingNotes(word);
  const key = { kanji: word.kanji.normalize("NFC"), kana: word.kana };
  // 知っている韓国語の漢字語（학생）。これを日本語で言う。意味・使い方のちがう語（洋服 ↔ 양복）は、そのちがいも見せる。
  const korean = koreanOf(word);
  const diff = korean ? diffOf(word) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    if (isSameReading(typed, word.kana)) {
      const ok = phase === "ask";
      if (mode === "new") {
        const counts = await Promise.all(chars.map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
        await addWord(enrich(word, "seed"));
        setBefore(counts);
      }
      if (ok) {
        await recordRead(key, true);
        const saved = await db.words.get(key);
        if (saved) setStageAfter(wordStage(saved));
      }
      setFirstTry(ok);
      setPhase("read");
      if (voice) void speak(word.kana, voice, RATES[rate]);
    } else if (phase === "ask") {
      if (mode === "review") void recordRead(key, false);
      setMissed(typed);
      setTyped("");
      setPhase("answer");
    } else {
      setRetypeWrong(true);
    }
  }

  function reveal() {
    if (mode === "review") void recordRead(key, false);
    setMissed(null);
    setPhase("answer");
  }

  async function undo() {
    const owned = await db.words.get(key);
    if (owned) await removeWord(owned.id);
    setUndone(true);
  }

  // 違ったかなの印は、答えを見ているあいだだけ。
  const marks = phase === "answer" && missed ? compareKana(missed, word.kana) : null;
  // 字のふだんの読みをつなげたとおりに読んだのに、この語では読みが変わる字があった（学校 を がくこう と）。
  const byUsual = missed !== null && notes.length > 0 && isSameReading(missed, usualReading(word));
  // 漢字だけ見せる並び：字ごとに押すと読みが出る。送り仮名はそのまま見せる。
  let at = -1;
  const parts = rubyParts(word).flatMap((p) =>
    p.rt === undefined ? [{ text: p.text, index: -1 }] : Array.from(p.text).map((c) => ({ text: c, index: ++at }))
  );

  return (
    <section className={styles.wrap} aria-live="polite">
      {phase === "ask" ? (
        <>
          <p className={app.lead}>{mode === "review" ? t.review.lead : t.read.lead}</p>
          <div className={styles.card}>
            {korean ? (
              <p className={`${styles.korean} t-ko`} lang="ko">
                {korean}
              </p>
            ) : null}
            <ol className={styles.glyphs}>
              {parts.map((p, k) => {
                if (p.index < 0) {
                  return (
                    <li key={k} className={styles.okuri}>
                      <span className={`t-ja ${styles.okuriText}`} lang="ja">
                        {p.text}
                      </span>
                    </li>
                  );
                }
                const i = p.index;
                // この語での読み（学校 の 学 は がっ）。ふだんの読みと違えば、ふだんの読みを小さく添える。
                const here = word.rt?.[i] ?? "";
                const usual = baseAt(word, i);
                const open = hinted.has(i);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      className={styles.glyph}
                      onClick={() => setHinted((h) => new Set(h).add(i))}
                      aria-label={open ? `${p.text} ${here}` : p.text}
                    >
                      <span className={`hanja ${styles.glyphChar}`} lang="ja">
                        {p.text}
                      </span>
                      {getCharData(splitKanji(p.text)[0] ?? p.text)?.sounds[0] ? (
                        <span className={`t-ko ${styles.eum}`} lang="ko">
                          {getCharData(splitKanji(p.text)[0] ?? p.text)?.sounds[0]?.eum}
                        </span>
                      ) : null}
                      <span className={`t-ja ${open ? styles.sound : `${styles.sound} ${styles.soundHidden}`}`} lang="ja">
                        {open ? here : "・"}
                      </span>
                      {open && usual && usual !== here ? (
                        <span className={`${styles.usual} t-ja`} lang="ja">
                          {t.read.usualSound(usual)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className={app.note}>{t.read.tapHint}</p>
          </div>
          {diff ? <DiffNote note={diff} /> : null}
        </>
      ) : (
        <>
          {phase === "read" ? (
            <p className={styles.success}>
              <Icon name="check" size={18} />
              {mode === "review"
                ? firstTry
                  ? t.review.read
                  : t.review.missed
                : firstTry
                  ? t.read.read
                  : t.collect.collectedTitle(word.kanji)}
            </p>
          ) : (
            <p className="label">{byUsual ? t.read.missedVariant : missed ? t.read.missed : t.read.shown}</p>
          )}
          {phase === "read" && stageAfter ? (
            <p className={styles.stageAfter}>
              <StageGauge stage={stageAfter} />
            </p>
          ) : null}
          <div className={styles.answer}>
            <div className={styles.names}>
              <KanjiText text={word.kanji} className={styles.big} />
              <span className={`${styles.bigHanja} t-ja`} lang="ja">
                {Array.from(normalizeReading(word.kana)).map((s, i) => (
                  <span key={i} className={marks && !marks[i] ? styles.diff : undefined}>
                    {s}
                  </span>
                ))}
              </span>
            </div>
            <SpeakButton text={word.kana} size="lg" />
          </div>
          {phase === "answer" && missed ? (
            <p className={app.note}>
              {t.read.typed}{" "}
              <span className="t-ja" lang="ja">
                {missed}
              </span>
            </p>
          ) : null}
          {word.gloss ? (
            <p className={styles.gloss} lang={glossLang(word)}>
              {glossText(word)}
            </p>
          ) : null}
          <Roots word={word} notes={before ? rootNotes(before) : undefined} grow={phase === "read"} />
          {notes.length > 0 ? (
            <ul className={styles.notes}>
              {notes.map((n) => (
                <li key={`${n.char}${n.here}`}>{t.read.variant(n.char, n)}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {phase === "read" ? (
        <>
          {mode === "new" ? (
            <p className={app.note}>
              {undone ? t.read.undone : t.read.collected}
              {undone ? null : (
                <button type="button" className={styles.quiet} onClick={undo}>
                  {t.read.undo}
                </button>
              )}
            </p>
          ) : null}
          <button type="button" className="btn" onClick={onNext} autoFocus>
            {t.read.next}
          </button>
        </>
      ) : (
        <>
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor="read-input" className="label">
              {phase === "ask" ? t.read.label : mode === "review" ? t.review.retype : t.read.retype}
            </label>
            <div className={styles.row}>
              <KanaInput
                id="read-input"
                className={styles.input}
                value={typed}
                onValue={(v) => {
                  setTyped(v);
                  setRetypeWrong(false);
                }}
                enterKeyHint="done"
                autoFocus={focus}
              />
              <button type="submit" className="btn" disabled={!typed.trim()}>
                {phase === "ask" ? t.read.submit : mode === "review" ? t.review.retypeSubmit : t.read.retypeSubmit}
              </button>
            </div>
            {retypeWrong ? (
              <p className={app.error} role="alert">
                {t.sheet.typeWrong(word.kana)}
              </p>
            ) : null}
          </form>
          <div className={styles.actions}>
            {phase === "ask" ? (
              <>
                <button
                  type="button"
                  className={styles.small}
                  disabled={!word.rt || hinted.size === chars.length}
                  onClick={() => setHinted(new Set(chars.map((_, i) => i)))}
                >
                  {t.read.hintAll}
                </button>
                <button type="button" className={styles.small} onClick={reveal}>
                  {t.read.reveal}
                </button>
              </>
            ) : null}
            <button type="button" className={styles.small} onClick={onNext}>
              {phase === "ask" ? (mode === "review" ? t.review.skip : t.read.skip) : t.read.next}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
