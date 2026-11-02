import { t } from "../copy";
import { isIOS, isStandalone, promptInstall, useInstallPrompt } from "../util/install";
import { usePref } from "../util/local";
import { CarrySend } from "./Carry";
import { Icon } from "./Icon";
import app from "../app.module.css";
import styles from "./InstallHint.module.css";

/**
 * ホーム画面に追加しておく、の小さな案内。語がいくつか集まってから、ブラウザで開いているときだけ出す。
 * 閉じたらもう出さない。追加できるブラウザ（Chrome など）ではボタンから、iPhone では Safari の共有から。
 * iPhone ではホーム画面のアプリに語が入らないので、引き継ぎのリンクも作れるようにする。
 */
export function InstallHint() {
  const [dismissed, setDismissed] = usePref("installHintDismissed", false);
  const prompt = useInstallPrompt();
  if (dismissed || isStandalone()) return null;

  return (
    <section className={styles.card} aria-labelledby="install-title">
      <div className={styles.head}>
        <h2 id="install-title" className={styles.title}>
          {t.install.title}
        </h2>
        <button type="button" className={styles.close} onClick={() => setDismissed(true)} aria-label={t.install.close}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className={app.note}>{t.install.why}</p>
      {prompt ? (
        <button type="button" className={`btn-quiet ${styles.add}`} onClick={() => void promptInstall()}>
          {t.install.add}
        </button>
      ) : isIOS() ? (
        <>
          <p className={styles.how}>{t.install.ios}</p>
          <CarrySend />
        </>
      ) : (
        <p className={styles.how}>{t.install.other}</p>
      )}
    </section>
  );
}
