// 使われ方の数（何人が使っているか）。端末ごとの番号（この端末で作った乱数。人とは結びつかない）と、開いた・あつめた・
// 読めた の回数と、ホーム画面から開いたかだけを、姉妹アプリ ことのあめ の Supabase（kh_ping、supabase/usage.sql）に送る。
// 集めた語・文は送らない。自分 で止められる。送れなくても（オフライン・送り先が無い）何も起きない。
// 数えるのは公開先（.env の VITE_SITE_URL）で開いたときだけ。手元の npm run dev・preview や、Vercel の試しの公開は数えない。
import { isStandalone } from "./install";

export type UsageKind = "open" | "collect" | "read";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SITE = import.meta.env.VITE_SITE_URL as string | undefined;
const DEVICE = "kotonohashi.device";
/** 自分 の「使われ方の数を送る」（util/local の usePref と同じ形：1 か 0）。 */
export const SEND_PREF = "sendUsage";

function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE, id);
    }
    return id;
  } catch {
    return null;
  }
}

function allowed(): boolean {
  try {
    return localStorage.getItem(`kotonohashi.${SEND_PREF}`) !== "0";
  } catch {
    return true;
  }
}

/** 公開先で開いているか（数える・みんなの雨に送るのは、このときだけ）。 */
export function onPublicSite(): boolean {
  if (!import.meta.env.PROD || !SITE) return false;
  try {
    return location.origin === new URL(SITE).origin;
  } catch {
    return false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 引き継ぎのリンク（util/carry）に添える数の決まり。送るのを止めていれば u=0 だけ（番号は添えない）、でなければこの端末の番号。 */
export function usageForCarry(): Record<string, string> {
  if (!allowed()) return { u: "0" };
  const device = deviceId();
  return device ? { i: device } : {};
}

/**
 * 引き継ぎのリンクで移ってきたら、前のところの番号を引き継ぐ（移った先でも同じ1台に数える）。replace でなければ、
 * ここにまだ番号が無いときだけ。前のところで送るのを止めていたら、ここでも止める。
 */
export function adoptCarriedUsage(params: URLSearchParams, replace: boolean): void {
  try {
    if (params.get("u") === "0") localStorage.setItem(`kotonohashi.${SEND_PREF}`, "0");
    const id = params.get("i");
    if (id && UUID.test(id) && (replace || !localStorage.getItem(DEVICE))) localStorage.setItem(DEVICE, id);
  } catch {
    /* 引き継げなければ、ここの番号で数えるだけ */
  }
}

/** Supabase の関数（supabase/usage.sql・falls.sql。名前は kh_ で始まる）を呼ぶ。送り先が無ければ null。 */
export function rpc(name: string, body: unknown): Promise<Response> | null {
  if (!URL_ || !KEY) return null;
  return fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

/** 一つ数える（待たない）。 */
export function countUsage(kind: UsageKind): void {
  if (!onPublicSite() || !allowed()) return;
  const device = deviceId();
  if (!device) return;
  rpc("kh_ping", { p_device: device, p_kind: kind, p_standalone: isStandalone() })?.catch(() => {
    /* 数えられなかっただけ */
  });
}

/** 送り先（Supabase）があるか。無ければ、みんなの雨の入口も出さない。 */
export function hasServer(): boolean {
  return Boolean(URL_ && KEY);
}
