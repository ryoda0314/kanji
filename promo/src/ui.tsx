// 말씨앗 の画面を、映像のために描き直したもの（../src/**/*.module.css、../src/index.css、../src/app.module.css、文言は
// ../src/copy.ts）。大きさはアプリの px のまま。画面は CSS の拡大で大きく見せる。ひとりでには動かない：どの変化もコマで決まる。
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C, FONT } from "./theme";

// ---- アイコン（../src/components/Icon.tsx） ----------------------------------------------------------------------

const PATHS = {
  // 芽と根：地面の上に二枚の葉、下に根。
  collect: (
    <>
      <path d="M12 13V8.5" />
      <path d="M12 9.5C12 6.4 9.9 4.5 6.6 4.5c0 3 2.1 5 5.4 5z" />
      <path d="M12 8.5c0-2.8 1.9-4.6 5-4.6 0 2.8-1.9 4.6-5 4.6z" />
      <path d="M4.5 13h15" />
      <path d="M12 13v7" />
      <path d="M12 15.5l-3.5 3" />
      <path d="M12 15.5l3.5 3" />
    </>
  ),
  find: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  words: (
    <>
      <path d="M12 7c-2.2-1.6-5.2-2.1-8.5-1.6v13c3.3-.5 6.3 0 8.5 1.6 2.2-1.6 5.2-2.1 8.5-1.6v-13C17.2 4.9 14.2 5.4 12 7z" />
      <path d="M12 7v13" />
    </>
  ),
  pairs: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 4v16" strokeDasharray="2 2.2" />
      <path d="M4 12h16" strokeDasharray="2 2.2" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = "currentColor", stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

// ---- 小さな部品 ------------------------------------------------------------------------------------------------------

export const label: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 600, color: C.muted };
export const note: CSSProperties = { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.7 };
export const lead: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.75, color: C.ink2 };

export const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

/** 上下だけ切る（右端の輪が少しはみ出せるように）。 */
export const CLIP_Y: CSSProperties = { clipPath: "inset(0 -80px)" };

