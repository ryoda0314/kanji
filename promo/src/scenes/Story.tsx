// C–G. 소리 짝 で覚えると、どうなるかを、アプリの画面で。左に映像の言葉。
//   모으기：회의 を打つと 会議 かいぎ と 소리 짝（회 → かい・의 → ぎ）。모으기 で +8（회사・교회・사회…）。
//   말해 보기：교회 を見て、自分で きょうかい と打つ。배우지 않은 단어인데도요。
//   소리 짝：받침ごとに並べると、ㄱ は く、ㄴ は ん、ㄹ は つ、ㅇ は う・い が見えてくる。
//   한국어와 다른 점：공부 は 日本語では 勉強 べんきょう。同じ漢字の 工夫 くふう は 궁리。
//   문장에서 만나기：集めた語の入った日本語の文が降る。言える語は、ふりがなを ？ で伏せる。
// 学ぶ人の手持ちは、학생・대학・교실・사장 を集めたところから。数はアプリの辞書のとおり（scripts/net.mjs → src/demo.json）。
import type { CSSProperties } from "react";
import { fall, prog, rise, SOFT, typedAt, type Typing } from "../anim";
import DEMO from "../demo.json";
import { Scroll } from "../Scroll";
import { PAIR_GLOW, T, TYPE_COLLECT, TYPE_DIFF, TYPE_SAY } from "../timeline";
import { C, FONT } from "../theme";
import { Btn, Chip, Field, GainAfter, GainBefore, Icon, Kanji, Legend, Logo, Names, PairChip, PairLink, RainItem, Roots, Sayable, SubBar, WordRow, label, lead, note, rgba, type Seg } from "../ui";
import { Captions, type Cap } from "./Caption";

const ko = (text: string, color?: string) => ({ text, font: "ko" as const, color });
const ja = (text: string, color?: string, at?: number) => ({ text, font: "ja" as const, color, at });
const hj = (text: string, color?: string) => ({ text, font: "hanja" as const, color });

const TYPED = DEMO.typed;
const SAY = DEMO.say;
/** 모으기 で新しく言えるようになった語のうち、アプリが並べる数（Collect の OPENED_LIMIT）。 */
const OPENED_LIMIT = 6;

/** 映像の言葉。 */
const CAPS: Cap[] = [
  {
    from: T.collect.cap1,
    door: "collect",
    main: [["아는 한자어를 입력하면,"], ["같은 한자의 일본어 단어와"], ["소리 짝이 나온다."]],
    sub: [[ko(TYPED.ko), " → ", hj(TYPED.kanji), " ", ja(TYPED.kana)], [ko("회"), " → ", ja("かい", C.accent), ",  ", ko("의"), " → ", ja("ぎ", C.accent)]],
    subAt: T.collect.found + 6,
  },
  {
    from: T.collect.cap2,
    door: "collect",
    main: [["모을 때마다,"], ["말할 수 있는 한자어가"], ["한꺼번에 늘어난다."]],
    sub: [[ko(TYPED.ko), " 하나로 ", { text: `+${DEMO.opened.length}`, color: C.accent, at: T.collect.done + 12 }], [DEMO.opened.slice(0, 3).map((w) => w.ko).join(" · "), " …"]],
    subAt: T.collect.done + 8,
  },
  { from: T.say.cap3, door: "find", main: [["교실이 ", ja("きょうしつ"), ","], ["회의가 ", ja("かいぎ"), "라면,"], ["교회는?"]] },
  { from: T.say.cap4, door: "find", main: [["교회는, ", ja("きょうかい", C.accent), "."]], sub: [["배운 적 없는 단어인데,"], ["일본어로 말할 수 있었다."]] },
  {
    from: T.pairs.cap5,
    door: "pairs",
    main: [["받침별로"], ["나란히 놓으면,"], ["짝이 보인다."]],
    sub: [
      [ko("학"), " → ", ja("がく", C.accent), ",  ", ko("국"), " → ", ja("こく", C.accent), ",  ", ko("약"), " → ", ja("やく", C.accent)],
      [ko("간"), " → ", ja("かん", C.accent), ",  ", ko("문"), " → ", ja("もん", C.accent), ",  ", ko("신"), " → ", ja("しん", C.accent)],
    ],
    subAt: T.pairs.glow,
  },
  {
    from: T.diff.cap6,
    door: "collect",
    main: [["같은 한자라도"], ["뜻이 다른 말은,"], ["따로 알려 준다."]],
    sub: [
      [ko("공부"), "는 일본어로 ", hj("勉強"), " ", ja("べんきょう", C.accent, T.diff.hl)],
      [hj("工夫"), " ", ja("くふう"), "는 ‘궁리’라는 뜻."],
    ],
    subAt: T.diff.hl,
  },
  {
    from: T.meet.cap7,
    door: "find",
    main: [["모은 단어를,"], ["일본어 문장 속에서"], ["다시 만난다."]],
    sub: [
      [hj("会議", C.again), "  모은 단어"],
      [hj("会社", C.accent), "  말할 수 있는 단어 — 읽는 법은 ", { text: "？", color: C.accent }],
    ],
    subAt: T.meet.marks,
  },
];

