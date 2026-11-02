// A の続き：소리 짝 のつながりの網。회・사・원 の三つの札が輪に移り、ほかの 21 の 소리 짝 が並ぶ。語が組み上がるたび、
// その 소리 짝 と 소리 짝 が線で結ばれる。一つずつ（학생・대학・선생・시간・전화・한국어・외국인、日本語の声と一緒に）、
// それから残りが一気に。소리 짝 24개로, 55단어。짝と語はアプリの辞書のとおり（scripts/net.mjs が src/net.json に書く）。
import { mix, mixColor, prog, SOFT } from "../anim";
import NET from "../net.json";
import { NET_AT, T } from "../timeline";
import { C, FONT } from "../theme";

type P = { x: number; y: number };

const N = NET.pairs.length;
const CENTER: P = { x: 960, y: 590 };
const RX = 760;
const RY = 330;
/** 冒頭の札の幅。輪の上ではこれだけ縮む。 */
const TILE_W = 240;
const RING_SCALE = 0.42;
const FIRST = NET.first;
const SLOW_END = NET.first + NET.slow;

/** 輪の上の位置：楕円を弧の長さで等分して、上から時計回りに。 */
const RING: P[] = (() => {
  const steps = 3600;
  const pts: P[] = [];
  const len = [0];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / steps;
    pts.push({ x: CENTER.x + RX * Math.cos(t), y: CENTER.y + RY * Math.sin(t) });
    if (i > 0) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return Array.from({ length: N }, (_, k) => {
    const want = (len[steps] * k) / N;
    let i = 0;
    while (len[i] < want) i++;
    return pts[i];
  });
})();

const INDEX = new Map(NET.pairs.map((p, k) => [p.key, k]));
/** 冒頭の三つの札（左から 회 かい・사 しゃ・원 いん）の位置。 */
const HOOK = ["会|かい", "社|しゃ", "員|いん"].map((key, i) => ({ k: INDEX.get(key)!, at: { x: 960 + (i - 1) * (TILE_W + 44), y: 470 } }));

/** 線：語の中で隣り合う 소리 짝 の組ごとに一本、少し内へたわむ曲線。その組を使う語の番号（はじめが、線の描き出し）。 */
type Line = { A: P; Q: P; B: P; d: string; len: number; words: number[] };
const pointOn = (l: Line, t: number): P => ({
  x: (1 - t) * (1 - t) * l.A.x + 2 * (1 - t) * t * l.Q.x + t * t * l.B.x,
  y: (1 - t) * (1 - t) * l.A.y + 2 * (1 - t) * t * l.Q.y + t * t * l.B.y,
});
function line(A: P, B: P): Line {
  const Q = { x: mix((A.x + B.x) / 2, CENTER.x, 0.3), y: mix((A.y + B.y) / 2, CENTER.y, 0.3) };
  const l: Line = { A, Q, B, d: `M${A.x} ${A.y} Q${Q.x} ${Q.y} ${B.x} ${B.y}`, len: 0, words: [] };
  for (let i = 1; i <= 24; i++) {
    const a = pointOn(l, (i - 1) / 24);
    const b = pointOn(l, i / 24);
    l.len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return l;
}
const LINES = new Map<string, Line>();
/** 語ごとの線。 */
const WORD_LINES: Line[][] = NET.words.map((w, wi) => {
  const ks = w.pairs.map((p) => INDEX.get(p)!);
  const mine: Line[] = [];
  for (let i = 1; i < ks.length; i++) {
    if (ks[i - 1] === ks[i]) continue;
    const [a, b] = [ks[i - 1], ks[i]].sort((x, y) => x - y);
    const key = `${a}-${b}`;
    if (!LINES.has(key)) LINES.set(key, line(RING[a], RING[b]));
    LINES.get(key)!.words.push(wi);
    mine.push(LINES.get(key)!);
  }
  return mine;
});

/** 一気の語のうち、言葉の札を出す語：よく使う語（JLPT の一覧にある語）。ほかの語も線は光り、数には入る。 */
const LABELED = (w: (typeof NET.words)[number]) => w.lv !== null && w.lv <= 3;
/** 札が出ている長さ（コマ）。 */
const LABEL_LIFE = 16;
/**
 * 一気の語の札の置き所：その語の線の上で、짝の札とも、同じころに出るほかの札とも重なりの少ない所。
 * 網の真ん中は数のために空けておく。
 */
const LABEL_AT: (P | null)[] = (() => {
  type Box = P & { w: number; h: number };
  const area = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) *
    Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
  const tiles: Box[] = RING.map((p) => ({ ...p, w: TILE_W * RING_SCALE + 12, h: 290 * RING_SCALE + 12 }));
  const placed: (Box & { at: number })[] = [];
  return NET.words.map((w, wi) => {
    if (wi < SLOW_END || !LABELED(w)) return null;
    const size = { w: [...w.ko].length * 25 + [...w.kana].length * 20 + 40, h: 44 };
    let best: Box | null = null;
    let bestScore = Infinity;
    for (const l of WORD_LINES[wi]) {
      for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
        const p = pointOn(l, t);
        const box = { x: mix(p.x, CENTER.x, 0.12), y: mix(p.y, CENTER.y, 0.12), ...size };
        if (Math.abs(box.x - CENTER.x) < 190 + size.w / 2 && Math.abs(box.y - CENTER.y) < 64 + size.h / 2) continue;
        let score = Math.abs(t - 0.5) * 1500;
        for (const tile of tiles) score += 3 * area(box, tile);
        for (const other of placed) if (Math.abs(other.at - NET_AT[wi]) < LABEL_LIFE) score += 2 * area(box, other);
        if (score < bestScore) {
          bestScore = score;
          best = box;
        }
      }
    }
    if (best) placed.push({ ...best, at: NET_AT[wi] });
    return best;
  });
})();