/** 指で押したところ：輪が寄って、離れる。`t` は押してからのコマ（前なら負）。 */
export function Press({ t, x = "50%", y = "50%", size = 46 }: { t: number; x?: number | string; y?: number | string; size?: number }) {
  if (t < -8 || t > 16) return null;
  const inP = Math.min(1, (t + 8) / 8);
  const outP = t > 0 ? Math.min(1, t / 16) : 0;
  return (
    <span
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: rgba(C.ink, 0.14 * inP * (1 - outP)),
        border: `2px solid ${rgba(C.ink, 0.32 * inP * (1 - outP))}`,
        transform: `scale(${1.25 - 0.25 * inP + 0.5 * outP})`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

/** ボタン（index.css の .btn / .btn-quiet）。 */
export function Btn({ children, quiet = false, press = -99, disabled = false, style }: { children: ReactNode; quiet?: boolean; press?: number; disabled?: boolean; style?: CSSProperties }) {
  const pressed = press >= 0 && press < 6;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        padding: quiet ? "0 20px" : "0 24px",
        borderRadius: 12,
        border: `1px solid ${quiet ? C.line2 : C.accent}`,
        background: quiet ? C.paper : C.accent,
        color: quiet ? C.ink : "#fff",
        fontSize: quiet ? 15 : 16,
        fontWeight: quiet ? 500 : 600,
        fontFamily: FONT.ui,
        opacity: disabled ? 0.55 : 1,
        transform: pressed ? "scale(0.97)" : undefined,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      <Press t={press} />
    </span>
  );
}

export function Caret({ height = "1.15em" }: { height?: string }) {
  return <span style={{ display: "inline-block", width: 1.5, height, marginLeft: 1, marginRight: -2.5, verticalAlign: "-0.2em", background: C.ink }} />;
}

/** 読み上げのボタン（SpeakButton.module.css）。 */
export function Speak({ size = 44 }: { size?: number }) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${C.line2}`,
        background: C.paper,
        color: C.ink,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="speaker" size={size >= 60 ? 24 : 20} />
    </span>
  );
}

/** アイコンと、고운바탕 の 말씨앗（Logo.module.css の sm）。 */
export function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Img src={staticFile("app/icon.png")} style={{ width: 28, height: 28, borderRadius: "22%" }} />
      <span style={{ fontFamily: FONT.wordmark, fontWeight: 700, fontSize: 17, letterSpacing: "0.06em", lineHeight: 1.2 }}>말씨앗</span>
    </span>
  );
}

/** 한자어 → 日本語（Layout の PairLink）。 */
export function PairLink() {
  return (
    <span style={{ minHeight: 44, padding: "0 16px", border: `1px solid ${C.line2}`, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ fontFamily: FONT.ko }}>한자어</span>
      <Icon name="arrow" size={16} />
      <span style={{ fontFamily: FONT.ja }}>日本語</span>
    </span>
  );
}

/** 打つ欄：打った字（なければ薄い見本）と、点滅する縦棒。`ja`：日本語を打つ欄。 */
export function Field({ text, placeholder = "", caret, ja = false, focus = false, size = 20, height = 52 }: { text: string; placeholder?: string; caret: boolean; ja?: boolean; focus?: boolean; size?: number; height?: number }) {
  return (
    <span
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: height,
        padding: "0 14px",
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        background: C.paper,
        display: "flex",
        alignItems: "center",
        fontSize: size,
        fontFamily: ja ? FONT.ja : FONT.ko,
        boxShadow: focus ? `0 0 0 3px ${C.paper}, 0 0 0 5px ${C.accent}` : undefined,
      }}
    >
      {text ? (
        <span>
          {text}
          {caret ? <Caret /> : null}
        </span>
      ) : (
        <span style={{ position: "relative" }}>
          {caret ? <Caret /> : null}
          <span style={{ color: C.faint }}>{placeholder}</span>
        </span>
      )}
    </span>
  );
}

// ---- 語の見せ方（KanjiText、Collect の Names、Roots、WordRow） ------------------------------------------------------

/** 語の漢字（KanjiText）：日本の字と、字形が違えば小さく韓国の字（学生 學生）。 */
export function Kanji({ text, ko, size, color = C.ink, koColor = C.muted }: { text: string; ko?: string | null; size: number; color?: string; koColor?: string }) {
  return (
    <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: size, lineHeight: 1.3, color }}>
      {text}
      {ko ? <span style={{ fontFamily: FONT.hanjaKo, marginLeft: "0.45em", fontSize: "0.82em", color: koColor }}>{ko}</span> : null}
    </span>
  );
}

/** 韓国語の漢字語から日本語の語へ（Collect の Names：회의 → 会議 會議 かいぎ）と、その下の一行。 */
export function Names({ ko, kanji, koForm, kana, same = "같은 한자어 · 뜻도 같아요", kanaStyle }: { ko: string; kanji: string; koForm: string | null; kana: string; same?: string; kanaStyle?: CSSProperties }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 14px" }}>
          <span style={{ fontFamily: FONT.ko, fontSize: 24, fontWeight: 600, lineHeight: 1.35 }}>
            {ko}
            <span style={{ margin: "0 2px 0 8px", fontWeight: 400, color: C.faint }}>→</span>
          </span>
          <Kanji text={kanji} ko={koForm} size={34} />
          <span style={{ fontFamily: FONT.ja, fontSize: 26, lineHeight: 1.4, color: C.ink2, ...kanaStyle }}>{kana}</span>
        </div>
        <Speak size={64} />
      </div>
      <p style={{ margin: "-6px 0 0", fontSize: 13, fontWeight: 600, color: C.accent }}>{same}</p>
    </>
  );
}

export type Root = { char: string; ko: string | null; eum: string; hun: string; rt: string; base: string };
export type RootNote = { kind: "new" } | { kind: "again"; n: number };

/**
 * 語を字に分けた並び（Roots）：いちばん上に 소리 짝（회 → かい）、明朝の字、訓、音読み、添え書き。
 * `grow`：字ごとに下から現れる度合い（0 → 1）。
 */
export function Roots({ roots, grow, notes }: { roots: Root[]; grow?: number[]; notes?: (RootNote | null)[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${roots.length}, minmax(0, 1fr))`, gap: 1, background: C.line, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      {roots.map((r, i) => {
        const g = grow?.[i] ?? 1;
        const n = notes?.[i];
        return (
          <div key={i} style={{ background: C.paper, minWidth: 0 }}>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "12px 4px 14px", textAlign: "center", opacity: g, transform: `translateY(${(1 - g) * 14}px)` }}>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, minHeight: 26, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
                <span style={{ fontFamily: FONT.ko }}>{r.eum}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.faint }}>→</span>
                <span style={{ fontFamily: FONT.ja, color: C.accent }}>{r.rt}</span>
              </span>
              <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 52, lineHeight: 1.2 }}>{r.char}</span>
              {r.ko ? <span style={{ position: "absolute", top: 10, right: 10, fontFamily: FONT.hanjaKo, fontSize: 13, color: C.muted }}>{r.ko}</span> : null}
              <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{r.hun}</span>
              <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>음독</span>
              {n ? (
                <span style={{ marginTop: 4, fontSize: 11, fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.02em", color: n.kind === "new" ? C.accent : C.again }}>
                  {n.kind === "new" ? (
                    "처음 만난 한자"
                  ) : (
                    <>
                      다시 만난 한자
                      <br />
                      {n.n}번째 단어
                    </>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 語の一行（WordRow）：韓国語の漢字語、日本語の字（言える語は読みを出さない）、添え書き。 */
export function WordRow({ ko, kanji, koForm, kana, meta, style }: { ko: string; kanji: string; koForm?: string | null; kana?: string; meta?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${C.line}`, ...style }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 12px" }}>
          <span style={{ fontFamily: FONT.ko, fontSize: 20, fontWeight: 600, lineHeight: 1.5 }}>{ko}</span>
          <Kanji text={kanji} ko={koForm} size={18} color={C.ink2} />
          {kana ? <span style={{ fontFamily: FONT.ja, fontSize: 17, color: C.ink2 }}>{kana}</span> : null}
        </span>
        {meta ? <span style={{ fontSize: 12, color: C.faint }}>{meta}</span> : null}
      </span>
      <span style={{ color: C.faint, display: "inline-flex", transform: "rotate(180deg)" }}>
        <Icon name="back" size={18} />
      </span>
    </div>
  );
}

/** あつめると言える語が増える数（Gain：before）。 */
export function GainBefore({ count }: { count: number }) {
  return (
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 1px" }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: C.ink2, marginRight: 5 }}>모으면, 일본어로 말할 수 있는 한자어가</span>
      <strong style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.2, color: C.accent }}>{count}</strong>
      <span style={{ fontSize: 15, fontWeight: 500, color: C.ink2 }}>개 늘어나요</span>
    </p>
  );
}

/** 言えるようになった数（Gain：after）。 */
export function GainAfter({ shown }: { shown: number }) {
  return (
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 1px", padding: "14px 16px", background: C.tint, borderRadius: 12 }}>
      <strong style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: C.accent }}>+{shown}</strong>
      <span style={{ fontSize: 15, fontWeight: 600, color: C.accent }}>개 한자어를 일본어로 말할 수 있게 됐어요</span>
    </p>
  );
}

/** 일본어로 말할 수 있는 한자어（いちばんの数）。 */
export function Sayable({ count, pairs }: { count: number; pairs: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, background: C.tint }}>
      <span style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: C.accent, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>일본어로 말할 수 있는 한자어</span>
        <span style={{ fontSize: 13, color: C.muted }}>모은 소리 짝 {pairs}개로</span>
      </span>
    </div>
  );
}

/**
 * 소리 짝 の札（Hanja.module.css の .pair）：韓国語の音 → 日本語の音、字。
 * `tail`：日本語の音の終わりの何字に色を敷くか（받침 との対応を見せるとき）、`hl`：その度合い。
 */
export function PairChip({ eum, reading, char, tail = 0, hl = 0, style }: { eum: string; reading: string; char: string; tail?: number; hl?: number; style?: CSSProperties }) {
  const head = tail ? reading.slice(0, -tail) : reading;
  const end = tail ? reading.slice(-tail) : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "6px 10px", border: `1px solid ${C.line2}`, borderRadius: 10, fontSize: 16, fontWeight: 600, background: C.paper, ...style }}>
      <span style={{ fontFamily: FONT.ko, color: C.ink }}>{eum}</span>
      <span style={{ fontSize: 12, fontWeight: 400, color: C.faint }}>→</span>
      <span style={{ fontFamily: FONT.ja, color: C.accent }}>
        {head}
        {end ? (
          <span style={{ borderRadius: 4, padding: "0 2px", margin: "0 -2px", background: rgba(C.accent, 0.16 * hl), boxShadow: hl > 0 ? `inset 0 -2px 0 ${rgba(C.accent, 0.9 * hl)}` : undefined }}>{end}</span>
        ) : null}
      </span>
      <span style={{ marginLeft: 2, fontFamily: FONT.hanja, fontSize: 14, fontWeight: 500, color: C.muted }}>{char}</span>
    </span>
  );
}

/** 上のバー（app.module.css の subbar）。 */
export function SubBar({ title, count, back = false }: { title: string; count?: string; back?: boolean }) {
  return (
    <header style={{ position: "absolute", left: 0, right: 0, top: 0, height: 61, padding: "8px 12px 8px 8px", display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${C.line}`, background: C.paper, zIndex: 2 }}>
      {back ? (
        <span style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={22} />
        </span>
      ) : null}
      <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 600, paddingLeft: back ? 0 : 12 }}>{title}</h1>
      {count ? <span style={{ fontSize: 13, color: C.muted, paddingRight: 8 }}>{count}</span> : null}
    </header>
  );
}

/** 丸い札（押せる候補・絞り込み）。 */
export function Chip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", border: `1px solid ${C.line2}`, borderRadius: 999, fontSize: 14, color: C.ink2, background: C.paper, ...style }}>
      {children}
    </span>
  );
}

