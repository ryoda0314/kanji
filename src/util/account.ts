// ことのあめ のアカウント（任意）。ことのあめ と同じ Supabase のアカウントでログインすると、集めた語（覚え具合も）を
// アカウントにも置き（kh_records、supabase/records.sql。ブラウザから本人として読み書きし、自分の行しか見えない）、
// 端末の記録と上書きせずに合わせる（data/record）。スマホとパソコンで使っても、何も失わない。
// ログインは ことのあめ でつなぐ（util/connect。新しい登録・Google も ことのあめ の画面で）か、ことのあめ のメールアドレスと
// パスワード。送れなくても、端末の記録はそのまま（次に変えたときにまた送る）。
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { mergeRecords, reviveRecord, sameRecord, type RecordState } from "../data/record";
import { applyRecord, db, recordWords } from "../db";
import { readRemoved, writeRemoved } from "./removed";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** ことのあめ の公開先（つなぐ・新しい登録・パスワードを忘れたときの画面）。 */
export const KOTONOAME_URL = ((import.meta.env.VITE_KOTONOAME_URL as string | undefined) || "https://polylinga.vercel.app").replace(/\/$/, "");

const APP = "kotonohashi";
const TABLE = "kh_records";
const PUSH_AFTER_MS = 2000;
const PULL_TIMEOUT_MS = 5000;
const SYNCED = "kotonohashi.synced";

let client: SupabaseClient | null | undefined;

/** null なら、アカウントは使えない（送り先の無い版。端末の中だけで動く）。 */
export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    client =
      URL_ && KEY
        ? createClient(URL_, KEY, {
            // # の後ろはルーターのもの。ログインの印は util/connect が受け取る。
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "kotonohashi.auth" },
          })
        : null;
  }
  return client;
}

/** アカウントを使えるか（ことのあめ の Supabase の送り先がある版か）。 */
export const hasAccounts = () => Boolean(URL_ && KEY);

export type Account = { id: string; email: string | null };

const toAccount = (user: User | null | undefined): Account | null =>
  user && !user.is_anonymous ? { id: user.id, email: user.email ?? null } : null;

/** ログインしているアカウント（端末に残したセッションから。問い合わせない）。 */
export async function account(): Promise<Account | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return toAccount(data.session?.user);
}

/** ログインしているアカウント。読んでいるあいだは undefined、していなければ null。 */
export function useAccount(): Account | null | undefined {
  const [me, setMe] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setMe(null);
      return;
    }
    let alive = true;
    void account().then((a) => alive && setMe(a));
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (alive) setMe(toAccount(session?.user));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return me;
}

// --- 合わせた時刻（自分 の画面に出す） ---------------------------------------------

export type SyncStatus = { at: number | null; failed: boolean };
let status: SyncStatus = { at: readSynced(), failed: false };
const listeners = new Set<() => void>();

function readSynced(): number | null {
  try {
    const at = Number(localStorage.getItem(SYNCED));
    return Number.isFinite(at) && at > 0 ? at : null;
  } catch {
    return null;
  }
}

function setStatus(next: SyncStatus): void {
  status = next;
  try {
    if (next.at) localStorage.setItem(SYNCED, String(next.at));
  } catch {
    /* 画面に出す時刻が残らないだけ */
  }
  for (const l of listeners) l();
}

/** 最後にアカウントの記録と合わせた時刻と、最後に合わせられなかったか。 */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status
  );
}

// --- 合わせる ----------------------------------------------------------------------

const timeout = <T>(p: PromiseLike<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function localRecord(): Promise<RecordState> {
  return { app: APP, version: 1, words: await recordWords(), removed: readRemoved() };
}

// 合わせた語をこの端末に入れているあいだの書き込みは、送る合図にしない。
let applying = false;

async function syncOnce(): Promise<void> {
  const sb = supabase();
  const me = await account();
  if (!sb || !me) return;
  try {
    const local = await localRecord();
    const { data, error } = await timeout(sb.from(TABLE).select("state").eq("user_id", me.id).maybeSingle(), PULL_TIMEOUT_MS);
    if (error) throw error;
    const remote = data ? reviveRecord(data.state, APP) : null;
    const merged = remote ? mergeRecords(local, remote) : mergeRecords(local, local);
    if (!sameRecord(merged, local)) {
      applying = true;
      try {
        // 合わせているあいだにここで消した語も残す。
        const removed = { ...merged.removed };
        for (const [k, at] of Object.entries(readRemoved())) removed[k] = Math.max(at, removed[k] ?? 0);
        writeRemoved(removed);
        await applyRecord(merged.words, removed);
      } finally {
        applying = false;
      }
    }
    if (!remote || !sameRecord(merged, remote)) {
      const { error: pushError } = await sb.from(TABLE).upsert({ user_id: me.id, state: merged, updated_at: new Date().toISOString() });
      if (pushError) throw pushError;
    }
    setStatus({ at: Date.now(), failed: false });
  } catch {
    // 端末の記録はそのまま。次に変えたとき・開いたときに、また合わせる。
    setStatus({ ...status, failed: true });
  }
}

let running = false;
let again = false;

/** 端末の記録とアカウントの記録を一つにして、両方に置く（ログインしていなければ何もしない）。重ねて呼ばれたら、終わってからもう一度。 */
export async function syncRecord(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await syncOnce();
    } while (again);
  } finally {
    running = false;
  }
}

// 語を集めた・読んだ・消したあと、少しして送る（続けて集めても一度に）。画面を離れたとき（スマホを閉じた・タブを移った）も。
let pending = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending) return;
  pending = false;
  await syncRecord();
}

function changed(): void {
  if (applying || !hasAccounts()) return;
  pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), PUSH_AFTER_MS);
}

let started = false;

/** 辞書を読んだあとに一度（components/Layout）：ログインしていれば合わせ、それからは変わるたびに送る。 */
export function startSync(): void {
  if (started || !hasAccounts()) return;
  started = true;
  // Dexie のフック：返した値は鍵や書き換えに使われるので、何も返さない。
  db.words.hook("creating", () => {
    changed();
  });
  db.words.hook("updating", () => {
    changed();
  });
  db.words.hook("deleting", () => {
    changed();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  void syncRecord();
}

// --- ログイン ----------------------------------------------------------------------

export type SignInResult = { ok: true } | { ok: false; reason: "credentials" | "unconfirmed" | "busy" | "failed" | "unavailable" };

/** ことのあめ のアカウントのメールアドレスとパスワードで。すぐに記録を合わせる。 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const sb = supabase();
  if (!sb) return { ok: false, reason: "unavailable" };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 429) return { ok: false, reason: "busy" };
    if (error.code === "email_not_confirmed") return { ok: false, reason: "unconfirmed" };
    if (error.code === "invalid_credentials" || error.status === 400) return { ok: false, reason: "credentials" };
    return { ok: false, reason: "failed" };
  }
  await syncRecord();
  return { ok: true };
}

/** ことのあめ でつないで戻ってきた、一回きりの印で（util/connect）。すぐに記録を合わせる。 */
export async function signInWithKotonoame(tokenHash: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return false;
  await syncRecord();
  return true;
}

/** この端末だけログアウトする（ことのあめ やほかの端末はそのまま）。端末の記録は残る。 */
export async function signOut(): Promise<void> {
  await flush();
  await supabase()?.auth.signOut({ scope: "local" });
}
