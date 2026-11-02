// いつ何が起きるか（秒で決めて、コマにする）。打つ長さは打ち方（anim.ts koTyping・jaTyping）から、ナレーションの長さは
// クリップの長さ（src/voice.json：scripts/voice.mjs が書く）から。声が言い終わってから、次のできごとへ進む。
//
// 見る人：日本語の単語を一つずつ丸暗記している、韓国語を話す人。日本語の漢字語の多くは、韓国語の漢字語と同じ漢字・同じ
// 意味で、足りないのは日本語の音だけ。その音は字ごとの 소리 짝（회 → かい）で、짝が集まるほど言える語がまとめて増える。
// それが、そのままアプリになっていることを、アプリの画面で見せる。数はすべてアプリの辞書のとおり（scripts/net.mjs）：
// 회・사・원 の三つの 소리 짝 で 5語、網の 24の 소리 짝 で 55語。학생・대학・교실・사장 を集めた人が 회의 をあつめると +8。
import { f, jaTyping, koTyping } from "./anim";
import NET from "./net.json";
import VOICE from "./voice.json";

/** 모으기 で打つ語、말해 보기 で打つ読み（ローマ字で）、한국어와 다른 점 で打つ語。 */
export const TYPE_COLLECT = koTyping("회의");
export const TYPE_SAY = jaTyping("kyoukai", 5);
export const TYPE_DIFF = koTyping("공부");

const sec = (frames: number) => frames / 30;

type VoiceId = keyof typeof VOICE;
/** クリップの末尾の余白（声が消えてから残した 250ms と、足した 120ms）。次の声やできごとは、ここに重ねてよい。 */
const TAIL = 0.37;
/** 声が鳴っている長さ（秒）。 */
const said = (id: VoiceId) => VOICE[id] - TAIL;
/** ナレーションを置いた時（秒）。make() が積む。 */
const cues: { id: VoiceId; at: number }[] = [];
/** `at` 秒に声を置いて、言い終わる時（秒）を返す。 */
const say = (id: VoiceId, at: number) => {
  cues.push({ id, at });
  return at + said(id);
};

/** 網：一つずつ組み上がる語の日本語の声（net.json の slow と同じ並び：학생・대학・선생・시간・전화・한국어・외국인）。 */
const SLOW_VOICE: VoiceId[] = ["J06", "J07", "J08", "J09", "J10", "J11", "J12"];
/** 残りの語が一気に組み上がる長さ（秒）。 */
const BURST = 1.8;
if (SLOW_VOICE.length !== NET.slow) throw new Error("SLOW_VOICE と net.json の slow の数が合わない");

/** 소리 짝：받침ごとに、日本語の音の終わりが光る順（その 받침 の札が一斉に）。 */
export const PAIR_GLOW = ["ㄱ", "ㄴ", "ㄹ", "ㅇ"] as const;

