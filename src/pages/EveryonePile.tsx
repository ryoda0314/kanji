import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { Pile, SLOPE } from "../data/pile";
import { markStatus } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { readFalls, type Fall } from "../util/falls";
import app from "../app.module.css";
import styles from "./EveryonePile.module.css";

/** 新しく降った分を読みに行く間（ミリ秒）。 */
const POLL = 8000;
/** 開いたとき、積もった山の上に降らせる新しい語の数（ほかのこの1時間の分は、はじめから積もっている）。 */
const INTRO = 8;
/** 一つずつ降らせる間。待っている語が多いときは速く。 */
const SPAWN = 650;
const SPAWN_FAST = 200;
/** 落ちるのにかかる時間（速くなりながら落ちる）。 */
const FALL = 1000;
/** 積もった語は1時間で溶ける（山は「この1時間」の分）。溶けたかを見る間。 */
const HOUR = 60 * 60 * 1000;
const MELT = 60 * 1000;
/** 札の大きさ：高さと、すき間と、ハングル1字の幅と、左右の余白（字の幅から札の幅を決めて、山の形を先に計る）。 */
const CHIP_H = 22;
const GAP = 2;
const CHAR_W = 13.2;
const PAD = 14;
/** ふだんは、山の頂が下から この割合の高さに来るように見せる（上は雨の降る空）。 */
const SURFACE = 0.45;
/** 山の裾野の広さに足すゆとり（札は隙間なくは並ばない）と、広げ直すまでの余裕。 */
const PACKING = 1.25;
const REGROW = 1.15;

interface Item {
  /** 降った順の番号（積み直すときは、この順に落とす）。 */
  key: number;
  word: WordData;
  /** 集められた時。 */
  at: number;
  /** 落ちる横の位置（0〜1。真ん中ほど多い）と、左右に同じくらい低い所があるときに転がる向き。 */
  u: number;
  side: number;
  /** 札の幅。 */
  w: number;
}
interface Placed extends Item {
  x: number;
  y: number;
  /** 降ってきて積もった（はじめから積もっていた語でない）。着いたときの印を付ける。 */
  fell: boolean;
}
interface Falling extends Placed {
  /** 落ちはじめる高さ。 */
  from: number;
}

const itemOf = (fall: Fall, key: number): Item => ({
  key,
  word: fall.word,
  at: fall.at,
  u: (Math.random() + Math.random()) / 2,
  side: Math.random() < 0.5 ? -1 : 1,
  w: Math.round(Array.from(fall.word.kanji).length * CHAR_W + PAD),
});

/** 札を山に落として、止まった所（左端と下の縁）。 */
function spotOf(p: Pile, item: Item): { x: number; y: number } {
  const spot = p.drop(item.u * Math.max(0, p.width - item.w - GAP), item.w + GAP, CHIP_H + GAP, item.side);
  return { x: spot.x, y: spot.y };
}

/** これだけの札が、傾き SLOPE の山になって収まる地面の幅（舞台より狭くはしない）。 */
function roomFor(items: Item[], stageWidth: number): number {
  const area = items.reduce((sum, i) => sum + (i.w + GAP) * (CHIP_H + GAP), 0);
  return Math.max(stageWidth, Math.ceil(2 * Math.sqrt((PACKING * area) / SLOPE)));
}

/**
 * 見せ方：ふだんは山の頂の辺り（真ん中）を。全体を見るときは山ぜんぶ（幅も高さも）が入るまで縮め、舞台の高さも
 * 山に合わせて低くする（空ばかりにならないように）。stage はふだんの舞台の大きさ。
 */
function camera(top: number, stage: { width: number; height: number }, world: number, overview: boolean) {
  if (overview) {
    const scale = Math.min(1, (stage.height - 32) / Math.max(1, top), (stage.width - 16) / Math.max(1, world));
    return { scale, offset: 0, height: Math.min(stage.height, Math.max(240, Math.ceil(top * scale + 72))) };
  }
  return { scale: 1, offset: Math.max(0, top - stage.height * SURFACE), height: stage.height };
}

/**
 * みんなの雨の「積もる雨」の見え方（ふだんは一覧。pages/Everyone で切り替える）：この1時間に、みんなが集めた語が雨になって
 * 降り、下に積もって山になる。開いたときはこの1時間の分が積もっていて、新しく集められた語が届きしだい、その上に降る。
 * 積もった語は1時間で溶ける。山の地面は語の数に合わせて広げる（舞台より広くなる）。ふだんは山の頂の辺りを見せ、
 * 「全体を見る」で山ぜんぶが入るまで縮める。積もった語を押すと開く（集めていない語は、ほかと同じく漢字を ？？ で伏せる）。
 * 動きを減らす設定では、降らずにすぐ積もる。
 */
