// ホーム画面への追加のしかた（縦 1080×1920、X に載せる短い映像。韓国語）。ことのね の同じ映像と同じ作り。
// X のリンクから開いた人は、X の中のブラウザで開いている。そこではホーム画面に追加できないので、
// まず Safari（Android は Chrome）で開き、それからホーム画面に追加する。iPhone → Android の順に、指で押すところを見せる。
// 画面は実機の大きさ（402×874）で組み、K 倍して電話の枠に入れる。X やブラウザの画面は、形だけをまねた絵（ロゴは描かない）。
// 電話の画面の言葉は、韓国語に設定した電話のもの。いつ何が起きるかは src/installTimeline.ts。
// ナレーションは voice/lines.json の I01〜（npm run voice）。字幕は音なしでも分かるように、声と同じことを短く。
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { fall, leave, prog, rise, SOFT } from "./anim";
import { INSTALL_FRAMES, S, TAPS, VOICED } from "./installTimeline";
import { C, FONT, useFonts } from "./theme";
import { Btn, Field, Icon, Logo, PairLink, Press, label, note, rgba, type IconName } from "./ui";

export const INSTALL = { width: 1080, height: 1920 };
export { INSTALL_FRAMES };

/** 말씨앗 の公開先（まだ決まっていないので、ドメインだけ）。決まったら、ここに。 */
const ADDRESS = "vercel.app";

// ---- 電話 ------------------------------------------------------------------------------------------------------------

/** 画面の大きさ（実機の論理ピクセル）と、映像での倍率・置き場所。 */
const W = 402;
const H = 874;
const K = 1.5;
const BEZEL = 14;
const PHONE = { width: W * K + BEZEL * 2, height: H * K + BEZEL * 2 };
const PHONE_AT = { left: (INSTALL.width - PHONE.width) / 2, top: INSTALL.height - PHONE.height - 64 };

const SYS = `-apple-system, "Apple SD Gothic Neo", ${FONT.ui}`;
const BLUE = "#0a6cf0";

