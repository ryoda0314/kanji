import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { discoverWords, unlockedBy, wordKey } from "../data/combine";
import { glossLang, glossText } from "../data/gloss";
import { dueWords } from "../data/stage";
import {
  guessKanji,
  inputKind,
  normalizeInput,
  resolveByKana,
  resolveByKanji,
  resolveKoreanGroups,
  resolveManual,
  resolveNear,
  resolveStem,
  type InputKind,
} from "../data/resolver";
import { hasParts, wordSounds } from "../data/sounds";
import type { ResolvedWord, WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, type CollectedWord } from "../db";
import { useChars, useSounds, useWords } from "../util/live";
import { readFallsTotal } from "../util/falls";
import { isIOS, isStandalone } from "../util/install";
import { hasServer } from "../util/usage";
import { CarryInto } from "../components/Carry";
import { EveryoneHint } from "../components/EveryoneHint";
import { Gain } from "../components/Gain";
import { InstallHint } from "../components/InstallHint";
import { KanaInput } from "../components/KanaInput";
import KanjiText from "../components/KanjiText";
import { Icon } from "../components/Icon";
import { PairLink } from "../components/Layout";
import { Logo } from "../components/Logo";
import { NearNext } from "../components/NearNext";
import { Roots, rootNotes } from "../components/Roots";
import { SpeakButton } from "../components/SpeakButton";
import { Sprout } from "../components/Sprout";
import { diffOf, koreanOf, WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import { DiffNote } from "../components/DiffNote";
import app from "../app.module.css";
import styles from "./Collect.module.css";

type Status =
  | { kind: "idle" }
  // stem：語尾を外すと辞書の語になった（べんきょうします の べんきょう）。
  | { kind: "candidates"; by: InputKind; words: ResolvedWord[]; stem?: { from: string; stem: string }; near?: string; korean?: KoreanExtra }
  | { kind: "resolved"; word: ResolvedWord; korean?: KoreanExtra }
  // 韓国語の漢字語が、日本語では同じ漢字の語にならない（편지 → 手紙）。日本語での言い方と、同じ漢字の語を出す。
  | ({ kind: "koreanOther" } & KoreanExtra)
  // manual：自分で登録する形を開いているか（漢字で打ったときは最初から）。
  | { kind: "notfound"; query: string; by: InputKind; manual: boolean }
  // unlocked：この語をあつめて新しく読めるようになった語（あつめる前の手持ちで数えておく）。
  | { kind: "collected"; word: ResolvedWord; before: number[]; unlocked: WordData[] };

/** 韓国語の漢字語で引いたときの、ほかの日本語の語（意味が同じで別の漢字・同じ漢字で意味を確かめたい語）。 */
interface KoreanExtra {
  query: string;
  meaning: ResolvedWord[];
  kanji: ResolvedWord[];
}

const OPENED_LIMIT = 6;

/**
 * あつめる：覚えた日本語の語を自分の指で打つと、漢字の根に分かれ、前に集めた語とつながる。
 * あつめた直後に、その字の音で新しく読めるようになった語が見える。ホームと追加を一つにした画面。
 */
export default function Collect() {
  const words = useWords();
  const chars = useChars();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [sheet, setSheet] = useState<Pick<WordData, "kanji" | "kana" | "gloss"> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const sounds = useSounds(words);
  // よく出会う字の音から（辞書に無い語の漢字を組み立てるときの候補の順）。
  const soundList = useMemo(() => {
    const count = new Map((chars ?? []).map((c) => [c.char, c.count]));
    return [...sounds].sort((a, b) => (count.get(b.split("|")[0]) ?? 0) - (count.get(a.split("|")[0]) ?? 0));
  }, [sounds, chars]);
  const readable = useMemo(() => (sounds.size ? discoverWords(sounds, ownedKeys, true) : []), [sounds, ownedKeys]);
  const due = useMemo(() => dueWords(words ?? [], Date.now()).length, [words]);
  // 일본어로 말할 수 있는 한자어：集めた語のうち同じ漢字語の語と、集めた音だけで言える語。
  const sayable = useMemo(() => (words ?? []).filter((w) => koreanOf(w)).length + readable.length, [words, readable]);

  function lookup(raw: string) {
    const q = normalizeInput(raw);
    if (!q) return;
    const by = inputKind(q);
    if (by === "korean") {
      // 韓国語の漢字語から：同じ漢字・同じ意味の日本語の語（학생 → 学生）。同じ音の漢字語が二つ以上なら選ぶ。
      const g = resolveKoreanGroups(q);
      const korean = { query: q, meaning: g.meaning, kanji: g.kanji };
      if (g.same.length === 1) setStatus({ kind: "resolved", word: g.same[0], korean });
      else if (g.same.length > 1) setStatus({ kind: "candidates", by, words: g.same, korean });
      else if (g.meaning.length || g.kanji.length) setStatus({ kind: "koreanOther", ...korean });
      else setStatus({ kind: "notfound", query: q, by, manual: false });
      return;
    }
    const found = by === "kana" ? resolveByKana(q) : by === "kanji" ? resolveByKanji(q) : [];
    if (found.length === 1) setStatus({ kind: "resolved", word: found[0] });
    else if (found.length > 0) setStatus({ kind: "candidates", by, words: found });
    else {
      // べんきょうします・がっこうに のように打っても、語の部分が辞書の語なら見つける。
      const stem = by === "kana" ? resolveStem(q) : null;
      // ときょ・はつぴょう：長音・促音の打ち違いを直すと辞書の語になる。
      const near = by === "kana" && !stem ? resolveNear(q) : [];
      if (stem) setStatus({ kind: "candidates", by, words: stem.words, stem: { from: q, stem: stem.stem } });
      else if (near.length) setStatus({ kind: "candidates", by, words: near, near: q });
      else setStatus({ kind: "notfound", query: q, by, manual: by === "kanji" });
    }
  }

  function resolve(e: FormEvent) {
    e.preventDefault();
    lookup(input);
  }

  /** 例の語を押した：打ったのと同じに引く。 */
  function tryWord(w: string) {
    setInput(w);
    lookup(w);
  }

  async function collect(word: ResolvedWord) {
    const before = await Promise.all(word.chars.map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
    const unlocked = unlockedBy(word, sounds, ownedKeys);
    if (!(await addWord(word))) {
      // もう持っている語（手で打った語が辞書の語と同じだったときなど）：そう言う画面へ。
      setStatus({ kind: "resolved", word });
      return;
    }
    setStatus({ kind: "collected", word, before, unlocked });
    setInput("");
  }

  function next() {
    setStatus({ kind: "idle" });
    setInput("");
    inputRef.current?.focus();
  }

  const findOwned = (w: Pick<WordData, "kanji" | "kana">) => words?.find((o) => wordKey(o) === wordKey(w)) ?? null;
  const hasWords = (words?.length ?? 0) > 0;

  return (
    <>
      <header className={`${app.topbar} ${app.mobileOnly}`}>
        <Logo size="sm" />
        <PairLink />
      </header>
      <div className={`${app.body} ${app.split}`}>
        <h1 className="sr-only">{t.collect.title}</h1>
        <div className={`${app.col} ${app.stick}`}>
          <div className={styles.intro}>
            <h2 className={styles.introTitle}>{t.collect.introTitle}</h2>
            {(words?.length ?? 0) < 3 ? <p className={app.lead}>{t.collect.lead}</p> : null}
          </div>

          <form className={styles.form} onSubmit={resolve}>
            <label htmlFor="collect-input" className="label">
              {t.collect.label}
            </label>
            <div className={styles.inputRow}>
              <KanaInput
                id="collect-input"
                ref={inputRef}
                className={styles.input}
                value={input}
                onValue={setInput}
                placeholder={t.collect.placeholder}
                enterKeyHint="search"
              />
              <button type="submit" className="btn" disabled={!input.trim()}>
                {t.collect.submit}
              </button>
            </div>
            <p className={app.note}>{t.collect.hint}</p>
            {(words?.length ?? 0) < 3 ? (
              <details className={styles.keyboard}>
                <summary>{t.collect.keyboard}</summary>
                <ul>
                  {t.collect.keyboardHow.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </form>
          {(words?.length ?? 0) < 3 && status.kind === "idle" ? <TryWords onTry={tryWord} /> : null}
        </div>

        <div className={app.col}>
          {status.kind === "candidates" ? (
            <section className={styles.block} aria-live="polite">
              <p className={styles.ask}>
                {status.stem
                  ? t.collect.stemFound(status.stem.from, status.stem.stem)
                  : status.near
                    ? t.collect.nearFound(status.near)
                    : status.by === "kanji"
                    ? t.collect.candidatesByKanji(status.words.length)
                    : status.by === "korean"
                      ? t.collect.candidatesByKorean(status.words.length)
                      : t.collect.candidates(status.words.length)}
              </p>
              <ul className={app.plainList}>
                {status.words.map((w) => (
                  <WordRow
                    key={wordKey(w)}
                    word={w}
                    meta={findOwned(w) ? t.collect.already(findOwned(w)!.addedAt) : undefined}
                    onOpen={() => setStatus({ kind: "resolved", word: w, korean: status.korean })}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {status.kind === "koreanOther" ? (
            <section className={styles.block} aria-live="polite">
              <p className={styles.ask}>{t.collect.koreanMeaningOnly(status.query)}</p>
              <KoreanExtras meaning={status.meaning} kanji={status.kanji} onOpen={(w) => setStatus({ kind: "resolved", word: w })} />
            </section>
          ) : null}

          {status.kind === "resolved" ? (
            <Found
              word={status.word}
              owned={findOwned(status.word)}
              gain={unlockedBy(status.word, sounds, ownedKeys).length}
              fresh={wordSounds(status.word).filter((s) => !sounds.has(s)).length}
              onCollect={() => collect(status.word)}
              onNext={next}
            />
          ) : null}
          {status.kind === "resolved" && status.korean ? (
            <KoreanExtras
              meaning={status.korean.meaning.filter((w) => wordKey(w) !== wordKey(status.word))}
              kanji={status.korean.kanji.filter((w) => wordKey(w) !== wordKey(status.word))}
              onOpen={(w) => setStatus({ kind: "resolved", word: w, korean: status.korean })}
            />
          ) : null}

          {status.kind === "notfound" ? (
            status.manual ? (
              <Manual query={status.query} by={status.by} sounds={soundList} onCollect={collect} />
            ) : (
              <NotFound query={status.query} by={status.by} onTry={tryWord} onManual={() => setStatus({ ...status, manual: true })} />
            )
          ) : null}

          {status.kind === "collected" ? (
            <Collected
              word={status.word}
              before={status.before}
              words={words ?? []}
              opened={status.unlocked}
              sounds={sounds}
              owned={ownedKeys}
              onOpen={setSheet}
              onNext={next}
            />
          ) : null}

          {words === undefined ? null : hasWords ? (
            <>
              <div className={styles.sayable}>
                <span className={styles.sayableNum}>{sayable}</span>
                <span className={styles.sayableText}>
                  <span className={styles.sayableTitle}>{t.collect.sayable}</span>
                  <span className={app.note}>{t.collect.sayableNote(sounds.size)}</span>
                </span>
              </div>
              <div className={styles.cards}>
                {readable.length > 0 ? (
                  <Link to="/find?view=read" className={styles.readable}>
                    <span className={styles.readableText}>
                      <span className={styles.readableTitle}>{t.collect.readable(readable.length)}</span>
                      <span className={app.note}>{t.collect.readableNote}</span>
                    </span>
                    <span className={styles.readableAction}>
                      {t.collect.readableAction}
                      <Icon name="arrow" size={18} />
                    </span>
                  </Link>
                ) : null}
                {due > 0 ? (
                  <Link to="/words?view=review" className={styles.readable}>
                    <span className={styles.readableText}>
                      <span className={styles.readableTitle}>{t.review.panel(due)}</span>
                      <span className={app.note}>{t.review.homeNote}</span>
                    </span>
                    <span className={styles.readableAction}>
                      {t.review.start}
                      <Icon name="arrow" size={18} />
                    </span>
                  </Link>
                ) : null}
                {hasServer() ? <EveryonePanel /> : null}
              </div>
              {hasServer() ? <EveryoneHint /> : null}
              {(words?.length ?? 0) >= 3 ? <InstallHint /> : null}
              <section>
                <div className={app.listHead}>
                  <h2>{t.collect.recent}</h2>
                  <Link to="/words" className={app.headLink}>
                    {t.collect.toWords}
                  </Link>
                </div>
                <ul className={app.plainList}>
                  {words.slice(0, 5).map((w) => (
                    <WordRow key={w.id} word={w} meta={t.common.ago(w.addedAt)} onOpen={() => setSheet(w)} />
                  ))}
                </ul>
              </section>
            </>
          ) : status.kind === "idle" ? (
            <>
              {words?.length === 0 && isIOS() && isStandalone() ? <CarryInto /> : null}
              <section className={styles.welcome}>
                <div className={styles.ground} aria-hidden="true">
                  <Sprout className={styles.sprout} />
                </div>
                <ol className={styles.steps} aria-label={t.collect.stepsLabel}>
                  {t.collect.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}
        </div>
      </div>

      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** みんなの雨への入口。この1時間にみんなが集めた語の数を添える（読めなければ数なしで）。 */
function EveryonePanel() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void readFallsTotal().then((n) => {
      if (active) setTotal(n);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link to="/find?view=everyone" className={styles.readable}>
      <span className={styles.readableText}>
        <span className={styles.readableTitle}>{total ? t.everyone.panel(total) : t.find.views.everyone}</span>
        <span className={app.note}>{t.everyone.panelNote}</span>
      </span>
      <span className={styles.readableAction}>
        {t.everyone.panelAction}
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  );
}

/**
 * 語の名前：同じ漢字・同じ意味の韓国語の語があれば、それから（학생 → 学生 がくせい）。読み上げ、意味。
 * 同じ漢字でも意味の違うかもしれない語は、意味と同じ漢字の韓国語の語を並べる（自分で見比べる）。
 * 手で確かめた、韓国語の語との意味・使い方のちがい（洋服 ↔ 양복）があれば、その下に。
 */
function Names({ word }: { word: WordData }) {
  const korean = koreanOf(word);
  const diff = diffOf(word);
  return (
    <>
      <div className={styles.head}>
        <div className={styles.names}>
          {korean ? (
            <span className={`${styles.koWord} t-ko`} lang="ko">
              {korean}
              <span className={styles.koArrow} aria-hidden="true">
                →
              </span>
            </span>
          ) : null}
          <h2 className={styles.big}>
            <KanjiText text={word.kanji} />
          </h2>
          <span className={`${styles.bigHanja} t-ja`} lang="ja">
            {word.kana}
          </span>
        </div>
        <SpeakButton text={word.kana} size="lg" />
      </div>
      {korean ? (
        <p className={diff ? `${styles.same} ${styles.sameDiff}` : styles.same}>
          {diff ? t.collect.koreanSameDiff : t.collect.koreanSame}
        </p>
      ) : word.gloss ? (
        <p className={styles.gloss} lang={glossLang(word)}>
          {word.en ? <span className={app.note}>{t.common.english} · </span> : null}
          {glossText(word)}
        </p>
      ) : null}
      {!korean && word.ko ? (
        <p className={app.note}>
          {t.sheet.cognate}{" "}
          <strong className="t-ko" lang="ko">
            {word.ko}
          </strong>
        </p>
      ) : null}
      {diff ? <DiffNote note={diff} label={!korean} /> : null}
    </>
  );
}

/** はじめての人のための、押せば引ける例の語（日本語のキーボードが無くても試せる）。 */
function TryWords({ onTry }: { onTry: (w: string) => void }) {
  return (
    <section className={styles.try} aria-labelledby="try-title">
      <h2 id="try-title" className="label">
        {t.collect.tryLabel}
      </h2>
      <div className={styles.tryChips}>
        {t.collect.tryWords.map((w) => (
          <button key={w} type="button" className={`${styles.tryChip} t-ko`} lang="ko" onClick={() => onTry(w)}>
            {w}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * 打った語が辞書に無い：かなだけの語（これ・ありがとう）は漢字が無い、韓国語は対訳の語が無い。
 * 何を集めるアプリかを言い、例の語を出す。辞書に無い語のこともあるので、自分で登録する形も開ける。
 */
function NotFound({ query, by, onTry, onManual }: { query: string; by: InputKind; onTry: (w: string) => void; onManual: () => void }) {
  return (
    <section className={styles.block} aria-live="polite">
      <p className={styles.ask}>{by === "korean" ? t.collect.koreanNone(query) : t.collect.notKanji(query)}</p>
      {by === "korean" ? null : <p className={app.note}>{t.collect.notKanjiLead}</p>}
      <TryWords onTry={onTry} />
      {by === "korean" ? null : (
        <button type="button" className={app.quietAction} onClick={onManual}>
          {t.collect.manualOpen}
          <Icon name="arrow" size={16} />
        </button>
      )}
    </section>
  );
}

/** 辞書で見つかった語：根に分けて見せ、あつめる。 */
function Found({
  word,
  owned,
  gain,
  fresh,
  onCollect,
  onNext,
}: {
  word: ResolvedWord;
  owned: CollectedWord | null;
  /** あつめると新しく読めるようになる語の数。 */
  gain: number;
  /** まだ集めていない字の音の数。 */
  fresh: number;
  onCollect: () => void;
  onNext: () => void;
}) {
  return (
    <section className={styles.block} aria-live="polite">
      <Names word={word} />
      <Roots word={word} />
      {hasParts(word) ? null : <p className={app.note}>{t.sheet.whole}</p>}
      {owned ? (
        <>
          <p className={styles.already}>{t.collect.already(owned.addedAt)}</p>
          <button type="button" className="btn-quiet" onClick={onNext}>
            {t.collect.next}
          </button>
        </>
      ) : (
        <>
          {gain > 0 ? (
            <Gain count={gain} when="before" />
          ) : (
            <p className={app.note}>{!hasParts(word) ? t.gain.whole : fresh === 0 ? t.gain.known : t.gain.firstRoots(fresh)}</p>
          )}
          <button type="button" className="btn" onClick={onCollect}>
            {t.collect.collect}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * あつめた直後：字ごとに、はじめてか、また出会ったか。新しく読めるようになった語の数（いちばん大きく）と、その語。
 * 前の語とのつながり。読める語が増えなかったときは、次に出会うと読める語。
 */
function Collected({
  word,
  before,
  words,
  opened,
  sounds,
  owned,
  onOpen,
  onNext,
}: {
  word: ResolvedWord;
  before: number[];
  words: CollectedWord[];
  opened: WordData[];
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: Pick<WordData, "kanji" | "kana" | "gloss">) => void;
  onNext: () => void;
}) {
  const self = wordKey(word);
  const links = word.chars
    .map((c, i) => ({ char: c, again: before[i] > 0, words: words.filter((w) => w.chars.includes(c) && wordKey(w) !== self) }))
    .filter((l, i, all) => l.again && l.words.length > 0 && all.findIndex((x) => x.char === l.char) === i);

  return (
    <section className={styles.block} aria-live="polite">
      <p className={styles.done}>
        <Icon name="check" size={18} />
        {t.collect.collectedTitle(koreanOf(word) ?? word.kanji)}
      </p>
      <Names word={word} />
      <Roots word={word} notes={rootNotes(before)} grow />
      {opened.length > 0 ? (
        <section className={styles.opened}>
          <Gain count={opened.length} when="after" />
          <ul className={`${app.plainList} ${styles.openedList}`}>
            {opened.slice(0, OPENED_LIMIT).map((w) => (
              <WordRow key={wordKey(w)} word={w} hideKana onOpen={() => onOpen(w)} />
            ))}
          </ul>
          {opened.length > OPENED_LIMIT ? (
            <Link to="/find?view=readable" className={app.quietAction}>
              {t.collect.openedMore(opened.length - OPENED_LIMIT)}
              <Icon name="arrow" size={16} />
            </Link>
          ) : null}
        </section>
      ) : (
        <NearNext kanji={word.kanji} sounds={sounds} owned={owned} onOpen={onOpen} />
      )}
      {links.length > 0 ? (
        <ul className={styles.links}>
          {links.map((l) => (
            <li key={l.char}>
              <span className={`hanja ${styles.linkChar}`} lang="ja">
                {l.char}
              </span>
              <span>
                {l.words.slice(0, 3).map((w, i) => (
                  <span key={w.id}>
                    {i > 0 ? "·" : ""}
                    <button type="button" className={`${styles.linkWord} hanja`} lang="ja" onClick={() => onOpen(w)}>
                      {w.kanji}
                    </button>
                  </span>
                ))}
                <span className={styles.linkTail}>{t.collect.rootLinked}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn-quiet" onClick={onNext}>
        {t.collect.next}
      </button>
    </section>
  );
}

/** 辞書に無い語：表記・読み・意味を自分で打って登録する。漢字は集めた字の音から組み立てた候補も出す。 */
function Manual({
  query,
  by,
  sounds,
  onCollect,
}: {
  query: string;
  by: InputKind;
  sounds: string[];
  onCollect: (w: ResolvedWord) => void;
}) {
  const [kanji, setKanji] = useState(by === "kanji" ? query : "");
  const [kana, setKana] = useState(by === "kana" ? query : "");
  const [gloss, setGloss] = useState("");
  const word = kanji.trim() && kana.trim() ? resolveManual(kanji, kana, gloss) : null;
  const guesses = guessKanji(kana, sounds);

  return (
    <section className={`${styles.block} ${styles.manual}`} aria-live="polite">
      <p className={styles.ask}>{t.collect.notFound(query)}</p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className="label">{t.collect.manualKana}</span>
          <KanaInput className={styles.fieldInput} value={kana} onValue={setKana} placeholder={t.collect.manualKanaPh} />
        </label>
        <label className={styles.field}>
          <span className="label">{t.collect.manualKanji}</span>
          <input
            className={`${styles.fieldInput} hanja`}
            lang="ja"
            value={kanji}
            onChange={(e) => setKanji(e.target.value)}
            placeholder={t.collect.manualKanjiPh}
            autoComplete="off"
          />
        </label>
        {guesses.length ? (
          <div className={styles.guess}>
            <span className={app.note}>{t.collect.manualGuess}</span>
            {guesses.map((g) => (
              <button
                key={g}
                type="button"
                className={g === kanji.trim() ? `${styles.guessChip} ${styles.guessOn}` : styles.guessChip}
                aria-pressed={g === kanji.trim()}
                onClick={() => setKanji(g)}
              >
                <span className="hanja" lang="ja">
                  {g}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <label className={styles.field}>
          <span className="label">{t.collect.manualGloss}</span>
          <input
            className={`${styles.fieldInput} t-ko`}
            lang="ko"
            value={gloss}
            onChange={(e) => setGloss(e.target.value)}
            placeholder={t.collect.manualGlossPh}
          />
        </label>
      </div>
      {word && word.chars.length > 0 ? <Roots word={word} /> : null}
      {word && word.chars.length > 0 && !hasParts(word) ? <p className={app.note}>{t.collect.manualNoParts}</p> : null}
      <button type="button" className="btn" disabled={!word || word.chars.length === 0} onClick={() => word && onCollect(word)}>
        {t.collect.collect}
      </button>
    </section>
  );
}

/**
 * 韓国語の漢字語で引いたときの、ほかの日本語の語：意味は同じで日本語では別の漢字の語（공부 → 勉強）と、同じ漢字で意味を確かめたい語
 * （공부 → 工夫 くふう 궁리）。意味が違うと言い切らず、意味を並べて自分で見比べる。押すとその語に替わる。
 */
function KoreanExtras({
  meaning,
  kanji,
  onOpen,
}: {
  meaning: ResolvedWord[];
  kanji: ResolvedWord[];
  onOpen: (w: ResolvedWord) => void;
}) {
  if (meaning.length === 0 && kanji.length === 0) return null;
  return (
    <>
      {meaning.length ? (
        <section className={styles.extra}>
          <h3 className="label">{t.collect.koreanMeaning}</h3>
          <ul className={app.plainList}>
            {meaning.map((w) => (
              <WordRow key={wordKey(w)} word={w} onOpen={() => onOpen(w)} />
            ))}
          </ul>
        </section>
      ) : null}
      {kanji.length ? (
        <section className={styles.extra}>
          <h3 className="label">{t.collect.koreanKanji}</h3>
          <ul className={app.plainList}>
            {kanji.map((w) => (
              <WordRow key={wordKey(w)} word={w} onOpen={() => onOpen(w)} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
