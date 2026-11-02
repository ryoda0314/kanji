// ホーム画面への追加のしかた（src/Install.tsx）の、いつ何が起きるか。映像の時は、ナレーション（voice/lines.json の I01〜、
// 長さは src/voice.json）から決まる。指で押すのは、声が「누르고」「골라요」と言うところ（クリップの長さの割合で置く。
// 韓国語の文の中のその語の位置。言い方を変えたら、ここも合わせる）。声が言い終わってから次の画面へ。
// 音楽の区切り（INSTALL_MARKS）は scripts/marks.mjs install が scripts/music.py に渡す。
import { f } from "./anim";
import VOICE from "./voice.json";

type VoiceId = keyof typeof VOICE;
/** クリップの末尾の余白（声が消えてから残した 250ms と、足した 120ms）。 */
const TAIL = 0.37;
/** 声が鳴っている長さ（秒）。 */
const said = (id: VoiceId) => VOICE[id] - TAIL;
/** ナレーションを置いた時（秒）。 */
const cues: { id: VoiceId; at: number }[] = [];
/** `at` 秒に声を置いて、言い終わる時（秒）を返す。 */
const say = (id: VoiceId, at: number) => {
  cues.push({ id, at });
  return at + said(id);
};

function make() {
  const t: Record<string, number> = {};
  const e01 = say("I01", 0.7);
  t.why = Math.max(3.2, e01 + 0.5);
  t.ios = say("I02", t.why + 0.3) + 0.9;
  t.i05 = say("I04", t.ios + 0.5) + 0.15;
  const e05 = say("I05", t.i05);
  t.tapLink = t.i05 + said("I05") * 0.3; // 「링크를 누르면」
  t.inapp = t.tapLink + 0.4;
  t.i06 = Math.max(e05 + 0.35, t.inapp + 1.2);
  const e06 = say("I06", t.i06);
  t.tapDots = t.i06 + said("I06") * 0.5; // 「버튼을 누르고」
  t.menu = t.tapDots + 0.25;
  t.tapSafari = e06 - 0.15; // 「골라요」
  t.safari = t.tapSafari + 0.35;
  t.i07 = t.safari + 0.35;
  const e07 = say("I07", t.i07);
  t.tapSafDots = t.i07 + said("I07") * 0.72; // 「버튼을 누르고」
  t.safMenu = t.tapSafDots + 0.25;
  t.tapShare = e07 - 0.15; // 「공유를 눌러요」
  t.share = t.tapShare + 0.25;
  t.i08 = t.share + 0.35;
  const e08 = say("I08", t.i08);
  t.tapMore = t.i08 + said("I08") * 0.33; // 「더 보기를 누르고」
  t.more = t.tapMore + 0.25;
  t.tapAdd = e08 - 0.15; // 「골라요」
  t.addSheet = t.tapAdd + 0.25;
  t.i09 = t.addSheet + 0.45;
  t.tapAddBtn = say("I09", t.i09) - 0.15;
  t.home = t.tapAddBtn + 0.6;
  t.icon = t.home + 0.4;
  t.i10 = t.icon + 0.25;
  const e10 = say("I10", t.i10);
  t.tapIcon = t.i10 + said("I10") * 0.65; // 「누르면」
  t.open = t.tapIcon + 0.3;
  t.android = Math.max(e10, t.open + 1.4) + 0.7;
  t.i12 = say("I11", t.android + 0.45) + 0.2;
  const e12 = say("I12", t.i12);
  t.tapDotsA = t.i12 + said("I12") * 0.52; // 「버튼을 누르고」
  t.menuA = t.tapDotsA + 0.25;
  t.tapChrome = e12 - 0.15;
  t.chrome = t.tapChrome + 0.35;
  t.i13 = t.chrome + 0.35;
  const e13 = say("I13", t.i13);
  t.tapChrDots = t.i13 + said("I13") * 0.62; // 「버튼을 누르고」
  t.chrMenu = t.tapChrDots + 0.25;
  t.tapHomeA = e13 - 0.15;
  t.dialog = t.tapHomeA + 0.25;
  t.i14 = t.dialog + 0.4;
  const e14 = say("I14", t.i14);
  t.tapInstall = t.i14 + said("I14") * 0.45; // 「설치를 누르면」
  t.homeA = t.tapInstall + 0.6;
  t.iconA = t.homeA + 0.4;
  t.i15 = Math.max(e14 + 0.25, t.iconA + 0.25);
  const e15 = say("I15", t.i15);
  t.tapIconA = t.i15 + said("I15") * 0.55; // 「아이콘을 누르면」
  t.openA = t.tapIconA + 0.3;
  t.tip = Math.max(e15, t.openA + 1.4) + 0.7;
  t.end = say("I16", t.tip + 0.45) + 0.8;
  t.total = say("I17", t.end + 0.7) + 1.5;
  return t;
}

/** 場面の時（秒）。 */
export const SEC = make();
/** 場面の時（コマ）。 */
export const S = Object.fromEntries(Object.entries(SEC).map(([k, v]) => [k, f(v)])) as Record<keyof typeof SEC, number>;
export const INSTALL_FRAMES = S.total;
/** 声の鳴っている間（コマ）。そのあいだ音楽を下げる。 */
export const VOICED = cues.map((c) => ({ id: c.id, from: f(c.at), to: f(c.at + said(c.id)) }));

export const TAPS = [S.tapLink, S.tapDots, S.tapSafari, S.tapSafDots, S.tapShare, S.tapMore, S.tapAdd, S.tapAddBtn, S.tapIcon, S.tapDotsA, S.tapChrome, S.tapChrDots, S.tapHomeA, S.tapInstall, S.tapIconA];

/** 音楽の区切り（秒）。scripts/music.py に渡す（--music music-install.wav）。 */
export const INSTALL_MARKS = { title: SEC.why, story: SEC.ios, later: SEC.android, end: SEC.end, total: SEC.total };