// ---- 문장에서 만나기 の文（SentenceView.module.css、Meet.module.css） -----------------------------------------------

/**
 * 文の一切れ：ただの字か、印の語（集めた語・集めた 소리 짝 で言える語・まだの語）か、ふりがなだけの語。
 * `spot`：語を灯す度合い。言える語のふりがなは ？ で伏せる。
 */
export type Seg = string | { text: string; kind: "owned" | "readable" | "new" | "ruby"; rt: string; spot?: number };

/** 印の付いた日本語の文（ふりがな付き）。 */
export function Sentence({ segs, size = 22 }: { segs: Seg[]; size?: number }) {
  return (
    <span style={{ fontFamily: FONT.ja, fontSize: size, fontWeight: 500, lineHeight: 2.1 }}>
      {segs.map((s, i) => {
        if (typeof s === "string") return <span key={i}>{s}</span>;
        const marked = s.kind !== "ruby";
        const color = s.kind === "owned" ? C.again : s.kind === "ruby" ? C.muted : C.accent;
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", borderRadius: 8, boxShadow: s.spot ? `0 0 0 ${2 + 4 * s.spot}px ${rgba(C.accent, 0.3 * s.spot)}` : undefined }}>
            <ruby
              style={{
                fontFamily: FONT.hanja,
                fontWeight: 500,
                borderRadius: 4,
                textDecorationLine: marked ? "underline" : undefined,
                textDecorationThickness: s.kind === "owned" ? 2 : 2.5,
                textUnderlineOffset: "0.3em",
                textDecorationStyle: s.kind === "owned" ? "dotted" : "solid",
                textDecorationColor: s.kind === "owned" ? C.again : C.accent,
                background: s.kind === "readable" ? C.tint : undefined,
                padding: s.kind === "readable" ? "0 0.1em" : undefined,
              }}
            >
              {s.text}
              <rt style={{ fontFamily: FONT.ja, fontSize: "0.46em", fontWeight: s.kind === "readable" ? 600 : 400, letterSpacing: "0.04em", color }}>{s.kind === "readable" ? "？" : s.rt}</rt>
            </ruby>
          </span>
        );
      })}
    </span>
  );
}

