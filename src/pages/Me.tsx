import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { discoverWords, wordKey } from "../data/combine";
import { t } from "../copy";
import { exportBackup, parseBackup, restoreWords } from "../db";
import { ACCENTS, SCRIPTS, usePrefs, type AccentPref, type RatePref } from "../prefs";
import { AccountSection } from "../components/Account";
import { CarryPaste, CarrySend } from "../components/Carry";
import { koreanOf } from "../components/WordRow";
import KanjiText from "../components/KanjiText";
import { Icon } from "../components/Icon";
import { SpeakButton } from "../components/SpeakButton";
import { useChars, useSounds, useWords } from "../util/live";
import { usePref } from "../util/local";
import { SHARE_PREF } from "../util/falls";
import { SEND_PREF } from "../util/usage";
import { hasAccounts } from "../util/account";
import { useJapaneseVoice } from "../util/speech";
import app from "../app.module.css";
import styles from "./Me.module.css";

/** スウォッチの色（アクセントそのもの）。 */
const SWATCH: Record<AccentPref, string> = {
  wakaba: "#0f7a50",
  rain: "#0a64f0",
  ink: "#172033",
  hydrangea: "#6a4fe0",
  dusk: "#b9462a",
};

// 姉妹アプリ ことのね（日本語を話す人のための、韓国語の漢字語）の公開先。
const SISTER_URL = "https://hanja-xi.vercel.app";
// 例文をもらっている ことのあめ の公開先。
const KOTONOAME_URL = "https://polylinga.vercel.app";

const CREDITS = [
  { name: "JMdict", by: "Electronic Dictionary Research and Development Group", license: "CC BY-SA 4.0", url: "https://www.edrdg.org/" },
  { name: "KANJIDIC2", by: "Electronic Dictionary Research and Development Group", license: "CC BY-SA 4.0", url: "https://www.edrdg.org/" },
  { name: "JmdictFurigana", by: "Doublevil", license: "CC BY-SA 4.0", url: "https://github.com/Doublevil/JmdictFurigana" },
  { name: "한국어기초사전", by: "국립국어원", license: "CC BY-SA 2.0 KR", url: "https://krdict.korean.go.kr" },
  { name: "JLPT 단어·한자 목록", by: "Jonathan Waller (tanos.co.uk) · jamsinclair · davidluzgouveia", license: "CC BY · MIT", url: "https://www.tanos.co.uk/jlpt/" },
  { name: "libhangul 한자 훈음", by: "Choe Hwanjin", license: "BSD", url: "https://github.com/libhangul/libhangul" },
  { name: "kengdic", by: "Joe Speigle / Nathan Glenn", license: "CC BY-SA 3.0", url: "https://github.com/garfieldnate/kengdic" },
  { name: "Unihan Database", by: "Unicode, Inc.", license: "Unicode License v3", url: "https://www.unicode.org/charts/unihan.html" },
  { name: "kyujitai", by: "hakatashi", license: "MIT", url: "https://github.com/hakatashi/kyujitai.js" },
  { name: "FrequencyWords", by: "Hermit Dave (OpenSubtitles)", license: "CC BY-SA 4.0", url: "https://github.com/hermitdave/FrequencyWords" },
  { name: "ことのあめ 예문", by: "자매 앱", license: "문장에서 만나기의 문장과 번역", url: KOTONOAME_URL },
];

