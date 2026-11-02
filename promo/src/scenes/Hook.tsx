// A. 一語ずつ丸暗記していた日本語の単語（かいしゃ・しゃかい・かいいん・しゃいん・かいしゃいん）は、三つの 소리 짝
// （회 → かい・사 → しゃ・원 → いん）の組み合わせだった。単語カードが消えて三つの札が並び、語が一つずつ組み上がる
// （日本語の声と一緒に）。そのたびに使った札が光る。소리 짝 3개로, 5단어。
// そこから짝が増えて、つながりは網になる（Web.tsx：소리 짝 24개로, 55단어）。
import { fall, leave, prog, rise } from "../anim";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Web } from "./Web";

/** `uses`：組み上がるときに光る札（0 회 かい・1 사 しゃ・2 원 いん）。 */
const WORDS: { ko: string; kanji: string; kana: string; uses: number[] }[] = [
  { ko: "회사", kanji: "会社", kana: "かいしゃ", uses: [0, 1] },
  { ko: "사회", kanji: "社会", kana: "しゃかい", uses: [1, 0] },
  { ko: "회원", kanji: "会員", kana: "かいいん", uses: [0, 2] },
  { ko: "사원", kanji: "社員", kana: "しゃいん", uses: [1, 2] },
  { ko: "회사원", kanji: "会社員", kana: "かいしゃいん", uses: [0, 1, 2] },
];

const big = { margin: 0, fontSize: 62, fontWeight: 600, lineHeight: 1.45, letterSpacing: "0.005em", fontFamily: FONT.ko, textAlign: "center", wordBreak: "keep-all" } as const;

export function Hook({ frame }: { frame: number }) {
  const t = T.hook;
  const at = [t.w1, t.w2, t.w3, t.w4, t.w5];
  // その札が、いま組み上がった語に使われているか（光の強さ 0 → 1 → 0）。
  const glow = (i: number) => Math.max(...WORDS.map((w, k) => (w.uses.includes(i) ? prog(frame, at[k], 5) * (1 - prog(frame, at[k] + 12, 10)) : 0)));
  return (
    <>
      <Web frame={frame} hookGlow={[glow(0), glow(1), glow(2)]} />
      {/* 問い：最初のコマから見えている */}
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, ...(frame >= t.split ? leave(frame, t.split, 10, 12) : {}) }}>
        <p style={big}>일본어 단어,</p>
        <p style={big}>하나씩 통째로 외우고 있나요?</p>
      </div>
      {/* 一語ずつ覚えていた単語カード */}
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22, ...(frame >= t.split ? leave(frame, t.split, 12, 16) : {}) }}>
        {WORDS.map((w, i) => (
          <div
            key={w.ko}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 30px 20px",
              border: `1.5px solid ${C.line2}`,
              borderRadius: 18,
              background: C.paper,
              ...fall(frame, t.cards + i * 7, 18, 16),
            }}
          >
            <span style={{ fontFamily: FONT.ja, fontSize: 46, fontWeight: 600, lineHeight: 1.2 }}>{w.kana}</span>
            <span style={{ fontFamily: FONT.ko, fontSize: 26, color: C.muted }}>{w.ko}</span>
          </div>
        ))}
      </div>

      {/* 소리를 짝지으면 */}
      <p style={{ ...big, position: "absolute", top: 150, left: 0, right: 0, ...(frame >= t.count ? leave(frame, t.count, 9, 12) : fall(frame, t.split + 6, 16, 16)) }}>
        한자 하나하나의 소리를 짝지으면──
      </p>
      <p style={{ ...big, position: "absolute", top: 136, left: 0, right: 0, fontSize: 74, ...(frame >= t.net ? leave(frame, t.net, 9, 12) : fall(frame, t.count + 8, 16, 16)) }}>
        소리 짝 <span style={{ color: C.accent }}>3</span>개로, <span style={{ color: C.accent }}>5</span>단어.
      </p>
      {/* 組み上がる語 */}
      <div style={{ position: "absolute", top: 730, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, ...(frame >= t.net ? leave(frame, t.net, 10, 14) : {}) }}>
        {WORDS.map((w, i) => (
          <div
            key={w.ko}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "14px 24px",
              border: `1.5px solid ${C.accent}`,
              borderRadius: 999,
              background: C.tint,
              whiteSpace: "nowrap",
              ...rise(frame, at[i], 22, 14),
            }}
          >
            <span style={{ fontFamily: FONT.ko, fontSize: 36, fontWeight: 600, lineHeight: 1.2 }}>{w.ko}</span>
            <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 28, color: C.ink2 }}>{w.kanji}</span>
            <span style={{ fontFamily: FONT.ja, fontWeight: 600, fontSize: 28, color: C.accent }}>{w.kana}</span>
          </div>
        ))}
      </div>

      {/* 짝が増えると */}
      <p style={{ ...big, position: "absolute", top: 64, left: 0, right: 0, fontSize: 54, ...(frame >= t.known ? leave(frame, t.known, 10, 12) : fall(frame, t.net + 8, 16, 16)) }}>
        짝이 늘어날수록, 말할 수 있는 단어도 늘어나요.
      </p>
      <div style={{ position: "absolute", top: 400, left: 0, right: 0, ...fall(frame, t.known + 6, 16, 16) }}>
        <p style={big}>뜻은, 이미 알고 있어요.</p>
        <p style={big}>모르는 건, 일본어 소리뿐.</p>
        <p style={{ ...big, marginTop: 40, fontSize: 32, fontWeight: 500, color: C.ink2, ...fall(frame, t.known + 26, 10, 16) }}>
          한국어 한자어 약 5,800개가, 일본어에도 같은 한자·같은 뜻으로 있어요.
        </p>
      </div>
    </>
  );
}
