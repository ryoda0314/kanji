import { t } from "../copy";
import { usePref } from "../util/local";
import { Icon } from "./Icon";
import app from "../app.module.css";
import styles from "./InstallHint.module.css";

/**
 * みんなの雨ができたことを、語を集めている人に一度だけ知らせる（集めた語が、名前も番号も付けずに降るようになったので）。
 * 閉じたらもう出さない。形は ホーム画面に追加しておく の案内と同じ。入口は すぐ上の みんなの雨 の札。
 */
export function EveryoneHint() {
  const [seen, setSeen] = usePref("everyoneNoticeSeen", false);
  if (seen) return null;

  return (
    <section className={styles.card} aria-labelledby="everyone-hint-title">
      <div className={styles.head}>
        <h2 id="everyone-hint-title" className={styles.title}>
          {t.everyone.noticeTitle}
        </h2>
        <button type="button" className={styles.close} onClick={() => setSeen(true)} aria-label={t.install.close}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className={app.note}>{t.everyone.notice}</p>
    </section>
  );
}
