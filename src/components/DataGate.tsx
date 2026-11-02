import { useEffect, useState, type ReactNode } from "react";
import { initFullDataset } from "../data/dataset";
import { refreshGlosses } from "../db";
import { t } from "../copy";
import { startSync } from "../util/account";
import styles from "../app.module.css";
import { Logo } from "./Logo";

/**
 * 全辞書データの読込が終わるまで、名前と静かな形を出しておき、終わったら子を描く。
 * 読めたら、集めた語の意味をいまの辞書にそろえる（前の版で集めた語の英語の意味を、日本語の対訳に）。
 * ことのあめ のアカウントでログインしていれば、記録を合わせ始める（アカウントの語に、辞書の意味を付けて入れるので、辞書のあとに）。
 */
export default function DataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    initFullDataset()
      .then(async (loaded) => {
        if (!loaded) return;
        await refreshGlosses();
        startSync();
      })
      .catch(() => 0)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className={styles.shell} role="status" aria-label={t.common.loading}>
        <div className={styles.body}>
          <Logo size="lg" to={null} />
          <p className={styles.lead}>{t.common.loading}</p>
          <div className={styles.ghost} aria-hidden="true">
            <div className={styles.ghostLine} style={{ width: "72%" }} />
            <div className={styles.ghostLine} style={{ width: "48%" }} />
            <div className={styles.ghostBlock} />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
