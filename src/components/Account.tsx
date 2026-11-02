import { useEffect, useState, type FormEvent } from "react";
import { t } from "../copy";
import {
  hasAccounts,
  KOTONOAME_URL,
  signIn,
  signInWithKotonoame,
  signOut,
  syncRecord,
  useAccount,
  useSyncStatus,
  type SignInResult,
} from "../util/account";
import { connectInProgress, finishConnect, startConnect } from "../util/connect";
import app from "../app.module.css";
import styles from "./Account.module.css";

const when = (at: number) => new Date(at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 自分 の「계정」：ことのあめ のアカウント（任意）。ログインしていなければ、ことのあめ でつなぐ（そこで登録・Google も）か、
 * メールアドレスとパスワード。していれば、だれで入っているかと、最後に記録を合わせた時刻、ログアウト。
 * ことのあめ から戻ってきたら、ここでログインを終える（util/connect）。アカウントの使えない版では出さない。
 */
export function AccountSection() {
  const me = useAccount();
  const sync = useSyncStatus();
  const [connecting, setConnecting] = useState(connectInProgress);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // ことのあめ から戻ってきた：印でログインする（戻ってきた一回につき一度。util/connect）。
  useEffect(() => {
    const done = finishConnect(signInWithKotonoame);
    if (!done) return;
    let alive = true;
    void done.then((r) => {
      if (!alive) return;
      setConnecting(false);
      setNote(r.ok ? { ok: true, text: t.account.connected } : { ok: false, text: r.reason === "stale" ? t.account.connectStale : t.account.connectFailed });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!hasAccounts()) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const result: SignInResult = await signIn(email, password);
    setBusy(false);
    if (result.ok) {
      setPassword("");
      return;
    }
    setNote({ ok: false, text: t.account.errors[result.reason] });
  }

  async function syncNow() {
    setBusy(true);
    await syncRecord();
    setBusy(false);
  }

  async function leave() {
    setBusy(true);
    await signOut();
    setBusy(false);
    setNote(null);
  }

  return (
    <section className={styles.section} aria-busy={me === undefined || connecting}>
      <h2 className={styles.title}>{t.account.title}</h2>
      {note ? (
        <p className={note.ok ? styles.ok : app.error} role="status">
          {note.text}
        </p>
      ) : null}

      {me === undefined || connecting ? (
        <p className={app.note}>{connecting ? t.account.connecting : t.common.loading}</p>
      ) : me ? (
        <>
          <p className={styles.who}>{t.account.signedIn(me.email ?? "")}</p>
          <p className={app.note}>{t.account.signedInNote}</p>
          {sync.failed ? (
            <p className={app.error}>{t.account.syncFailed}</p>
          ) : sync.at ? (
            <p className={app.note}>{t.account.synced(when(sync.at))}</p>
          ) : null}
          <div className={styles.row}>
            <button type="button" className="btn-quiet" onClick={syncNow} disabled={busy}>
              {t.account.syncNow}
            </button>
            <button type="button" className="btn-quiet" onClick={leave} disabled={busy}>
              {t.account.signOut}
            </button>
          </div>
          <p className={app.note}>{t.account.signOutNote}</p>
        </>
      ) : (
        <>
          <p className={app.note}>{t.account.lead}</p>
          <button type="button" className="btn" onClick={() => startConnect(KOTONOAME_URL)}>
            {t.account.connect}
          </button>
          <p className={app.note}>{t.account.connectNote}</p>
          <details className={styles.byEmail}>
            <summary>{t.account.byEmail}</summary>
            <form onSubmit={submit} className={styles.form}>
              <label htmlFor="account-email" className="label">
                {t.account.email}
              </label>
              <input
                id="account-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
              <label htmlFor="account-password" className="label">
                {t.account.password}
              </label>
              <input
                id="account-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
              <button type="submit" className="btn" disabled={busy}>
                {busy ? t.account.signingIn : t.account.signIn}
              </button>
              <button type="button" className={styles.link} onClick={() => startConnect(KOTONOAME_URL, { forgot: true })}>
                {t.account.forgot}
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}