/** 雨の一文：雨粒の印、印の付いた文、訳、読み上げ（Meet の item）。`drop`：雨粒の印が着地する度合い。 */
export function RainItem({ segs, ko, drop = 1, style }: { segs: Seg[]; ko: string; drop?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.line}`, ...style }}>
      <span style={{ flexShrink: 0, alignSelf: "stretch", width: 3, margin: "6px 0", borderRadius: 2, background: C.line2, transformOrigin: "top", transform: `scaleY(${drop})` }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0 }}>
        <Sentence segs={segs} />
        <span style={{ fontFamily: FONT.ko, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{ko}</span>
      </div>
      <Speak />
    </div>
  );
}

/** 印の見方（Meet の legend）。 */
export function Legend() {
  const sample = (kind: "owned" | "readable" | "new") => (
    <span
      style={{
        fontFamily: FONT.hanja,
        fontSize: 13,
        color: C.ink2,
        textDecorationLine: "underline",
        textDecorationThickness: kind === "owned" ? 2 : 2.5,
        textUnderlineOffset: "0.3em",
        textDecorationStyle: kind === "owned" ? "dotted" : "solid",
        textDecorationColor: kind === "owned" ? C.again : C.accent,
        background: kind === "readable" ? C.tint : undefined,
        borderRadius: 4,
        padding: kind === "readable" ? "0 0.1em" : undefined,
      }}
    >
      漢字
    </span>
  );
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: C.muted }}>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>{sample("owned")}모은 한자어</span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>{sample("readable")}모은 소리 짝으로 말할 수 있어요 (？)</span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>{sample("new")}아직인 한자어</span>
    </span>
  );
}