export function EveryonePile({
  sounds,
  owned,
  onOpen,
}: {
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: WordData) => void;
}) {
  // undefined：読んでいる、null：読めない
  const [total, setTotal] = useState<number | null | undefined>(undefined);
  const [latest, setLatest] = useState<WordData | null>(null);
  const [overview, setOverview] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const reduce = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  const stage = useRef<HTMLDivElement>(null);
  const pile = useRef<Pile | null>(null);
  const placed = useRef<Placed[]>([]);
  const falling = useRef<Falling[]>([]);
  /** 積もり終えた札でいちばん高い所（見せ方はこれに合わせる。落ちている札の分は、着いてから）。 */
  const landedTop = useRef(0);
  const waiting = useRef<Item[]>([]);
  /** 舞台の幅が決まる前に届いた、はじめから積もっている分。 */
  const early = useRef<Item[]>([]);
  const nextKey = useRef(0);
  /** ふだんの舞台の大きさ（全体を見ている間は舞台を低くするので、低くする前の高さを覚えておく）。 */
  const sizeRef = useRef(size);
  const overviewRef = useRef(overview);
  overviewRef.current = overview;

  /** 地面を語の数に合わせて広げ直し、降った順に積み直す（落ちている札は、その場で積もらせる）。 */
  const restack = useCallback((stageWidth: number, extra: Placed[] = []) => {
    const all = [...placed.current, ...falling.current, ...extra].sort((a, b) => a.key - b.key);
    const p = new Pile(roomFor([...all, ...waiting.current], stageWidth));
    placed.current = all.map((c) => ({ ...c, ...spotOf(p, c) }));
    falling.current = [];
    pile.current = p;
    landedTop.current = p.top();
    rerender();
  }, []);

  /** 地面が狭くなっていれば広げ直す。広げ直したら true。 */
  const roomy = useCallback(
    (more: Item[]) => {
      const p = pile.current;
      const stageWidth = sizeRef.current.width;
      if (!p || !stageWidth) return false;
      const need = roomFor([...placed.current, ...falling.current, ...waiting.current, ...more], stageWidth);
      return need <= p.width * REGROW;
    },
    []
  );

  /** すぐ積もらせる（はじめから積もっている分・動きを減らす設定）。 */
  const settle = useCallback(
    (items: Item[], fell: boolean) => {
      const p = pile.current;
      if (!p) {
        early.current.push(...items);
        return;
      }
      const chips = items.map((item) => ({ ...item, fell, x: 0, y: 0 }));
      if (!roomy(items)) {
        restack(sizeRef.current.width, chips);
        return;
      }
      for (const chip of chips) placed.current.push({ ...chip, ...spotOf(p, chip) });
      landedTop.current = p.top();
      rerender();
    },
    [restack, roomy]
  );

  /**
   * 一つ降らせる。止まる所は先に決めておき（あとから降る札は、その上に載る）、着いたら積もった札にする。
   * ふだんの見せ方では、見えている真ん中の辺りに降らせる（そこから山の斜面を転がることはある）。
   */
  const rain = useCallback(
    (item: Item) => {
      if (reduce) {
        settle([item], true);
        setLatest(item.word);
        return;
      }
      if (!roomy([item])) restack(sizeRef.current.width);
      const p = pile.current;
      if (!p) return;
      const stageSize = sizeRef.current;
      const { scale, offset, height } = camera(landedTop.current, stageSize, p.width, overviewRef.current);
      const visible = overviewRef.current ? 1 : Math.min(1, (stageSize.width * 0.9) / p.width);
      const aimed = { ...item, u: 0.5 + (item.u - 0.5) * visible };
      falling.current.push({ ...aimed, ...spotOf(p, aimed), fell: true, from: offset + height / scale + 24 });
      rerender();
    },
    [reduce, restack, roomy, settle]
  );

  const land = useCallback((key: number) => {
    const at = falling.current.findIndex((f) => f.key === key);
    if (at < 0) return;
    const [chip] = falling.current.splice(at, 1);
    placed.current.push(chip);
    landedTop.current = Math.max(landedTop.current, chip.y + CHIP_H + GAP);
    setLatest(chip.word);
    rerender();
  }, []);

  // 舞台の大きさ。幅が決まったら山を作り、変わったら積み直す。
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      // 全体を見ている間の高さは、山に合わせて低くしたもの。ふだんの高さはそのまま覚えておく。
      const height = overviewRef.current ? sizeRef.current.height : Math.round(entry.contentRect.height);
      const before = sizeRef.current.width;
      sizeRef.current = { width, height };
      setSize({ width, height });
      if (!width) return;
      if (!pile.current) restack(width, early.current.splice(0).map((item) => ({ ...item, fell: false, x: 0, y: 0 })));
      else if (width !== before) restack(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [restack]);

  // 読む：はじめはこの1時間の分（新しい INTRO 語のほかは、はじめから積もっている）、そのあとは数秒ごとに新しい分。
  useEffect(() => {
    let active = true;
    let last = 0;
    async function read(first: boolean) {
      const result = await readFalls(last);
      if (!active) return;
      if (!result) {
        if (first) setTotal(null);
        return;
      }
      setTotal(result.total);
      if (!result.falls.length) return;
      last = Math.max(last, ...result.falls.map((f) => f.id));
      // 新しい順で届くので、古い順にする（古い語から積もり、新しい語が上に来る）。
      const items = [...result.falls].reverse().map((f) => itemOf(f, nextKey.current++));
      if (first) {
        waiting.current.push(...items.slice(-INTRO));
        settle(items.slice(0, -INTRO), false);
      } else {
        waiting.current.push(...items);
      }
    }
    void read(true);
    const timer = window.setInterval(() => void read(false), POLL);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [settle]);

  // 降らせる：待っている語を一つずつ。
  useEffect(() => {
    let timer = 0;
    const next = () => {
      if (pile.current && waiting.current.length) rain(waiting.current.shift()!);
      timer = window.setTimeout(next, waiting.current.length > 10 ? SPAWN_FAST : SPAWN);
    };
    timer = window.setTimeout(next, 400);
    return () => window.clearTimeout(timer);
  }, [rain]);

  // 溶ける：1時間たった語を除いて、積み直す。
  useEffect(() => {
    const timer = window.setInterval(() => {
      const before = placed.current.length;
      placed.current = placed.current.filter((c) => c.at > Date.now() - HOUR);
      if (placed.current.length !== before && sizeRef.current.width) restack(sizeRef.current.width);
    }, MELT);
    return () => window.clearInterval(timer);
  }, [restack]);

  // 背景の雨の筋（飾り。動きを減らす設定では出さない）。
  const streaks = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${-Math.random() * 1.2}s`,
        animationDuration: `${0.75 + Math.random() * 0.5}s`,
      })),
    []
  );

  const world = pile.current?.width ?? size.width;
  const { scale, offset, height } = camera(landedTop.current, size, world, overview);
  const big = world > size.width + 1 || landedTop.current > size.height * (1 - SURFACE);
  const status = (w: WordData) => markStatus(w, sounds, owned);
  const place = (c: Placed) => ({ left: c.x + GAP / 2, bottom: c.y, width: c.w });

  return (
    <div className={styles.wrap}>
      {total === null ? (
        <p className={app.error}>{t.everyone.failed}</p>
      ) : (
        <>
          <div className={styles.head}>
            <p className={styles.count}>
              {total === undefined ? (
                t.everyone.loading
              ) : (
                <>
                  {t.everyone.totalBefore}
                  <b>{total}</b>단어
                </>
              )}
            </p>
            <p className={styles.now} aria-live="polite">
              {latest ? (
                <>
                  <span className={styles.nowLabel}>{t.everyone.now}</span>
                  <span className={`${styles.nowWord} hanja`} lang="ja">
                    {latest.kanji}
                  </span>
                  {status(latest) === "readable" ? null : (
                    <span className={`${styles.nowHanja} t-ja`} lang="ja">
                      {latest.kana}
                    </span>
                  )}
                </>
              ) : null}
            </p>
          </div>

          <div ref={stage} className={styles.stage} style={overview ? { height } : undefined}>
            {reduce ? null : (
              <div className={styles.streaks} aria-hidden="true">
                {streaks.map((s, i) => (
                  <span key={i} className={styles.streak} style={s} />
                ))}
              </div>
            )}
            <div
              className={styles.world}
              style={{
                width: world,
                marginLeft: -world / 2,
                transform: overview ? `scale(${scale})` : `translateY(${offset}px)`,
              }}
            >
              {placed.current.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`${styles.chip} ${styles[status(c.word)]} ${c.fell ? styles.fell : ""}`}
                  style={place(c)}
                  onClick={() => onOpen(c.word)}
                  lang="ja"
                >
                  {c.word.kanji}
                </button>
              ))}
              {falling.current.map((f) => (
                <Drop key={f.key} drop={f} className={`${styles.chip} ${styles.drop} ${styles[status(f.word)]}`} style={place(f)} onLand={land} />
              ))}
            </div>
            {total === 0 && placed.current.length === 0 ? <p className={styles.quiet}>{t.everyone.quiet}</p> : null}
          </div>

          {big || overview ? (
            <div className={styles.tools}>
              <button type="button" className={`btn-quiet ${styles.toggle}`} onClick={() => setOverview((v) => !v)} aria-pressed={overview}>
                {overview ? t.everyone.closeup : t.everyone.overview}
              </button>
              <span className={styles.piled}>{t.everyone.piled(placed.current.length)}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** 落ちている札：止まる所より上（from）から、速くなりながら落ちて、着いたら知らせる。 */
function Drop({
  drop,
  className,
  style,
  onLand,
}: {
  drop: Falling;
  className: string;
  style: CSSProperties;
  onLand: (key: number) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.animate) {
      onLand(drop.key);
      return;
    }
    const fall = el.animate([{ transform: `translateY(${drop.y - drop.from}px)` }, { transform: "translateY(0)" }], {
      duration: FALL,
      easing: "cubic-bezier(0.55, 0, 1, 0.45)",
      fill: "backwards",
    });
    fall.onfinish = () => onLand(drop.key);
    return () => {
      fall.onfinish = null;
      fall.cancel();
    };
  }, [drop.key, drop.from, drop.y, onLand]);

  return (
    <span ref={ref} className={className} style={style} aria-hidden="true" lang="ja">
      {drop.word.kanji}
    </span>
  );
}
