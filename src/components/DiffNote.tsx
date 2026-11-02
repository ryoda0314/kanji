import { t } from "../copy";
import styles from "./DiffNote.module.css";

/**
 * 韓国語の同じ漢字の語との、意味・使い方のちがい（洋服 ↔ 양복）。手で確かめた語だけにある（WordData の kd）。
 * label を消すのは、すぐ上に「같은 한자어 · 한국어와 다른 점이 있어요」と出ているとき。
 */
export function DiffNote({ note, label = true }: { note: string; label?: boolean }) {
  return (
    <p className={styles.diff} lang="ko">
      {label ? <strong className={styles.label}>{t.common.diff}</strong> : null}
      {note}
    </p>
  );
}