/** 語が組み上がったときの光（0 → 1 → 0）。一つずつの語はゆっくり、一気の語はすばやく。 */
function pulse(frame: number, wi: number) {
  const at = NET_AT[wi];
  return wi < SLOW_END ? prog(frame, at, 4) * (1 - prog(frame, at + 8, 6)) : prog(frame, at, 2) * (1 - prog(frame, at + 4, 10));
}

/** 소리 짝 の札：韓国語の音、漢字、日本語の音。 */
export function PairTile({ k, x, y, scale, glow, opacity = 1 }: { k: number; x: number; y: number; scale: number; glow: number; opacity?: number }) {
  const p = NET.pairs[k];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: TILE_W,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 0 18px",
        border: `2px solid ${mixColor(C.line2, C.accent, glow)}`,
        borderRadius: 26,
        background: mixColor(C.paper, C.tint, glow),
      }}
    >
      <span style={{ fontFamily: FONT.ko, fontSize: 58, fontWeight: 600, lineHeight: 1.2, color: mixColor(C.ink, C.accent, glow) }}>{p.eum}</span>
      <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 108, lineHeight: 1.18 }}>{p.char}</span>
      <span style={{ fontFamily: FONT.ja, fontSize: 40, fontWeight: 600, lineHeight: 1.3, color: C.accent }}>{p.reading}</span>
    </div>
  );
}

const big = { margin: 0, fontWeight: 600, letterSpacing: "0.01em", fontFamily: FONT.ko, textAlign: "center", whiteSpace: "nowrap" } as const;

/**
 * 網。`hookGlow`：冒頭で語が組み上がるときの、三つの札（회・사・원）の光。
 * 網の前（net まで）は、三つの札だけを冒頭の位置に置く。
 */
