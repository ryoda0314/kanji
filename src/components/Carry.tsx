import { useEffect, useId, useState, type FormEvent } from "react";
import { t } from "../copy";
import { carryLink, carryParams, receiveCarry } from "../util/carry";
import { useWords } from "../util/live";
import app from "../app.module.css";
import styles from "./Carry.module.css";

/**
 * 引き継ぎのリンクを作ってコピーし、このページのアドレスにもする（X などの中で「Safari で開く」を選ぶと、そのまま移れる）。
 * コピーは押したその場でしか許さない端末があるので、リンクは先に作っておく。
 */
export function CarrySend() {
  const words = useWords();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (words?.length) void carryLink().then((l) => active && setLink(l));
    else setLink(null);
    return () => {
      active = false;
    };
  }, [words]);

  function send() {
    if (!link) return;
    // ルーターには知らせず、アドレスだけ替える（画面はこのまま）。
    history.replaceState(history.state, "", link);
    if (!navigator.clipboard) {
      setCopied(false);
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }

  return (
    <div className={styles.send}>
      <button type="button" className="btn-quiet" onClick={send} disabled={!link}>
        {t.carry.send}
      </button>
      {copied === null ? null : (
        <>
          <p className={copied ? styles.done : app.note} role="status">
            {copied ? t.carry.copied : t.carry.copyFailed}
          </p>
          {copied ? null : (
            <input className={styles.link} readOnly value={link ?? ""} onFocus={(e) => e.target.select()} aria-label={t.carry.label} />
          )}
          <ul className={styles.how}>
            {t.carry.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** コピーした引き継ぎのリンクを貼って、ここに語を足す（持っている語はそのまま）。 */
export function CarryPaste() {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function receive(e: FormEvent) {
    e.preventDefault();
    const params = carryParams(text);
    setBusy(true);
    const result = params ? await receiveCarry(params) : null;
    setBusy(false);
    if (!result) {
      setNote({ ok: false, text: t.carry.failed });
      return;
    }
    setText("");
    setNote({ ok: true, text: t.carry.received(result.added, result.skipped) });
  }

  return (
    <form className={styles.paste} onSubmit={receive}>
      <label htmlFor={id} className="label">
        {t.carry.paste}
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.carry.pastePlaceholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        <button type="submit" className="btn-quiet" disabled={!text.trim() || busy}>
          {t.carry.receive}
        </button>
      </div>
      {note ? (
        <p className={note.ok ? styles.done : app.error} role="status">
          {note.text}
        </p>
      ) : null}
    </form>
  );
}

/** iPhone のホーム画面のアプリを開いて、まだ語が無いとき：Safari などで集めた語を、ここへ引き継げると知らせる。 */
export function CarryInto() {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {t.carry.intoTitle}
      </h2>
      <p className={app.note}>{t.carry.intoNote}</p>
      <CarryPaste />
    </section>
  );
}