function make() {
  // A. 一語ずつ丸暗記していた5語（かいしゃ・しゃかい…）は、三つの 소리 짝（회 → かい・사 → しゃ・원 → いん）でできていた。
  //    짝が増えると、つながりは網になる。net：三つの札が輪に移る。web：はじめの5語の線。words：一つずつの語。
  //    burst：残りが一気に。total：소리 짝 24개로, 55단어。
  const hook = { start: 0, cards: 0.7, split: 0, tiles: 0, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, count: 0, net: 0, web: 0, words: 0, burst: 0, total: 0, known: 0, end: 0 };
  hook.split = say("V01", 0.25) + 0.15;
  hook.tiles = hook.split + 0.3;
  // 한자 하나하나의 소리를 짝지어 보면, → 語が一つずつ組み上がる。そのたびに、その語の日本語の声。
  let at = say("V02", hook.split + 0.15) + 0.12;
  const chips = (["J01", "J02", "J03", "J04", "J05"] as VoiceId[]).map((id) => {
    const from = at;
    at = say(id, from) + 0.12;
    return from;
  });
  [hook.w1, hook.w2, hook.w3, hook.w4, hook.w5] = chips;
  // 소리 짝 3개로, 5단어.（字幕と鈴だけ）
  hook.count = at + 0.25;
  hook.net = hook.count + 1.2;
  hook.web = hook.net + 0.75;
  hook.words = hook.net + 1.05;
  at = hook.words;
  const slowAt = SLOW_VOICE.map((id) => {
    const from = at;
    at = say(id, from) + 0.06;
    return from;
  });
  hook.burst = at + 0.3;
  // 소리 짝 24개로, 55단어.（字幕と鈴だけ）→ 뜻은, 이미 알고 있어요. 모르는 건, 일본어 소리뿐이에요.
  hook.total = hook.burst + BURST + 0.15;
  hook.known = hook.total + 1.2;
  hook.end = say("V03", hook.known + 0.25) + 0.6;

  // B. 말씨앗
  const title = { start: hook.end, icon: hook.end + 0.3, word: hook.end + 0.7, lead: hook.end + 1.5, end: 0 };
  title.end = say("V04", title.word - 0.05) + 0.5;

  // C. 모으기：학생・대학・교실・사장 を集めたところに、회의 を打つ → 会議 かいぎ と 소리 짝（회 → かい・의 → ぎ）。
  //    모으기 を押すと +8（회사・교회・사회・회의실…）、일본어로 말할 수 있는 한자어 は 6 → 15。
  const c = { start: title.end - 0.2, cap1: 0, focus: 0, type: 0, look: 0, found: 0, cap2: 0, press: 0, done: 0, count: 0, end: 0 };
  c.cap1 = c.start + 0.4;
  c.focus = c.start + 0.7;
  c.type = c.start + 1.0;
  c.look = c.type + sec(TYPE_COLLECT.duration) + 0.3;
  c.found = c.look + 0.25;
  // 아는 한자어를 입력하면, 같은 한자의 일본어 단어와 소리 짝이 나와요. ── 言い終わるころに、결과を見せ終える。
  const v05 = say("V05", c.start + 0.45);
  // 모으면, ── と言うところで押す。
  c.cap2 = Math.max(c.found + 2.4, v05 + 0.25);
  c.press = c.cap2 + 0.35;
  c.done = c.press + 0.25;
  const v06 = say("V06", c.cap2 + 0.1);
  c.count = c.done + 2.6;
  c.end = Math.max(c.count + 2.0, v06 + 0.7);

  // D. 말해 보기：교회 を見て、자分で きょうかい と打つ。배우지 않은 단어인데도요。
  const r = { start: c.end, cap3: 0, type: 0, submit: 0, success: 0, cap4: 0, end: 0 };
  r.cap3 = r.start + 0.2;
  const v07 = say("V07", r.start + 0.35);
  r.type = v07 - 0.9;
  r.submit = r.type + sec(TYPE_SAY.duration) + 0.35;
  r.success = Math.max(r.submit + 0.2, v07 + 0.15);
  r.cap4 = r.success + 0.25;
  r.end = say("V08", say("J13", r.success + 0.1) + 0.2) + 0.7;

  // E. 소리 짝：받침ごとに並べると、対応が見えてくる。ㄱ → く・ㄴ → ん・ㄹ → つ・ㅇ → い／う が順に光る。
  const p = { start: r.end, cap5: 0, scroll: 0, glow: 0, end: 0 };
  p.cap5 = p.start + 0.2;
  const v09 = say("V09", p.start + 0.4);
  p.scroll = p.start + 1.4;
  p.glow = p.start + 2.6;
  p.end = Math.max(p.glow + PAIR_GLOW.length * 0.75 + 1.4, v09 + 1.0);

  // F. 한국어와 다른 점：공부 を打つ → 일본어에서는 다른 한자로 말해요。勉強 べんきょう／工夫 くふう（궁리）。
  const d = { start: p.end, cap6: 0, focus: 0, type: 0, look: 0, found: 0, hl: 0, hl2: 0, end: 0 };
  d.cap6 = d.start + 0.2;
  const v10 = say("V10", d.start + 0.35);
  d.focus = d.start + 0.5;
  d.type = d.start + 0.8;
  d.look = d.type + sec(TYPE_DIFF.duration) + 0.3;
  d.found = d.look + 0.25;
  // 공부는, 일본어로 ── べんきょう。（勉強 が灯る）
  d.hl = Math.max(d.found + 0.8, v10 + 0.2);
  const v11 = say("V11", d.hl);
  d.hl2 = say("J14", v11 + 0.05) + 0.4;
  d.end = d.hl2 + 2.2;

  // G. 문장에서 만나기：集めた語の入った日本語の文が降る。集めた語は紫の点線、言える語（会社・教会）はふりがなを ？ で伏せる。
  const m = { start: d.end, cap7: 0, line1: 0, line2: 0, line3: 0, line4: 0, marks: 0, spot: 0, end: 0 };
  m.cap7 = m.start + 0.2;
  m.line1 = m.start + 0.5;
  m.line2 = m.start + 1.1;
  m.line3 = m.start + 1.7;
  m.line4 = m.start + 2.3;
  m.marks = say("V12", m.start + 0.45) + 0.15;
  m.spot = m.marks + 0.2;
  m.end = say("V13", m.marks + 0.05) + 1.3;

  // H. 終わり
  const end = { start: m.end, icon: m.end + 0.3, word: m.end + 0.7, lead: m.end + 1.4, rest: m.end + 2.1, end: 0 };
  end.end = Math.max(end.start + 6.0, say("V14", end.word + 0.05) + 1.6);

  return { hook, title, collect: c, say: r, pairs: p, diff: d, meet: m, end, slowAt };
}

const S = make();
const frames = <T extends Record<string, number>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as { [K in keyof T]: number };

export const T = {
  hook: frames(S.hook),
  title: frames(S.title),
  collect: frames(S.collect),
  say: frames(S.say),
  pairs: frames(S.pairs),
  diff: frames(S.diff),
  meet: frames(S.meet),
  end: frames(S.end),
};

export const TOTAL = f(S.end.end);

/** ナレーション：クリップと、鳴らしはじめるコマ・声が消えるコマ（音楽はこの間だけ下がる）。 */
export const VOICE_AT = cues.map((c) => ({ id: c.id, from: f(c.at), until: f(c.at + said(c.id)) }));

/** 網の語が組み上がるコマ（net.json の並び）。はじめの5語は輪ができたとき、次の語はその声と一緒に一つずつ、残りは一気に。 */
export const NET_AT: number[] = NET.words.map((_, i) => {
  if (i < NET.first) return f(S.hook.web);
  if (i < NET.first + NET.slow) return f(S.slowAt[i - NET.first]);
  const n = NET.words.length - NET.first - NET.slow;
  return f(S.hook.burst + (BURST * (i - NET.first - NET.slow)) / n);
});

/** 音楽の区切り（秒）。scripts/music.py に渡す。 */
export const MUSIC_MARKS = { title: S.title.start, story: S.collect.start, later: S.pairs.start, end: S.end.start, total: S.end.end };