/** 自分：これまでの数（ほかの人とは比べない）、表示の設定、記録の書き出し・読み込み、姉妹アプリ、出典。 */
export default function Me() {
  const words = useWords();
  const chars = useChars();
  const { script, setScript, accent, setAccent, rate, setRate } = usePrefs();
  const [sendUsage, setSendUsage] = usePref(SEND_PREF, true);
  const [shareWords, setShareWords] = usePref(SHARE_PREF, true);
  const voice = useJapaneseVoice();
  const [dataNote, setDataNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sounds = useSounds(words);
  // 일본어로 말할 수 있는 한자어：集めた同じ漢字語と、集めた音（소리 짝）だけで言える語。
  const sayable = useMemo(
    () =>
      (words ?? []).filter((w) => koreanOf(w)).length +
      (sounds.size ? discoverWords(sounds, new Set((words ?? []).map(wordKey)), true).length : 0),
    [words, sounds]
  );

  async function download() {
    const text = await exportBackup();
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `말씨앗-${stamp}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    // すぐに手放すと保存が始まる前に消える端末がある。
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const list = parseBackup(await file.text());
    if (!list) {
      setDataNote({ ok: false, text: t.me.importFailed });
      return;
    }
    const { added, skipped } = await restoreWords(list);
    setDataNote({ ok: true, text: t.me.imported(added, skipped) });
  }

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.me.title}</h1>
      </header>
      <div className={`${app.bodyTight} ${styles.page}`}>
        <section className={app.stackSm}>
          <h2 className="label">{t.me.sofar}</h2>
          <dl className={app.stats}>
            <Stat label={t.me.stats.words} value={words?.length} unit="단어" />
            <Stat label={t.me.stats.chars} value={chars?.length} unit="자" />
            <Stat label={t.me.stats.sounds} value={words ? sounds.size : undefined} unit="개" />
            <Stat label={t.me.stats.readable} value={words ? sayable : undefined} unit="단어" />
          </dl>
          <p className={app.note}>{t.me.sofarNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.display}</h2>
          <div className={styles.field}>
            <span className="label" id="script-label">
              {t.me.script}
            </span>
            <div className={styles.segmented} role="radiogroup" aria-labelledby="script-label">
              {SCRIPTS.map((s) => (
                <label key={s} className={styles.segment}>
                  <input type="radio" name="script" checked={script === s} onChange={() => setScript(s)} />
                  {t.me.scripts[s]}
                </label>
              ))}
            </div>
            <p className={styles.preview}>
              <KanjiText text="学生" />
              <KanjiText text="会社" />
              <KanjiText text="韓国語" />
            </p>
            <p className={app.note}>{t.me.scriptNote}</p>
          </div>

          <div className={styles.field}>
            <span className="label" id="accent-label">
              {t.me.accent}
            </span>
            <div className={styles.swatches} role="radiogroup" aria-labelledby="accent-label">
              {ACCENTS.map((a) => (
                <label key={a} className={styles.swatch}>
                  <input type="radio" name="accent" checked={accent === a} onChange={() => setAccent(a)} />
                  <span className={styles.dot} style={{ background: SWATCH[a] }} />
                  {t.me.accentNames[a]}
                </label>
              ))}
            </div>
          </div>

          {voice ? (
            <div className={styles.field}>
              <span className="label" id="rate-label">
                {t.me.rate}
              </span>
              <div className={styles.rateRow}>
                <div className={styles.segmented} role="radiogroup" aria-labelledby="rate-label">
                  {(["slow", "normal", "fast"] as RatePref[]).map((r) => (
                    <label key={r} className={styles.segment}>
                      <input type="radio" name="rate" checked={rate === r} onChange={() => setRate(r)} />
                      {t.me.rates[r]}
                    </label>
                  ))}
                </div>
                <SpeakButton text="がくせい" />
              </div>
              <p className={app.note}>{t.me.rateNote}</p>
            </div>
          ) : null}
        </section>

        <AccountSection />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.data}</h2>
          <p className={app.note}>{hasAccounts() ? t.me.dataNoteAccount : t.me.dataNote}</p>
          <div className={styles.dataRow}>
            <button type="button" className="btn-quiet" onClick={download} disabled={!words?.length}>
              <Icon name="download" size={18} />
              {t.me.export}
            </button>
            <button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} />
              {t.me.import}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={upload} />
          </div>
          {dataNote ? (
            <p className={dataNote.ok ? styles.saved : app.error} role="status">
              {dataNote.text}
            </p>
          ) : null}
          <div className={styles.field}>
            <span className="label">{t.carry.label}</span>
            <p className={app.note}>{t.carry.note}</p>
            <CarrySend />
            <CarryPaste />
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={sendUsage} onChange={(e) => setSendUsage(e.target.checked)} />
            {t.me.usage}
          </label>
          <p className={app.note}>{t.me.usageNote}</p>
          <label className={styles.toggle}>
            <input type="checkbox" checked={shareWords} onChange={(e) => setShareWords(e.target.checked)} />
            {t.me.share}
          </label>
          <p className={app.note}>{t.me.shareNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.sister}</h2>
          <a href={SISTER_URL} className={styles.sister} target="_blank" rel="noopener">
            <img src={`${import.meta.env.BASE_URL}sister/kotonone.png`} alt="" width={48} height={48} className={styles.sisterIcon} />
            <span className={styles.sisterText}>
              <span className={`wordmark-kana ${styles.sisterName}`}>{t.me.sisterName}</span>
              <span className={styles.sisterLead}>{t.me.sisterLead}</span>
            </span>
            <Icon name="arrow" size={18} />
          </a>
          <p className={app.note}>{t.me.sisterNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.credits}</h2>
          <p className={app.note}>{t.me.creditsLead}</p>
          <ul className={styles.credits}>
            {CREDITS.map((c) => (
              <li key={c.name}>
                <a href={c.url} target="_blank" rel="noopener">
                  {c.name}
                </a>
                <span>
                  {c.by} · {c.license}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className={app.stat}>
      <dt>{label}</dt>
      <dd>
        {value ?? "…"}
        <small>{unit}</small>
      </dd>
    </div>
  );
}
