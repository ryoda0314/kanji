import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";

export const FPS = 30;

/** 秒 → コマ。 */
export const f = (seconds: number) => Math.round(seconds * FPS);

// アプリの雨（Meet.module.css）：上から降ってきて落ち着く。ことのあめ・ことのね と同じ。
export const FALL = Easing.bezier(0.2, 0.8, 0.3, 1);
export const SOFT = Easing.bezier(0.33, 0, 0.2, 1);

/** `start` から `dur` コマで 0 → 1。 */
export function prog(frame: number, start: number, dur: number, easing: (t: number) => number = FALL): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** 上から降ってくる。 */
export function fall(frame: number, start: number, dist = 18, dur = f(0.55)): CSSProperties {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * -dist}px)` };
}

/** 下からせり上がる（根が伸びるように）。 */
export function rise(frame: number, start: number, dist = 14, dur = f(0.6)): CSSProperties {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

/** 少し上がりながら、静かに消える。 */
export function leave(frame: number, start: number, dur = f(0.4), dist = 10): CSSProperties {
  const p = prog(frame, start, dur, SOFT);
  return { opacity: 1 - p, transform: `translateY(${p * -dist}px)` };
}

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** 色から色へ（どちらも #rrggbb）。 */
export function mixColor(a: string, b: string, p: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${ca.map((x, i) => Math.round(mix(x, cb[i], p))).join(",")})`;
}

// ---- ハングルを打つ：韓国語の入力のとおり、字母を一つずつ打って音節に組み上がる -------------------------------
// 학생 は ㅎ → 하 → 학 → 핛（ㅅ がいったん 학 の下に付く）→ 학새 → 학생。

const L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const T = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CLUSTER: Record<string, string> = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};
/** 二つの字母で打つ母音の、はじめの字母（ㅘ・ㅙ・ㅚ は ㅗ、ㅝ・ㅞ・ㅟ は ㅜ、ㅢ は ㅡ。中声の番号で）。 */
const FIRST_VOWEL: Record<number, number> = { 9: 8, 10: 8, 11: 8, 14: 13, 15: 13, 16: 13, 19: 18 };
const compose = (l: number, v: number, t = 0) => String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
const partsOf = (s: string) => {
  const c = s.charCodeAt(0) - 0xac00;
  return { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 };
};

/** 打っている途中の見え方を、一打ちずつ。회의 は ㅎ → 호 → 회 → 횡 → 회으 → 회의。 */
export function koSteps(word: string): string[] {
  const steps: string[] = [];
  const syl = [...word];
  let done = "";
  syl.forEach((s, i) => {
    const { l, v, t } = partsOf(s);
    const initial = L[l];
    if (i > 0) {
      // 初声は、いったん前の音節の終声（またはその重ね）として付く。
      const p = partsOf(syl[i - 1]);
      const final = T[p.t];
      const joined = final ? CLUSTER[final + initial] : T.indexOf(initial) > 0 ? initial : undefined;
      steps.push(joined ? done.slice(0, -1) + compose(p.l, p.v, T.indexOf(joined)) : done + initial);
    } else {
      steps.push(done + initial);
    }
    // 二つの字母で打つ母音（ㅚ = ㅗ + ㅣ）は、はじめの字母でいったん音節になる。
    if (v in FIRST_VOWEL) steps.push(done + compose(l, FIRST_VOWEL[v]));
    steps.push(done + compose(l, v));
    if (t) steps.push(done + compose(l, v, t));
    done += s;
  });
  return steps;
}

export type Typing = { word: string; steps: string[]; at: number[]; duration: number };

/** 一打ちずつの見え方に、打つ時を付ける。`per`：一打ちのコマ数（ときどき少し長く）。 */
function timed(word: string, steps: string[], per: number): Typing {
  const at: number[] = [];
  let t = 0;
  steps.forEach((_, i) => {
    t += per + (i % 4 === 2 ? 2 : 0);
    at.push(t);
  });
  return { word, steps, at, duration: t };
}

export function koTyping(word: string, per = 4): Typing {
  return timed(word, koSteps(word), per);
}

// ---- 日本語をローマ字で打つ：アプリの打つ欄（KanaInput）のとおり、音になったところからかなに変わる -----------------
// kyoukai は k → ky → きょ → きょう → きょうk → きょうか → きょうかい。

const VOWEL = { a: 0, i: 1, u: 2, e: 3, o: 4 } as const;
const ROWS: Record<string, string> = {
  "": "あいうえお", k: "かきくけこ", g: "がぎぐげご", s: "さしすせそ", z: "ざじずぜぞ", t: "たちつてと", d: "だぢづでど",
  n: "なにぬねの", h: "はひふへほ", b: "ばびぶべぼ", p: "ぱぴぷぺぽ", m: "まみむめも", r: "らりるれろ", y: "や-ゆ-よ", w: "わ---を",
};
const YOON: Record<string, string> = { ky: "き", gy: "ぎ", sh: "し", j: "じ", ch: "ち", ny: "に", hy: "ひ", by: "び", py: "ぴ", my: "み", ry: "り" };
const SMALL = { a: "ゃ", u: "ゅ", o: "ょ" } as const;
/** 行の決まりに入らない音（し・ち・つ・じ・ふ）。 */
const ODD: Record<string, string> = { shi: "し", chi: "ち", tsu: "つ", ji: "じ", fu: "ふ" };

/** 打ったところまでのローマ字を、かなに（まだ音にならない子音は、そのまま残る）。 */
export function romajiToKana(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const odd = Object.keys(ODD).find((r) => rest.startsWith(r));
    if (odd) {
      out += ODD[odd];
      i += odd.length;
      continue;
    }
    const yoon = Object.keys(YOON).find((c) => rest.startsWith(c) && rest[c.length] in SMALL);
    if (yoon) {
      out += YOON[yoon] + SMALL[rest[yoon.length] as keyof typeof SMALL];
      i += yoon.length + 1;
      continue;
    }
    const v = rest[0] in VOWEL ? "" : rest[0];
    const vowel = rest[v.length] as keyof typeof VOWEL;
    const kana = vowel in VOWEL ? ROWS[v]?.[VOWEL[vowel]] : undefined;
    if (kana && kana !== "-") {
      out += kana;
      i += v.length + 1;
    } else if (v && v === rest[1] && v !== "n") {
      out += "っ";
      i += 1;
    } else if (v === "n" && rest.length > 1 && !(rest[1] in VOWEL) && rest[1] !== "y") {
      out += "ん";
      i += rest[1] === "n" ? 2 : 1;
    } else {
      out += rest[0];
      i += 1;
    }
  }
  return out;
}

/** ローマ字で打つ（`romaji`）。見え方はかなに変わっていく。 */
export function jaTyping(romaji: string, per = 4): Typing {
  return timed(romajiToKana(romaji), [...romaji].map((_, i) => romajiToKana(romaji.slice(0, i + 1))), per);
}

/** `frame`（打ちはじめからのコマ）での見え方。 */
export function typedAt(typing: Typing, frame: number): string {
  let text = "";
  typing.at.forEach((a, i) => {
    if (frame >= a) text = typing.steps[i];
  });
  return text;
}