const PANEL = { left: 880, top: 40, width: 900, height: 1000 };
const K = 1.5;
const PW = PANEL.width / K;
const PH = PANEL.height / K;

export function Story({ frame }: { frame: number }) {
  return (
    <>
      <Captions frame={frame} caps={CAPS} until={T.end.start} />
      <Panel frame={frame} />
    </>
  );
}

function Panel({ frame }: { frame: number }) {
  const cuts = [T.say.start, T.pairs.start, T.diff.start, T.meet.start];
  const w = (i: number) => (i === 0 ? 1 : prog(frame, cuts[i - 1], 12, SOFT)) * (i === cuts.length ? 1 : 1 - prog(frame, cuts[i], 12, SOFT));
  const screens = [CollectScreen, SayScreen, PairsScreen, DiffScreen, MeetScreen];
  return (
    <div style={{ position: "absolute", ...PANEL, borderRadius: 28, border: `1.5px solid ${C.line2}`, overflow: "hidden", background: C.paper, ...fall(frame, T.collect.start, 24, 18) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: PW, height: PH, transform: `scale(${K})`, transformOrigin: "0 0" }}>
        {screens.map((Screen, i) =>
          w(i) > 0 ? (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: w(i), background: C.paper }}>
              <Screen frame={frame} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** 打つ欄の中身。`from` から打ちはじめ、`until` で空になる（あつめると欄は空く）。 */
function typed(frame: number, t: Typing, from: number, until: number) {
  return frame >= from && frame < until ? typedAt(t, frame - from) : "";
}
const typingNow = (frame: number, t: Typing, from: number) => frame >= from && frame < from + t.duration;
const caretOn = (frame: number, focus: number, typing: boolean) => frame >= focus && (typing || Math.floor((frame - focus) / 16) % 2 === 0);

/** 上のバー：アイコンと 말씨앗、한자어 → 日本語。 */
function TopBar() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, padding: "12px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.paper, zIndex: 2 }}>
      <Logo />
      <PairLink />
    </div>
  );
}

/** 모으기 の打つところ。 */
function Form({ text, caret, focus, press }: { text: string; caret: boolean; focus: boolean; press: number }) {
  return (
    <div data-anchor="form" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
      <span style={label}>아는 한자어</span>
      <div style={{ display: "flex", gap: 8 }}>
        <Field text={text} placeholder="예: 학생" caret={caret} focus={focus} />
        <Btn disabled={!text} press={press} style={{ padding: "0 20px" }}>
          찾아보기
        </Btn>
      </div>
      <p style={note}>
        한국어로 입력해요. 일본어(<span style={{ fontFamily: FONT.ja }}>がくせい</span>·gakusei)나 한자(<span style={{ fontFamily: FONT.hanja }}>学生·學生</span>)로도 찾을 수 있어요.
      </p>
    </div>
  );
}

function Intro() {
  return (
    <>
      <h2 style={{ margin: 0, fontFamily: FONT.ko, fontSize: 24, fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.5 }}>아는 한자어를, 일본어로</h2>
      <p style={{ ...lead, marginTop: -16 }}>
        알고 있는 한국어 한자어를 입력해 보세요(학생, 회사, 문제…). 같은 한자로 된 일본어 단어와 그 소리를 알려 줘요.
      </p>
    </>
  );
}

// ---- 모으기 ----------------------------------------------------------------------------------------------------------

function CollectScreen({ frame }: { frame: number }) {
  const c = T.collect;
  const text = typed(frame, TYPE_COLLECT, c.type, c.done);
  const typing = typingNow(frame, TYPE_COLLECT, c.type);
  const grow = (at: number, n: number) => Array.from({ length: n }, (_, i) => prog(frame, at + i * 3, 18));
  const sayable = frame < c.done ? DEMO.ownedSayable : Math.round(DEMO.ownedSayable + (DEMO.afterSayable - DEMO.ownedSayable) * prog(frame, c.count - 6, 18));
  const pairs = frame < c.count - 6 ? DEMO.ownedPairs : DEMO.afterPairs;
  return (
    <>
      <TopBar />
      <Scroll
        style={{ left: 0, right: 0, top: 64, bottom: 0 }}
        focus={[
          { anchor: "form", w: prog(frame, c.found - 6, 16, SOFT), margin: 8 },
          { anchor: "gain", w: prog(frame, c.done + 14, 24, SOFT), margin: 8 },
          { anchor: "sayable", w: prog(frame, c.count - 16, 20, SOFT), margin: 140 },
        ]}
      >
        <div style={{ padding: "22px 20px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
          <Intro />
          <Form text={text} caret={caretOn(frame, c.focus, typing)} focus={frame >= c.focus && frame < c.done} press={frame - c.look} />
          {frame >= c.found ? (
            <section style={{ display: "flex", flexDirection: "column", gap: 16, ...rise(frame, c.found, 8, 10) }}>
              {frame >= c.done ? (
                <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: C.accent, ...rise(frame, c.done, 6, 10) }}>
                  <Icon name="check" size={18} />「{TYPED.ko}」 모았어요.
                </p>
              ) : null}
              <Names ko={TYPED.ko} kanji={TYPED.kanji} koForm={TYPED.koForm} kana={TYPED.kana} />
              <Roots
                roots={TYPED.roots}
                grow={frame >= c.done ? grow(c.done + 2, TYPED.roots.length) : undefined}
                notes={frame >= c.done ? TYPED.roots.map(() => ({ kind: "new" as const })) : undefined}
              />
              {frame < c.done ? (
                <>
                  <GainBefore count={DEMO.opened.length} />
                  <Btn press={frame - c.press}>모으기</Btn>
                </>
              ) : (
                <div data-anchor="gain" style={{ display: "flex", flexDirection: "column", gap: 8, ...rise(frame, c.done + 10, 8, 12) }}>
                  <GainAfter shown={Math.round(DEMO.opened.length * prog(frame, c.done + 12, 16))} />
                  {DEMO.opened.slice(0, OPENED_LIMIT).map((w, i) => (
                    <div key={w.ko} style={rise(frame, c.done + 18 + i * 3, 14, 12)}>
                      <WordRow ko={w.ko} kanji={w.kanji} koForm={w.koForm} />
                    </div>
                  ))}
                  <p style={{ ...note, ...rise(frame, c.done + 18 + OPENED_LIMIT * 3, 10, 12) }}>그 밖에도 {DEMO.opened.length - OPENED_LIMIT}단어. 찾기에서 모두 볼 수 있어요.</p>
                </div>
              )}
            </section>
          ) : null}
          <div data-anchor="sayable">
            <Sayable count={sayable} pairs={pairs} />
          </div>
          <section style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>최근에 모은 단어</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>단어 열기</span>
            </div>
            {(frame >= c.done ? [TYPED, ...[...DEMO.owned].reverse()] : [...DEMO.owned].reverse()).map((w) => (
              <WordRow key={w.ko} ko={w.ko} kanji={w.kanji} koForm={w.koForm} kana={w.kana} meta="오늘" />
            ))}
          </section>
        </div>
      </Scroll>
    </>
  );
}

// ---- 말해 보기 -------------------------------------------------------------------------------------------------------

function SayScreen({ frame }: { frame: number }) {
  const r = T.say;
  const text = typed(frame, TYPE_SAY, r.type, r.success);
  const done = frame >= r.success;
  const shown = prog(frame, r.success, 10);
  return (
    <>
      <SubBar back title="말해 보기" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!done ? (
          <>
            <p style={{ ...lead, color: C.muted }}>
              아는 한국어 한자어예요. 일본어로는 어떻게 말할까요? 한자 하나하나의 소리 짝(학 → <span style={{ fontFamily: FONT.ja }}>がく</span>)을 이어서 히라가나로 입력해 보세요.
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 12px 14px", border: `1px solid ${C.line2}`, borderRadius: 16, ...fall(frame, r.start + 4, 10, 14) }}>
              <span style={{ fontFamily: FONT.ko, fontSize: 30, fontWeight: 600, lineHeight: 1.3 }}>{SAY.ko}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {SAY.roots.map((g) => (
                  <span key={g.char} style={{ minWidth: 76, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 4px 8px" }}>
                    <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 64, lineHeight: 1.2 }}>{g.char}</span>
                    <span style={{ fontFamily: FONT.ko, fontSize: 16, color: C.ink2 }}>{g.eum}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.line2, lineHeight: 1 }}>・</span>
                  </span>
                ))}
              </div>
              <p style={note}>한자를 누르면 그 한자의 일본어 소리가 나와요.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
              <span style={label}>일본어로 말해 보기</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Field ja text={text} caret={caretOn(frame, r.type - 10, typingNow(frame, TYPE_SAY, r.type))} focus={frame >= r.type - 10} />
                <Btn disabled={!text} press={frame - r.submit} style={{ padding: "0 20px" }}>
                  말했어요
                </Btn>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["일본어 소리 보기", "답 보기", "다른 단어"].map((x) => (
                <Chip key={x}>{x}</Chip>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: shown, transform: `translateY(${(1 - shown) * 8}px)` }}>
            <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: C.accent }}>
              <Icon name="check" size={18} />
              말했어요. 배우지 않은 단어인데도요.
            </p>
            <Names ko={SAY.ko} kanji={SAY.kanji} koForm={SAY.koForm} kana={SAY.kana} kanaStyle={{ color: C.accent, fontWeight: 600 }} />
            <Roots roots={SAY.roots} grow={SAY.roots.map((_, i) => prog(frame, r.success + 8 + i * 3, 18))} />
          </div>
        )}
      </div>
    </>
  );
}