function Phone({ android = false, children, style }: { android?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        ...PHONE_AT,
        ...PHONE,
        padding: BEZEL,
        borderRadius: android ? 64 : 84,
        background: "#11151d",
        boxShadow: "0 30px 80px rgba(23,32,51,0.18)",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: W * K, height: H * K, borderRadius: android ? 52 : 72, overflow: "hidden", background: C.paper }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${K})`, transformOrigin: "0 0", fontFamily: SYS, color: C.ink }}>
          {children}
          {/* カメラ（iPhone は島、Android は小さな穴） */}
          {android ? (
            <div style={{ position: "absolute", left: W / 2 - 6, top: 10, width: 12, height: 12, borderRadius: 6, background: "#0b0d12", zIndex: 30 }} />
          ) : (
            <div style={{ position: "absolute", left: W / 2 - 62, top: 11, width: 124, height: 36, borderRadius: 18, background: "#0b0d12", zIndex: 30 }} />
          )}
        </div>
      </div>
    </div>
  );
}

/** 上の時計・電池（明るい地の上で）。 */
function StatusBar({ android = false, dark = false }: { android?: boolean; dark?: boolean }) {
  const color = dark ? "#fff" : C.ink;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: android ? 34 : 54,
        padding: android ? "0 22px" : "0 34px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: android ? 14 : 16,
        fontWeight: 600,
        color,
        zIndex: 20,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 17, height: 11, display: "inline-flex", alignItems: "flex-end", gap: 2 }}>
          {[4, 6, 8, 11].map((h) => (
            <i key={h} style={{ width: 3, height: h, borderRadius: 1, background: color }} />
          ))}
        </span>
        <span style={{ width: 24, height: 12, borderRadius: 3.5, border: `1.5px solid ${rgba(dark ? "#ffffff" : C.ink, 0.5)}`, padding: 1.5 }}>
          <i style={{ display: "block", width: "78%", height: "100%", borderRadius: 1.5, background: color }} />
        </span>
      </span>
    </div>
  );
}

/** 指で押したところ（実機の論理ピクセルで）。 */
function Tap({ fr, at, x, y }: { fr: number; at: number; x: number; y: number }) {
  return <Press t={fr - at} x={x} y={y} size={50} />;
}

/** 縦に三つの点（Android のメニュー「⋮」。字では形が崩れるので描く）。 */
function VDots({ size = 22 }: { size?: number }) {
  const dot = Math.max(3, size * 0.17);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: dot * 0.75, width: size * 0.5, height: size, verticalAlign: "-0.12em" }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ width: dot, height: dot, borderRadius: "50%", background: "currentColor" }} />
      ))}
    </span>
  );
}

/** 押したときに一瞬薄く色づく行。 */
const pressed = (fr: number, at: number) => (fr >= at - 2 && fr < at + 8 ? rgba(C.ink, 0.08) : "transparent");

// ---- 말씨앗 の画面 ---------------------------------------------------------------------------------------------------

const DOORS: [IconName, string][] = [
  ["collect", "모으기"],
  ["find", "찾기"],
  ["words", "단어"],
  ["pairs", "소리 짝"],
  ["me", "나"],
];

/** 말씨앗 の最初の画面（모으기）。`top`・`bottom` はブラウザの枠のぶん。 */
function AppPage({ top, bottom = 0 }: { top: number; bottom?: number }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, bottom: 0, background: C.paper, fontFamily: FONT.ui, color: C.ink, overflow: "hidden" }}>
      <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <PairLink />
      </div>
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ margin: 0, fontFamily: FONT.ko, fontSize: 21, fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.5 }}>아는 한자어를, 일본어로</h2>
          <p style={{ ...note, fontSize: 14 }}>알고 있는 한국어 한자어를 입력해 보세요(학생, 회사, 문제…). 같은 한자로 된 일본어 단어와 그 소리를 알려 줘요.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, background: C.surface, borderRadius: 12 }}>
          <span style={label}>아는 한자어</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Field text="" placeholder="예: 학생" caret={false} size={17} height={46} />
            <Btn disabled style={{ padding: "0 16px", minHeight: 46 }}>
              찾아보기
            </Btn>
          </div>
          <p style={note}>
            한국어로 입력해요. 일본어(<span style={{ fontFamily: FONT.ja }}>がくせい</span>·gakusei)나 한자(<span style={{ fontFamily: FONT.hanja }}>学生·學生</span>)로도 찾을 수 있어요.
          </p>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>일본어 입력 방법</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ ...label, fontSize: 13 }}>이런 한자어를 입력해 보세요</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["학생", "회사", "시간", "문제", "가족", "약속"].map((w) => (
              <span key={w} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.line2}`, fontFamily: FONT.ko, fontSize: 16, fontWeight: 500 }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom,
          height: 62,
          borderTop: `1px solid ${C.line}`,
          background: C.paper,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          alignItems: "center",
        }}
      >
        {DOORS.map(([icon, name], i) => (
          <span key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 11, color: i === 0 ? C.accent : C.muted }}>
            <Icon name={icon} size={22} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- X（の形をまねた画面） -------------------------------------------------------------------------------------------

/** タイムラインの投稿と、말씨앗 のリンクのカード。 */
function Post({ fr }: { fr: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff" }}>
      <StatusBar />
      <div style={{ position: "absolute", left: 0, right: 0, top: 54, height: 48, borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
        홈
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 118, display: "flex", gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 21, background: C.tint, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            일본어 공부 계정 <span style={{ fontWeight: 400, color: "#7a8494" }}>· 2시간</span>
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.6, wordBreak: "keep-all" }}>
            아는 한자어를 입력하면 일본어 소리가 짝지어져서, 배우지 않은 단어까지 일본어로 말할 수 있게 되는 앱. 가입 없이 쓸 수 있어요.
          </span>
          <span style={{ position: "relative", display: "block", borderRadius: 16, border: "1px solid #e3e6ea", overflow: "hidden", background: pressed(fr, S.tapLink) }}>
            <span style={{ height: 150, background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, borderBottom: "1px solid #e3e6ea" }}>
              <Img src={staticFile("app/icon.png")} style={{ width: 64, height: 64, borderRadius: "22%", border: `1px solid ${C.line}` }} />
              <span style={{ fontFamily: FONT.wordmark, fontWeight: 700, fontSize: 28, letterSpacing: "0.08em" }}>말씨앗</span>
            </span>
            <span style={{ display: "block", padding: "10px 12px", fontSize: 14 }}>
              <span style={{ display: "block", fontWeight: 600 }}>말씨앗 | 아는 한자어가, 그대로 일본어가 된다</span>
              <span style={{ display: "block", color: "#7a8494", fontSize: 13 }}>{ADDRESS}</span>
            </span>
          </span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 490, borderTop: "1px solid #eef0f3", padding: "16px 16px 0", display: "flex", gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 21, background: "#e9edf3", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
          {[56, 92, 80, 64].map((w, i) => (
            <span key={i} style={{ display: "block", width: `${w}%`, height: 11, borderRadius: 6, background: "#eceff3" }} />
          ))}
          <span style={{ display: "block", height: 170, borderRadius: 16, background: "#f1f3f6", marginTop: 4 }} />
        </div>
      </div>
      <Tap fr={fr} at={S.tapLink} x={230} y={320} />
    </div>
  );
}

/**
 * X の中のブラウザ（2026年のいまの形）。ページは画面いっぱいで、下に浮いた ✕・アドレスと「⋮」・読み込み直しの並び、
 * その下に投稿の帯（書いた人と、返信・마음에 들어요 などのボタン）。メニューはアドレスの「⋮」から。
 */
function InAppBrowser({ fr, android, tapAt, menuAt, pickAt }: { fr: number; android: boolean; tapAt: number; menuAt: number; pickAt: number }) {
  const top = android ? 34 : 54;
  const panel = 172;
  const row = H - panel - 50;
  const menu = prog(fr, menuAt, 8);
  // メニューは「공유하기・브라우저에서 열기・링크 복사하기」。いつものブラウザで開く（韓国語の X の言い方は、実機で確かめていない）。
  const items: [string, string][] = [
    ["⇧", "공유하기"],
    ["◎", "브라우저에서 열기"],
    ["⧉", "링크 복사하기"],
  ];
  const PICK = 1;
  const ROW = 44;
  const menuTop = row - 14 - items.length * ROW - 16;
  const glass: CSSProperties = { background: "rgba(128,134,144,0.78)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff" }}>
      <StatusBar android={android} />
      <AppPage top={top} bottom={panel + 64} />
      {/* ✕・アドレスと ⋮・読み込み直し */}
      <div style={{ position: "absolute", left: 10, right: 10, top: row, height: 42, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 4 }}>
        <span style={{ ...glass, width: 42, height: 42, borderRadius: 21 }}>
          <Icon name="close" size={20} />
        </span>
        <span style={{ ...glass, height: 42, padding: "0 10px 0 22px", gap: 10, borderRadius: 21, fontSize: 16, fontWeight: 600 }}>
          {ADDRESS}
          <span style={{ width: 28, height: 34, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: fr >= tapAt - 2 && fr < tapAt + 8 ? "rgba(255,255,255,0.3)" : undefined }}>
            <VDots size={20} />
          </span>
        </span>
        <span style={{ ...glass, width: 42, height: 42, borderRadius: 21, fontSize: 22 }}>↻</span>
      </div>
      {/* 投稿の帯 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: panel, borderRadius: "22px 22px 0 0", background: "#000", color: "#fff", zIndex: 4 }}>
        <span style={{ position: "absolute", left: W / 2 - 20, top: 8, width: 40, height: 4, borderRadius: 2, background: "#3a3d44" }} />
        <div style={{ position: "absolute", left: 12, right: 16, top: 26, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 23, background: "#2f5d47" }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>일본어 공부 계정</span>
            <span style={{ fontSize: 13, color: "#8b9099" }}>게시물</span>
          </span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>X.com</span>
        </div>
        <div style={{ position: "absolute", left: 18, right: 18, top: 104, display: "flex", justifyContent: "space-between", color: "#c9ccd1", fontSize: 20 }}>
          {["○", "⇄", "♡", "▯", "⇧"].map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
      </div>
      {/* アドレスの ⋮ のメニュー（上に開く。暗い磨りガラス） */}
      {menu > 0 ? (
        <div
          style={{
            position: "absolute",
            left: W / 2 - 125,
            top: menuTop,
            width: 250,
            padding: "8px 0",
            borderRadius: 26,
            background: "rgba(112,116,122,0.94)",
            boxShadow: "0 12px 34px rgba(23,32,51,0.25)",
            color: "#fff",
            opacity: menu,
            transform: `scale(${0.92 + 0.08 * menu})`,
            transformOrigin: "50% 100%",
            zIndex: 6,
          }}
        >
          {items.map(([mark, item], i) => (
            <div
              key={item}
              style={{
                height: ROW,
                margin: "0 6px",
                padding: "0 14px",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontSize: 16.5,
                fontWeight: i === PICK ? 600 : 400,
                background: i === PICK && fr >= pickAt - 2 && fr < pickAt + 8 ? "rgba(255,255,255,0.22)" : undefined,
              }}
            >
              <span style={{ width: 22, textAlign: "center", fontSize: 18, opacity: 0.9 }}>{mark}</span>
              {item}
            </div>
          ))}
        </div>
      ) : null}
      <Tap fr={fr} at={tapAt} x={W / 2 + 46} y={row + 21} />
      <Tap fr={fr} at={pickAt} x={W / 2 - 20} y={menuTop + 8 + PICK * ROW + ROW / 2} />
    </div>
  );
}

