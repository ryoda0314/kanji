// ことのあめ でつなぐ：ことのあめ の /connect へ行き（そこでログインか新しく登録。韓国語の画面）、「연결하기」を押すと、
// 一回だけ使えるログインの印を URL の # の後ろに付けて /login に戻ってくる。それでここでもログインする（util/account）。
// 出る前にこの端末に乱数（state）を置き、戻ってきた印と同じ乱数が揃ったときだけ使う：だれかの印の付いたリンクを開かされて、
// 知らない人のアカウントにログインし、集めた語をそこへ送ってしまうことがないように。ことのあめ が印を送るのは、知っている
// 姉妹アプリの公開先（ことのあめ の src/lib/sisters.ts）か、開発中のこのコンピューターだけ。
// ことのあめ の姉妹アプリ（ことのめ・ことのは…）の src/lib/connect.ts と同じ決まり（APP と、ハッシュのルーターでの受け取り方が違う）。
// readReturn は純粋：connect.test.ts で確かめる。

/** ことのあめ でのこのアプリの名前。 */
export const APP = "kotonohashi";
const KEY = "kotonohashi.connect";
/** つなぐのにかかってよい時間：新しく登録したときの確認メールは、少しあとに開くこともある。 */
export const KEEP_MS = 3 * 3_600_000;
/** 戻ってきたら開く画面（ルーターのパス）。 */
export const BACK_TO = "/me";

export type Pending = { state: string; at: number };
export type Returned = { token: string } | { error: "stale" } | null;
export type Finished = { ok: true } | { ok: false; reason: "stale" | "failed" };

/** ことのあめ が # の後ろに付けて返したもの。この端末で始めたつなぐと照らし合わせる。何も来ていなければ null。 */
export function readReturn(hash: string, pending: Pending | null, now: number): Returned {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("kotonoame");
  if (!token) return null;
  if (!pending || params.get("state") !== pending.state || !(now - pending.at <= KEEP_MS)) return { error: "stale" };
  return { token };
}

function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * ことのあめ へ。forgot なら、ことのあめ の「비밀번호를 잊었어요」から（新しいパスワードを決めたら、そのままつなぐ）。
 * 戻り先は、このアプリの公開先（または開発中のこのコンピューター）の /login。
 */
export function startConnect(kotonoameUrl: string, { forgot = false } = {}): void {
  const state = newState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, at: Date.now() } satisfies Pending));
  } catch {
    // 置けなければ、戻ってきた印は古いものとして断られ、何もログインしない。
  }
  const connect = `/connect?${new URLSearchParams({ app: APP, back: location.origin, state })}`;
  location.assign(forgot ? `${kotonoameUrl}/login/forgot?${new URLSearchParams({ next: connect })}` : `${kotonoameUrl}${connect}`);
}

let returned: Returned = null;

/**
 * 起動したとき（ルーターより先に。main.tsx）：ことのあめ から戻ってきた（/login、# に印）なら、印を受け取って URL から消し、
 * 開く画面（BACK_TO）を返す。印は使っても使わなくても一度きりなので、置いておいたつなぐも消す。戻ってきたのでなければ null。
 */
export function captureReturn(): string | null {
  const fromKotonoame = location.hash.includes("kotonoame=");
  if (!fromKotonoame && !/\/login\/?$/.test(location.pathname)) return null;
  if (fromKotonoame) {
    let pending: Pending | null = null;
    try {
      pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pending | null;
      localStorage.removeItem(KEY);
    } catch {
      pending = null;
    }
    returned = readReturn(location.hash, pending, Date.now());
  }
  return BACK_TO;
}

let finishing: Promise<Finished> | undefined;

/** ことのあめ から戻ってきて、まだログインしている途中か。 */
export const connectInProgress = () => finishing !== undefined || returned !== null;

/**
 * 戻ってきた印でログインする（何も来ていなければ null）。戻ってきた一回につき一度だけ：開発中の React は効果を二度走らせるが、
 * 印は二度使えない。
 */
export function finishConnect(signIn: (token: string) => Promise<boolean>): Promise<Finished> | null {
  if (finishing) return finishing;
  const back = returned;
  returned = null;
  if (!back) return null;
  const done: Promise<Finished> =
    "error" in back ? Promise.resolve({ ok: false, reason: "stale" }) : signIn(back.token).then((ok): Finished => (ok ? { ok: true } : { ok: false, reason: "failed" }));
  finishing = done;
  void done.finally(() => setTimeout(() => (finishing = undefined), 0));
  return done;
}