// ---- 소리 짝 ---------------------------------------------------------------------------------------------------------

const FINAL_NAME: Record<string, string> = { none: "받침 없음", ㄱ: "받침 ㄱ", ㄴ: "받침 ㄴ", ㄹ: "받침 ㄹ", ㅁ: "받침 ㅁ", ㅂ: "받침 ㅂ", ㅇ: "받침 ㅇ", other: "그 밖의 받침" };
/** その 받침 の札が光る順（PAIR_GLOW の何番目か）。ㅁ は ㄴ と、ㅂ は ㅇ と一緒に（どちらも ん・う）。 */
const GLOW_STEP: Record<string, number> = { ㄱ: 0, ㄴ: 1, ㅁ: 1, ㄹ: 2, ㅇ: 3, ㅂ: 3 };
const PAIR_CHARS = new Set(DEMO.pairs.groups.flatMap((g) => g.list.map((r) => r.char))).size;

function PairsScreen({ frame }: { frame: number }) {
  const p = T.pairs;
  const step = (f: string) => (f in GLOW_STEP ? p.glow + Math.round(GLOW_STEP[f] * 0.75 * 30) : Infinity);
  // 光る 받침 が見えるように、窓を下へ：ㄱ・ㄴ のあいだは 받침 ㄱ を、ㄹ からは 받침 ㄹ を上に。
  const focus = [
    { anchor: "ㄱ", w: prog(frame, p.scroll, 22, SOFT), margin: 10 },
    { anchor: "ㄹ", w: prog(frame, step("ㄹ") - 10, 20, SOFT), margin: 10 },
  ];
  return (
    <>
      <SubBar title="소리 짝" count={`${PAIR_CHARS}자`} />
      <Scroll style={{ left: 0, right: 0, top: 61, bottom: 0 }} focus={focus}>
        <div style={{ padding: "16px 20px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ minHeight: 44, padding: "0 14px", display: "flex", alignItems: "center", border: `1px solid ${C.line2}`, borderRadius: 12, fontSize: 14, color: C.faint }}>
            한자·한국 한자음·읽는 법으로 찾기 (<span style={{ fontFamily: FONT.hanja }}>学</span> / 학 / <span style={{ fontFamily: FONT.ja }}>がく</span>)
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${C.line2}`, borderRadius: 12, overflow: "hidden" }}>
            {["소리 짝", "모은 한자", "상용한자 2136", "조합하기"].map((v, i) => (
              <span key={v} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? C.ink : C.paper, color: i === 0 ? "#fff" : C.ink2, borderLeft: i ? `1px solid ${C.line2}` : undefined }}>
                {v}
              </span>
            ))}
          </div>
          <p style={lead}>모은 소리 짝이에요. 한국어 받침별로 나란히 놓으면, 한국어 소리와 일본어 소리가 어떻게 짝을 이루는지 보여요.</p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.accent }}>
            소리 짝 {DEMO.pairs.count}개 · 일본어로 말할 수 있는 한자어 {DEMO.pairs.sayable}개
          </p>
          {DEMO.pairs.groups.map((g) => {
            const at = step(g.f);
            const glows = Number.isFinite(at);
            const hl = glows ? prog(frame, at, 10) : 0;
            return (
              <section key={g.f} data-anchor={g.f} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 6, borderBottom: `1px solid ${C.ink}` }}>
                  <span style={{ fontFamily: FONT.ko, fontSize: 17, fontWeight: 600, color: hl > 0.5 ? C.accent : C.ink }}>{FINAL_NAME[g.f]}</span>
                  <small style={{ fontSize: 13, color: C.muted }}>{g.list.length}</small>
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.list.map((r, i) => (
                    <PairChip
                      key={r.char + r.reading}
                      eum={r.eum}
                      reading={r.reading}
                      char={r.char}
                      tail={glows ? 1 : 0}
                      hl={glows ? prog(frame, at + i * 2, 8) : 0}
                      style={{ borderColor: hl > 0 ? rgba(C.accent, 0.25 + 0.5 * hl) : C.line2 }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Scroll>
    </>
  );
}

// ---- 한국어와 다른 점 ------------------------------------------------------------------------------------------------

/** 日本語の語の一行（日本語の字が先：勉強 勉强 べんきょう、下に韓国語の意味）。`hl`：灯す度合い。 */
function JaRow({ kanji, koForm, kana, gloss, hl = 0, style }: { kanji: string; koForm: string | null; kana: string; gloss: string; hl?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "12px 10px", margin: "0 -10px", borderBottom: `1px solid ${C.line}`, borderRadius: 10, background: hl ? rgba(C.accent, 0.1 * hl) : undefined, boxShadow: hl ? `inset 0 0 0 ${1.5 * hl}px ${rgba(C.accent, 0.6 * hl)}` : undefined, ...style }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 12px" }}>
          <Kanji text={kanji} ko={koForm} size={24} />
          <span style={{ fontFamily: FONT.ja, fontSize: 19, color: hl > 0.5 ? C.accent : C.ink2, fontWeight: hl > 0.5 ? 600 : 400 }}>{kana}</span>
        </span>
        <span style={{ fontFamily: FONT.ko, fontSize: 14, color: C.muted }}>{gloss}</span>
      </span>
      <span style={{ color: C.faint, display: "inline-flex", transform: "rotate(180deg)" }}>
        <Icon name="back" size={18} />
      </span>
    </div>
  );
}

function DiffScreen({ frame }: { frame: number }) {
  const d = T.diff;
  const text = typed(frame, TYPE_DIFF, d.type, Infinity);
  const typing = typingNow(frame, TYPE_DIFF, d.type);
  const meaning = DEMO.diff.meaning[0];
  const same = DEMO.diff.kanji[0];
  return (
    <>
      <TopBar />
      <Scroll style={{ left: 0, right: 0, top: 64, bottom: 0 }} focus={[{ anchor: "form", w: 1, margin: 8 }]}>
        <div style={{ padding: "22px 20px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
          <Intro />
          <Form text={text} caret={caretOn(frame, d.focus, typing)} focus={frame >= d.focus} press={frame - d.look} />
          {frame >= d.found ? (
            <section style={{ display: "flex", flexDirection: "column", gap: 10, ...rise(frame, d.found, 8, 10) }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.ink2, fontWeight: 500 }}>「{DEMO.diff.ko}」 — 일본어에서는 다른 한자로 말해요.</p>
              <span style={{ ...label, marginTop: 6 }}>일본어로는 이런 말로도 해요</span>
              <JaRow kanji={meaning.kanji} koForm={meaning.koForm} kana={meaning.kana} gloss={meaning.gloss} hl={prog(frame, d.hl, 10)} />
              <span style={{ ...label, marginTop: 14 }}>한자가 같은 일본어 (뜻을 확인해 보세요)</span>
              <JaRow kanji={same.kanji} koForm={same.koForm} kana={same.kana} gloss={same.gloss} hl={0.6 * prog(frame, d.hl2, 10)} />
            </section>
          ) : null}
        </div>
      </Scroll>
    </>
  );
}

// ---- 문장에서 만나기 -------------------------------------------------------------------------------------------------

function MeetScreen({ frame }: { frame: number }) {
  const m = T.meet;
  const lines = [m.line1, m.line2, m.line3, m.line4];
  const spot = (kind: string, i: number) => (kind === "readable" ? prog(frame, m.spot + i * 6, 8) * (1 - 0.6 * prog(frame, m.spot + 40 + i * 6, 16)) : 0);
  return (
    <>
      <SubBar title="찾기" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ ...lead, fontSize: 14 }}>모은 한자어가 들어간 일본어 문장이 비처럼 내려와요. 밑줄 친 한자어를 누르면 열리고, 일본어 읽기를 입력하면 모여요.</p>
        <Legend />
        <div style={{ marginTop: 4, borderTop: `1px solid ${C.line}` }}>
          {DEMO.sentences.map((s, i) => {
            const at = lines[i];
            if (frame < at) return null;
            const segs = s.segs.map((g) => (typeof g === "string" ? g : { ...g, spot: spot(g.kind, i) })) as Seg[];
            return <RainItem key={s.id} segs={segs} ko={s.ko} drop={prog(frame, at + 6, 10)} style={fall(frame, at, 40, 18)} />;
          })}
        </div>
      </div>
    </>
  );
}