// ---- iPhone：Safari -----------------------------------------------------------------------------------------------

/** 横に三本の線（Safari のアドレス欄の左はしのメニュー「≡」）。 */
function Lines({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", justifyContent: "center", gap: size * 0.2, width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ display: "block", height: Math.max(2, size * 0.1), borderRadius: 2, background: color }} />
      ))}
    </span>
  );
}

/** 共有シートの、上の「말씨앗 — 아는 한자어가…」の行と、人・アプリ・操作の並び（人とアプリは形だけ）。 */
function ShareHead({ dark }: { dark: boolean }) {
  const sub = dark ? "#9a9ea6" : "#6b7079";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "0 6px 14px", borderBottom: `1px solid ${dark ? "#3a3c42" : "rgba(0,0,0,0.1)"}` }}>
      <Img src={staticFile("app/icon.png")} style={{ width: 62, height: 62, borderRadius: 14, background: C.paper }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>말씨앗 — 아는 한자어가, 그대로 일본…</span>
        <span style={{ fontSize: 13.5, color: sub }}>{ADDRESS}</span>
        <span style={{ alignSelf: "flex-start", marginTop: 6, padding: "5px 12px", borderRadius: 14, background: dark ? "#2c2e33" : "rgba(255,255,255,0.35)", fontSize: 14 }}>옵션 ›</span>
      </div>
    </div>
  );
}