export function Web({ frame, hookGlow }: { frame: number; hookGlow: number[] }) {
  const t = T.hook;
  const glowOf = (k: number) => {
    let g = 0;
    NET.words.forEach((w, wi) => {
      if (NET_AT[wi] <= frame + 1 && w.pairs.includes(NET.pairs[k].key)) g = Math.max(g, pulse(frame, wi));
    });
    return g;
  };
  const morph = prog(frame, t.net, 22, SOFT);
  // ほかの 소리 짝 は、上（三つの札）から両側へ、根が伸びるように並ぶ。
  const others = NET.pairs.map((_, k) => k).filter((k) => !HOOK.some((h) => h.k === k));
  const rank = new Map([...others].sort((a, b) => Math.min(a, N - a) - Math.min(b, N - b) || a - b).map((k, i) => [k, i]));
  const count = NET_AT.filter((at) => at <= frame).length;
  const dim = 1 - 0.9 * prog(frame, t.known, 16, SOFT);
  const slow = NET.words.slice(FIRST, SLOW_END).map((w, i) => ({ w, at: NET_AT[FIRST + i], until: i + 1 < NET.slow ? NET_AT[FIRST + i + 1] : NET_AT[SLOW_END] }));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: dim }}>
      {frame >= t.net ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {[...LINES.values()].map((l, i) => {
            const drawn = prog(frame, NET_AT[l.words[0]] - 2, 8, SOFT);
            if (drawn <= 0) return null;
            const flash = Math.max(...l.words.map((wi) => (NET_AT[wi] <= frame + 1 ? pulse(frame, wi) : 0)));
            return (
              <path
                key={i}
                d={l.d}
                fill="none"
                stroke={C.accent}
                strokeOpacity={0.3 + 0.65 * flash}
                strokeWidth={1.8 + 2.6 * flash}
                strokeLinecap="round"
                strokeDasharray={l.len}
                strokeDashoffset={l.len * (1 - drawn)}
              />
            );
          })}
        </svg>
      ) : null}
      {/* 真ん中：語の名前、数、소리 짝 24개로 55단어 を読みやすく */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x - 500,
          top: CENTER.y - 150,
          width: 1000,
          height: 300,
          background: "radial-gradient(closest-side, rgba(252,251,248,0.96), rgba(252,251,248,0.9) 55%, rgba(252,251,248,0))",
          opacity: prog(frame, t.words - 6, 10),
        }}
      />
      {NET.pairs.map((_, k) => {
        const hook = HOOK.find((h) => h.k === k);
        if (hook) {
          const i = HOOK.indexOf(hook);
          const enter = prog(frame, t.tiles + i * 5, 18);
          const x = mix(hook.at.x, RING[k].x, morph);
          const y = mix(hook.at.y + (1 - enter) * 24, RING[k].y, morph);
          return <PairTile key={k} k={k} x={x} y={y} scale={mix(1, RING_SCALE, morph)} glow={Math.max(hookGlow[i] ?? 0, glowOf(k))} opacity={enter} />;
        }
        if (frame < t.net) return null;
        const pop = prog(frame, t.net + 8 + rank.get(k)! * 1.3, 10);
        return <PairTile key={k} k={k} x={RING[k].x} y={RING[k].y} scale={RING_SCALE * (0.75 + 0.25 * pop)} glow={glowOf(k)} opacity={pop} />;
      })}
      {/* 一気の語：組み上がった所に、言葉の札が一瞬 */}
      {NET.words.map((w, wi) => {
        const place = LABEL_AT[wi];
        const at = NET_AT[wi];
        if (!place || frame < at || frame > at + LABEL_LIFE) return null;
        const show = prog(frame, at, 3) * (1 - prog(frame, at + 6, LABEL_LIFE - 6));
        return (
          <span
            key={wi}
            style={{
              position: "absolute",
              left: place.x,
              top: place.y,
              transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * prog(frame, at, 3)})`,
              opacity: show,
              display: "inline-flex",
              alignItems: "baseline",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 999,
              border: `1.5px solid ${C.accent}`,
              background: "rgba(252,251,248,0.94)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: FONT.ko, fontSize: 24, fontWeight: 600 }}>{w.ko}</span>
            <span style={{ fontFamily: FONT.ja, fontSize: 20, color: C.accent }}>{w.kana}</span>
          </span>
        );
      })}
      {/* 一つずつの語の名前 */}
      {slow.map(({ w, at, until }) => {
        if (frame < at || frame > until + 4) return null;
        const show = prog(frame, at, 5) * (1 - prog(frame, until - 2, 5));
        return (
          <p key={w.ko} style={{ ...big, position: "absolute", left: 0, right: 0, top: CENTER.y - 58, opacity: show, transform: `translateY(${(1 - prog(frame, at, 8)) * 10}px)` }}>
            <span style={{ fontFamily: FONT.ko, fontSize: 72 }}>{w.ko}</span>
            <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 54, color: C.ink2, marginLeft: 26 }}>{w.kanji}</span>
            <span style={{ fontFamily: FONT.ja, fontWeight: 600, fontSize: 48, color: C.accent, marginLeft: 22 }}>{w.kana}</span>
          </p>
        );
      })}
      {/* 一気のあいだの数 */}
      {frame >= NET_AT[SLOW_END] - 2 && frame < t.total + 8 ? (
        <p style={{ ...big, position: "absolute", left: 0, right: 0, top: CENTER.y - 66, fontSize: 96, color: C.accent, opacity: prog(frame, NET_AT[SLOW_END] - 2, 4) * (1 - prog(frame, t.total, 8)) }}>
          {count}
          <span style={{ fontSize: 56, color: C.ink, marginLeft: 6 }}>단어</span>
        </p>
      ) : null}
      {/* 소리 짝 24개로, 55단어. */}
      <p
        style={{
          ...big,
          position: "absolute",
          left: 0,
          right: 0,
          top: CENTER.y - 54,
          fontSize: 76,
          opacity: prog(frame, t.total + 4, 14) * (1 - prog(frame, t.known, 8)),
          transform: `translateY(${(1 - prog(frame, t.total + 4, 16)) * -16}px)`,
        }}
      >
        소리 짝 <span style={{ color: C.accent }}>{N}</span>개로, <span style={{ color: C.accent }}>{NET.words.length}</span>단어.
      </p>
    </div>
  );
}