function ShareRows({ dark }: { dark: boolean }) {
  const line = `1px solid ${dark ? "#3a3c42" : "rgba(0,0,0,0.1)"}`;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 6px", borderBottom: line }}>
        {["#c9b8a6", "#a9c4b0", "#8c96a6", "#b3b9d6"].map((c) => (
          <span key={c} style={{ width: 60, height: 60, borderRadius: 30, background: c }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 6px", borderBottom: line }}>
        {["#3d8bf2", "#5ccc6b", "#f4d35e", "#7cc58f"].map((c) => (
          <span key={c} style={{ width: 60, height: 60, borderRadius: 15, background: c }} />
        ))}
      </div>
    </>
  );
}

/** 共有シートの下の丸いボタンの並び。最後が「더 보기（∨）」、広げたあとは「간단히 보기（∧）」。 */
function ShareActions({ fr, dark }: { fr: number; dark: boolean }) {
  const acts: [string, string][] = [
    ["⧉", "복사"],
    ["▯", "북마크\n추가"],
    ["∞", "읽기 목록에\n추가"],
    [dark ? "∧" : "∨", dark ? "간단히 보기" : "더 보기"],
  ];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0" }}>
      {acts.map(([mark, name], i) => (
        <span key={name} style={{ width: 86, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              background: !dark && i === 3 && fr >= S.tapMore - 2 && fr < S.tapMore + 8 ? "rgba(255,255,255,0.55)" : dark ? "#2c2e33" : "rgba(255,255,255,0.28)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            {mark}
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.3, textAlign: "center", whiteSpace: "pre-line" }}>{name}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Safari（iOS 26）。下に「‹」・アドレス欄（左はしに「≡」、右に読み込み直し）・タブの並び。
 * アドレス欄の「≡」→「공유」→ 共有シートの「더 보기」→「홈 화면에 추가」→「추가」。
 */
function Safari({ fr }: { fr: number }) {
  const menu = prog(fr, S.safMenu, 8) * (1 - prog(fr, S.share - 2, 6));
  const share = prog(fr, S.share, 12) * (fr < S.more + 6 ? 1 : 0);
  const more = prog(fr, S.more, 12) * (fr < S.addSheet + 12 ? 1 : 0);
  const add = prog(fr, S.addSheet, 12);
  const glass: CSSProperties = { background: "rgba(176,180,186,0.82)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(23,32,51,0.12)" };
  const MENU: [string, string, boolean][] = [
    ["가A", "웹사이트 번역…", true],
    ["⇧", "공유", false],
    ["▯", "북마크 추가", false],
    ["▢", "다음에 북마크 추가…", true],
    ["⌕", "페이지에서 찾기", false],
    ["⊕", "페이지 확대/축소", false],
    ["♢", "알림 받기", false],
    ["◌", "방해 요소 가리기", true],
    ["⊞", "확장 프로그램 관리", false],
  ];
  const menuTop = 318;
  const rowY = (i: number) => menuTop + 14 + i * 46 + MENU.slice(0, i).filter((m) => m[2]).length * 10;
  const moreRows = ["다음에 북마크 추가…", "즐겨찾기에 추가", "빠른 메모에 추가", "페이지에서 찾기", "홈 화면에 추가"];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff" }}>
      <StatusBar />
      <AppPage top={54} bottom={110} />
      {/* 下の並び：‹・アドレス欄・タブ */}
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 36, height: 46, display: "flex", alignItems: "center", gap: 8, zIndex: 4 }}>
        <span style={{ ...glass, width: 46, height: 46, borderRadius: 23 }}>
          <Icon name="back" size={22} />
        </span>
        <span style={{ ...glass, flex: 1, height: 46, borderRadius: 23, justifyContent: "space-between", padding: "0 14px", fontSize: 14.5, fontWeight: 500 }}>
          <span style={{ width: 30, height: 30, borderRadius: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", background: fr >= S.tapSafDots - 2 && fr < S.tapSafDots + 8 ? "rgba(255,255,255,0.35)" : undefined }}>
            <Lines size={18} />
          </span>
          {ADDRESS}
          <span style={{ fontSize: 18 }}>↻</span>
        </span>
        <span style={{ ...glass, width: 46, height: 46, borderRadius: 23, fontSize: 18 }}>⧉</span>
      </div>
      {/* 「≡」のメニュー（暗い磨りガラス） */}
      {menu > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            width: 276,
            top: menuTop,
            borderRadius: 26,
            background: "rgba(112,116,122,0.95)",
            color: "#fff",
            padding: "8px 0",
            boxShadow: "0 12px 34px rgba(23,32,51,0.25)",
            opacity: menu,
            transform: `scale(${0.92 + 0.08 * menu})`,
            transformOrigin: "20% 100%",
            zIndex: 6,
          }}
        >
          {MENU.map(([mark, name, gapAfter], i) => (
            <div key={name}>
              <div style={{ height: 46, margin: "0 6px", padding: "0 14px", borderRadius: 14, display: "flex", alignItems: "center", gap: 14, fontSize: 15.5, whiteSpace: "nowrap", fontWeight: i === 1 ? 600 : 400, background: i === 1 && fr >= S.tapShare - 2 && fr < S.tapShare + 8 ? "rgba(255,255,255,0.22)" : undefined }}>
                <span style={{ width: 22, textAlign: "center", fontSize: 15, opacity: 0.9 }}>{mark}</span>
                {name}
              </div>
              {gapAfter ? <div style={{ height: 1, margin: "4px 20px", background: "rgba(255,255,255,0.18)" }} /> : null}
            </div>
          ))}
        </div>
      ) : null}
      {/* 共有シート（明るい磨りガラス）：下の「더 보기」 */}
      {share > 0 ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: rgba(C.ink, 0.1 * share), zIndex: 7 }} />
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, height: 520, borderRadius: 40, background: "rgba(120,124,130,0.96)", color: "#fff", transform: `translateY(${(1 - share) * 540}px)`, zIndex: 8, padding: "26px 22px 0" }}>
            <ShareHead dark={false} />
            <ShareRows dark={false} />
            <ShareActions fr={fr} dark={false} />
          </div>
        </>
      ) : null}
      {/* 広げた共有シート（暗い）：下の並びに「홈 화면에 추가」 */}
      {more > 0 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, borderRadius: "40px 40px 0 0", background: "#1c1c1e", color: "#fff", opacity: more, transform: `translateY(${(1 - more) * 60}px)`, zIndex: 9, padding: "26px 18px 0" }}>
          <ShareHead dark />
          <ShareRows dark />
          <ShareActions fr={fr} dark />
          <div style={{ position: "absolute", left: 18, right: 18, bottom: 30, borderRadius: 22, background: "#2c2e33", overflow: "hidden" }}>
            {moreRows.map((name, i) => (
              <div key={name} style={{ height: 48, padding: "0 18px", display: "flex", alignItems: "center", gap: 14, fontSize: 16, borderTop: i ? "1px solid #3a3c42" : undefined, fontWeight: i === 4 ? 600 : 400, background: i === 4 && fr >= S.tapAdd - 2 && fr < S.tapAdd + 8 ? "rgba(255,255,255,0.12)" : undefined }}>
                <span style={{ width: 22, textAlign: "center", opacity: 0.9 }}>{i === 4 ? "⊞" : "·"}</span>
                {name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* 홈 화면에 추가 */}
      {add > 0 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 54, bottom: 0, borderRadius: "22px 22px 0 0", background: "#f2f3f6", transform: `translateY(${(1 - add) * 820}px)`, zIndex: 10, padding: "0 16px" }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 16 }}>
            <span style={{ color: BLUE }}>취소</span>
            <span style={{ fontWeight: 600 }}>홈 화면에 추가</span>
            <span style={{ position: "relative", color: BLUE, fontWeight: 700, padding: "6px 10px", borderRadius: 10, background: pressed(fr, S.tapAddBtn) }}>추가</span>
          </div>
          <div style={{ marginTop: 8, borderRadius: 12, background: "#fff", padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <Img src={staticFile("app/icon.png")} style={{ width: 62, height: 62, borderRadius: 14, border: `1px solid ${C.line}` }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 17, borderBottom: "1px solid #e6e8ec", paddingBottom: 6 }}>말씨앗</span>
              <span style={{ fontSize: 13, color: "#7a8494" }}>{ADDRESS}</span>
            </div>
          </div>
          <div style={{ marginTop: 16, borderRadius: 12, background: "#fff", height: 52, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 16 }}>
            웹 앱으로 열기
            <span style={{ width: 52, height: 32, borderRadius: 16, background: "#34c759", position: "relative" }}>
              <i style={{ position: "absolute", right: 2, top: 2, width: 28, height: 28, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </span>
          </div>
        </div>
      ) : null}
      <Tap fr={fr} at={S.tapSafDots} x={16 + 46 + 8 + 14 + 15} y={H - 36 - 23} />
      <Tap fr={fr} at={S.tapShare} x={170} y={rowY(1) + 23} />
      <Tap fr={fr} at={S.tapMore} x={W - 8 - 22 - 43} y={H - 8 - 520 + 26 + 90 + 89 + 89 + 14 + 30} />
      <Tap fr={fr} at={S.tapAdd} x={150} y={H - 30 - 24} />
      <Tap fr={fr} at={S.tapAddBtn} x={W - 40} y={54 + 28} />
    </div>
  );
}

// ---- ホーム画面 ----------------------------------------------------------------------------------------------------

const APPS = ["사진", "카메라", "메모", "시계", "날씨", "지도", "캘린더", "설정", "메일", "음악", "계산기"];
const APP_COLORS = ["#f2c66d", "#9aa3b2", "#f4d35e", "#2f3542", "#6fb1f2", "#7cc58f", "#f08a7e", "#a0a8b6", "#5d9cf0", "#f27c9c", "#6b7280"];

/** ホーム画面。말씨앗 のアイコンが、追加したところに現れる。 */
function Home({ fr, android, iconAt, tapAt }: { fr: number; android: boolean; iconAt: number; tapAt: number }) {
  const pop = prog(fr, iconAt, 14);
  const cols = 4;
  const size = 62;
  const gapX = (W - 32 - cols * size) / (cols - 1);
  const pos = (i: number) => ({ x: 16 + (i % cols) * (size + gapX), y: (android ? 70 : 86) + Math.floor(i / cols) * 100 });
  const k = pos(APPS.length);
  return (
    <div style={{ position: "absolute", inset: 0, background: android ? "#dfe7ef" : "#dbe8df" }}>
      <StatusBar android={android} />
      {APPS.map((name, i) => {
        const p = pos(i);
        return (
          <div key={name} style={{ position: "absolute", left: p.x, top: p.y, width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ width: size, height: size, borderRadius: android ? 31 : 15, background: APP_COLORS[i] }} />
            <span style={{ fontSize: 11.5, color: C.ink2 }}>{name}</span>
          </div>
        );
      })}
      {pop > 0 ? (
        <div style={{ position: "absolute", left: k.x - 4, top: k.y, width: size + 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transform: `scale(${0.4 + 0.6 * pop})`, opacity: pop }}>
          <Img src={staticFile("app/icon.png")} style={{ width: size, height: size, borderRadius: android ? 31 : 15, boxShadow: `0 0 0 ${(1 - prog(fr, iconAt + 14, 30)) * 8}px ${rgba(C.accent, 0.25)}` }} />
          <span style={{ fontSize: 11.5, color: C.ink, fontWeight: 600 }}>말씨앗</span>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 16, right: 16, bottom: android ? 28 : 22, height: 88, borderRadius: android ? 44 : 32, background: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {["#5d9cf0", "#7cc58f", "#f2c66d", "#9aa3b2"].map((c) => (
          <span key={c} style={{ width: size, height: size, borderRadius: android ? 31 : 15, background: c }} />
        ))}
      </div>
      <Tap fr={fr} at={tapAt} x={k.x + size / 2} y={k.y + size / 2} />
    </div>
  );
}

/** ホーム画面から開いた 말씨앗：ブラウザの枠が無い。アイコンから広がって開く。 */
function Opened({ fr, at, android }: { fr: number; at: number; android: boolean }) {
  const p = prog(fr, at, 14, SOFT);
  return (
    <div style={{ position: "absolute", inset: 0, transform: `scale(${0.25 + 0.75 * p})`, transformOrigin: "60% 45%", opacity: p, borderRadius: (1 - p) * 40, overflow: "hidden" }}>
      <StatusBar android={android} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: android ? 34 : 54, background: C.paper }} />
      <AppPage top={android ? 34 : 54} bottom={android ? 0 : 20} />
    </div>
  );
}

// ---- Android：Chrome ------------------------------------------------------------------------------------------------

/** Chrome（上にアドレスと「⋮」）。「⋮」→「홈 화면에 추가」→「설치」。 */
function Chrome({ fr }: { fr: number }) {
  const menu = prog(fr, S.chrMenu, 8) * (1 - prog(fr, S.dialog - 2, 6));
  const dialog = prog(fr, S.dialog, 10);
  const items = ["새 탭", "방문 기록", "다운로드", "북마크", "페이지에서 찾기", "홈 화면에 추가", "설정"];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff" }}>
      <StatusBar android />
      <div style={{ position: "absolute", left: 0, right: 0, top: 34, height: 56, display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 12px", background: "#fff", borderBottom: "1px solid #e8eaee", zIndex: 4 }}>
        <span style={{ flex: 1, height: 42, borderRadius: 21, background: "#eef1f4", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 15 }}>{ADDRESS}</span>
        <span style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${C.ink}`, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>1</span>
        <span style={{ width: 40, height: 44, borderRadius: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", background: pressed(fr, S.tapChrDots) }}>
          <VDots size={22} />
        </span>
      </div>
      <AppPage top={90} />
      {menu > 0 ? (
        <div style={{ position: "absolute", right: 8, top: 40, width: 250, borderRadius: 14, background: "#fff", boxShadow: "0 10px 30px rgba(23,32,51,0.2)", overflow: "hidden", opacity: menu, transform: `scale(${0.92 + 0.08 * menu})`, transformOrigin: "100% 0", zIndex: 6, paddingTop: 6 }}>
          <div style={{ height: 48, display: "flex", justifyContent: "space-around", alignItems: "center", fontSize: 18, color: C.ink2, borderBottom: "1px solid #eef0f3" }}>
            <span>→</span>
            <span>☆</span>
            <span>⤓</span>
            <span>ⓘ</span>
            <span>⟳</span>
          </div>
          {items.map((item, i) => (
            <div key={item} style={{ height: 46, padding: "0 18px", display: "flex", alignItems: "center", fontSize: 15.5, fontWeight: i === 5 ? 700 : 400, background: i === 5 ? (fr >= S.tapHomeA - 2 && fr < S.tapHomeA + 8 ? rgba(C.ink, 0.1) : C.tint) : undefined }}>
              {item}
            </div>
          ))}
        </div>
      ) : null}
      {dialog > 0 ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: rgba(C.ink, 0.32 * dialog), zIndex: 7 }} />
          <div style={{ position: "absolute", left: 28, right: 28, top: 300, borderRadius: 24, background: "#fff", padding: "24px 22px 16px", opacity: dialog, transform: `scale(${0.94 + 0.06 * dialog})`, zIndex: 8, display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>앱 설치</span>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Img src={staticFile("app/icon.png")} style={{ width: 48, height: 48, borderRadius: 24, border: `1px solid ${C.line}` }} />
              <span style={{ fontSize: 16 }}>말씨앗</span>
            </span>
            <span style={{ display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 15, fontWeight: 600 }}>
              <span style={{ padding: "10px 14px", color: C.accent }}>취소</span>
              <span style={{ padding: "10px 22px", borderRadius: 20, color: "#fff", background: fr >= S.tapInstall - 2 && fr < S.tapInstall + 8 ? "#0b5e3e" : C.accent }}>설치</span>
            </span>
          </div>
        </>
      ) : null}
      <Tap fr={fr} at={S.tapChrDots} x={W - 28} y={34 + 28} />
      <Tap fr={fr} at={S.tapHomeA} x={W - 135} y={40 + 6 + 48 + 5 * 46 + 23} />
      <Tap fr={fr} at={S.tapInstall} x={W - 28 - 22 - 34} y={300 + 24 + 28 + 16 + 48 + 16 + 20} />
    </div>
  );
}

// ---- 電話の中身（いつ、どの画面か） --------------------------------------------------------------------------------

/** いくつかの画面を、切り替わりで重ねて見せる。 */
function Shots({ fr, shots }: { fr: number; shots: { from: number; render: () => ReactNode; slide?: boolean }[] }) {
  return (
    <>
      {shots.map((s, i) => {
        const next = shots[i + 1]?.from ?? Infinity;
        if (fr < s.from || fr >= next + 10) return null;
        const p = prog(fr, s.from, 10, SOFT);
        const style: CSSProperties = s.slide ? { transform: `translateY(${(1 - p) * H}px)` } : { opacity: i === 0 ? 1 : p };
        return (
          <div key={i} style={{ position: "absolute", inset: 0, ...style }}>
            {s.render()}
          </div>
        );
      })}
    </>
  );
}

function IPhone({ fr }: { fr: number }) {
  return (
    <Shots
      fr={fr}
      shots={[
        { from: S.ios, render: () => <Post fr={fr} /> },
        { from: S.inapp, slide: true, render: () => <InAppBrowser fr={fr} android={false} tapAt={S.tapDots} menuAt={S.menu} pickAt={S.tapSafari} /> },
        { from: S.safari, render: () => <Safari fr={fr} /> },
        { from: S.home, render: () => <Home fr={fr} android={false} iconAt={S.icon} tapAt={S.tapIcon} /> },
        { from: S.open, render: () => <Opened fr={fr} at={S.open} android={false} /> },
      ]}
    />
  );
}

function AndroidPhone({ fr }: { fr: number }) {
  return (
    <Shots
      fr={fr}
      shots={[
        { from: S.android, render: () => <InAppBrowser fr={fr} android tapAt={S.tapDotsA} menuAt={S.menuA} pickAt={S.tapChrome} /> },
        { from: S.chrome, render: () => <Chrome fr={fr} /> },
        { from: S.homeA, render: () => <Home fr={fr} android iconAt={S.iconA} tapAt={S.tapIconA} /> },
        { from: S.openA, render: () => <Opened fr={fr} at={S.openA} android /> },
      ]}
    />
  );
}

// ---- 字幕 -----------------------------------------------------------------------------------------------------------

type Step = { from: number; to: number; n?: number; main: ReactNode; sub?: ReactNode };

/** 字幕の中の「≡」（字の大きさに合わせて描く）。 */
const LINES = (
  <span style={{ display: "inline-block", overflow: "hidden", width: "0.8em", height: "0.7em", verticalAlign: "0", margin: "0 0.12em" }}>
    <span style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: "0.06em 0" }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ display: "block", height: "0.09em", borderRadius: "0.05em", background: "currentColor" }} />
      ))}
    </span>
  </span>
);

/** 字幕の中の「⋮」（字の大きさに合わせて描く）。 */
const DOTS = (
  // overflow で、箱の下の端を字の並びの線にそろえる
  <span style={{ display: "inline-block", overflow: "hidden", width: "0.5em", height: "0.74em", verticalAlign: "0", margin: "0 0.12em" }}>
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ width: "0.15em", height: "0.15em", borderRadius: "50%", background: "currentColor" }} />
      ))}
    </span>
  </span>
);

const STEPS: Step[] = [
  { from: S.ios, to: S.inapp, main: "X에서 링크를 누르면…", sub: "X 앱 안의 브라우저로 열려요" },
  { from: S.inapp, to: S.i06, main: <>이대로는 홈 화면에<br />추가할 수 없어요</>, sub: "먼저 Safari로 다시 열어요" },
  { from: S.i06, to: S.safari, n: 1, main: <>아래 주소 옆 {DOTS} →<br />‘브라우저에서 열기’</>, sub: "평소 쓰는 브라우저(보통은 Safari)로 열려요" },
  { from: S.safari, to: S.share, n: 2, main: <>주소창의 {LINES} → ‘공유’</>, sub: <>{LINES} 버튼은 Safari 주소창 왼쪽 끝에 있어요</> },
  { from: S.share, to: S.addSheet, n: 3, main: <>‘더 보기’ →<br />‘홈 화면에 추가’</>, sub: "‘홈 화면에 추가’는 ‘더 보기’를 누르면 나와요" },
  { from: S.addSheet, to: S.home, n: 4, main: "‘추가’를 눌러요", sub: "‘웹 앱으로 열기’는 켠 채로 두세요" },
  { from: S.home, to: S.android - 12, main: "홈 화면 아이콘으로 열어요", sub: "Safari 테두리 없이, 앱 화면으로 열려요" },
  { from: S.android, to: S.chrome, n: 1, main: <>아래 주소 옆 {DOTS} →<br />‘브라우저에서 열기’</>, sub: "평소 쓰는 브라우저(보통은 Chrome)로 열려요" },
  { from: S.chrome, to: S.dialog, n: 2, main: <>Chrome 오른쪽 위 {DOTS} →<br />‘홈 화면에 추가’</>, sub: "‘앱 설치’라고 나올 수도 있어요" },
  { from: S.dialog, to: S.homeA, n: 3, main: "‘설치’를 눌러요" },
  { from: S.homeA, to: S.tip - 12, main: "홈 화면 아이콘으로 열어요", sub: "다음부터는 앱처럼 열 수 있어요" },
];

function StepCaption({ fr, step }: { fr: number; step: Step }) {
  if (fr < step.from - 2 || fr >= step.to + 12) return null;
  const out = fr >= step.to ? leave(fr, step.to, 10) : {};
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 180, display: "flex", flexDirection: "column", gap: 18, wordBreak: "keep-all", ...out }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, ...fall(fr, step.from, 14, 12) }}>
        {step.n ? (
          <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 32, background: C.accent, color: "#fff", fontSize: 34, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{step.n}</span>
        ) : null}
        <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.35, letterSpacing: "0.005em" }}>{step.main}</span>
      </div>
      {step.sub ? <span style={{ fontSize: 34, fontWeight: 500, color: C.ink2, lineHeight: 1.5, ...rise(fr, step.from + 6, 8, 12) }}>{step.sub}</span> : null}
    </div>
  );
}

/** 「iPhone」「Android」の札（左上）。 */
function Badge({ fr, from, to, text }: { fr: number; from: number; to: number; text: string }) {
  if (fr < from || fr >= to + 12) return null;
  const style = fr >= to ? leave(fr, to, 10) : fall(fr, from, 12, 12);
  return (
    <span style={{ position: "absolute", left: 80, top: 96, padding: "8px 22px", borderRadius: 999, border: `2px solid ${C.ink}`, fontSize: 30, fontWeight: 700, letterSpacing: "0.04em", ...style }}>{text}</span>
  );
}

// ---- はじめ・なぜ・うまくいかないとき・おわり --------------------------------------------------------------------

function Title({ fr }: { fr: number }) {
  if (fr >= S.why + 12) return null;
  const out = fr >= S.why ? leave(fr, S.why, 10) : {};
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, ...out }}>
      <Img src={staticFile("app/icon.png")} style={{ width: 220, height: 220, borderRadius: "22%", border: `2px solid ${C.line}`, ...fall(fr, 4, 22, 18) }} />
      <span style={{ fontFamily: FONT.wordmark, fontWeight: 700, fontSize: 72, letterSpacing: "0.1em", ...fall(fr, 10, 16, 16) }}>말씨앗</span>
      <span style={{ textAlign: "center", fontSize: 68, fontWeight: 700, lineHeight: 1.45, ...rise(fr, 22, 14, 16) }}>
        홈 화면에
        <br />
        추가하려면
      </span>
      <span style={{ padding: "12px 30px", borderRadius: 999, background: C.tint, color: C.accent, fontSize: 36, fontWeight: 600, ...rise(fr, 34, 10, 14) }}>X에서 링크를 연 분께</span>
    </AbsoluteFill>
  );
}

function Why({ fr }: { fr: number }) {
  if (fr < S.why - 2 || fr >= S.ios + 12) return null;
  const out = fr >= S.ios - 4 ? leave(fr, S.ios - 4, 12) : {};
  return (
    <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center", gap: 48, wordBreak: "keep-all", ...out }}>
      <span style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.45, ...fall(fr, S.why, 16, 14) }}>브라우저로만 열면, 모은 단어가 사라질 수 있어요.</span>
      <span style={{ fontSize: 40, fontWeight: 500, color: C.ink2, lineHeight: 1.6, ...rise(fr, S.why + 24, 12, 14) }}>
        한동안 열지 않으면 브라우저가 기록을 정리하기도 하거든요. 홈 화면에 추가하면 앱처럼 열리고, 기록도 남아요.
      </span>
    </AbsoluteFill>
  );
}

function Tip({ fr }: { fr: number }) {
  if (fr < S.tip - 2 || fr >= S.end + 12) return null;
  const out = fr >= S.end - 4 ? leave(fr, S.end - 4, 12) : {};
  return (
    <AbsoluteFill style={{ padding: "0 100px", justifyContent: "center", gap: 44, wordBreak: "keep-all", ...out }}>
      <span style={{ alignSelf: "flex-start", padding: "8px 22px", borderRadius: 999, border: `2px solid ${C.ink}`, fontSize: 30, fontWeight: 700, ...fall(fr, S.tip, 12, 12) }}>메뉴에서 찾을 수 없을 때는</span>
      <span style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.5, ...fall(fr, S.tip + 8, 14, 14) }}>
        링크를 복사해서 Safari(Android는 Chrome) 주소창에 붙여 넣어도 열려요.
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 36, color: C.ink2, ...rise(fr, S.tip + 30, 12, 14) }}>
        <span style={{ padding: "16px 26px", borderRadius: 16, background: C.surface }}>링크 복사</span>
        <Icon name="arrow" size={40} />
        <span style={{ padding: "16px 26px", borderRadius: 16, background: C.surface }}>주소창에 붙여 넣기</span>
      </div>
    </AbsoluteFill>
  );
}

function End({ fr }: { fr: number }) {
  if (fr < S.end) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36 }}>
      <Img src={staticFile("app/icon.png")} style={{ width: 240, height: 240, borderRadius: "22%", border: `2px solid ${C.line}`, ...fall(fr, S.end + 4, 22, 18) }} />
      <span style={{ fontFamily: FONT.wordmark, fontWeight: 700, fontSize: 80, letterSpacing: "0.1em", ...fall(fr, S.end + 10, 16, 16) }}>말씨앗</span>
      <span style={{ fontSize: 46, fontWeight: 600, ...rise(fr, S.end + 22, 12, 16) }}>아는 한자어가, 그대로 일본어가 된다.</span>
      <span style={{ padding: "12px 30px", borderRadius: 999, border: `2px solid ${C.line2}`, color: C.muted, fontSize: 34, ...rise(fr, S.end + 34, 10, 14) }}>가입 없이, 홈 화면에서 언제든지.</span>
    </AbsoluteFill>
  );
}

// ---- 音 ------------------------------------------------------------------------------------------------------------

function Clip({ from, src, volume }: { from: number; src: string; volume: number }) {
  return (
    <Sequence from={from} layout="none">
      <Audio src={staticFile(src)} volume={volume} />
    </Sequence>
  );
}

// ---- 全体 ----------------------------------------------------------------------------------------------------------

export function Install() {
  useFonts();
  const fr = useCurrentFrame();
  const iosIn = prog(fr, S.ios, 18) * (1 - prog(fr, S.android - 10, 10, SOFT));
  const andIn = prog(fr, S.android - 4, 18) * (1 - prog(fr, S.tip - 10, 10, SOFT));
  const music = (frame: number) => {
    let duck = 0;
    for (const v of VOICED) duck = Math.max(duck, Math.min(prog(frame, v.from - 6, 6, SOFT), 1 - prog(frame, v.to, 12, SOFT)));
    const fade = interpolate(frame, [0, 20, INSTALL_FRAMES - 45, INSTALL_FRAMES - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return 0.16 * (1 - 0.6 * duck) * fade;
  };
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: FONT.ui, WebkitFontSmoothing: "antialiased" }}>
      <style>{"* { box-sizing: border-box; }"}</style>
      <Title fr={fr} />
      <Why fr={fr} />
      <Badge fr={fr} from={S.ios} to={S.android - 12} text="iPhone" />
      <Badge fr={fr} from={S.android} to={S.tip - 12} text="Android" />
      {STEPS.map((s, i) => (
        <StepCaption key={i} fr={fr} step={s} />
      ))}
      {iosIn > 0 ? (
        <Phone style={{ opacity: iosIn, transform: `translateY(${(1 - prog(fr, S.ios, 18)) * 120}px)` }}>
          <IPhone fr={fr} />
        </Phone>
      ) : null}
      {andIn > 0 ? (
        <Phone android style={{ opacity: andIn, transform: `translateY(${(1 - prog(fr, S.android - 4, 18)) * 120}px)` }}>
          <AndroidPhone fr={fr} />
        </Phone>
      ) : null}
      <Tip fr={fr} />
      <End fr={fr} />
      <Audio src={staticFile("sound/music-install.wav")} volume={music} />
      {VOICED.map((v) => (
        <Clip key={v.id} from={v.from} src={`voice/${v.id}.wav`} volume={1} />
      ))}
      {TAPS.map((at) => (
        <Clip key={at} from={at - 2} src="sound/tap.wav" volume={0.5} />
      ))}
      <Clip from={S.icon + 4} src="sound/chime.wav" volume={0.26} />
      <Clip from={S.iconA + 4} src="sound/chime.wav" volume={0.26} />
    </AbsoluteFill>
  );
}
