import { Link } from "react-router-dom";
import { t } from "../copy";
import styles from "./Logo.module.css";

const ICON_PX = { sm: 28, md: 34, lg: 88 } as const;

/** アプリのアイコンと、明朝の 말씨앗（ことのあめ の Logo と同じ組み方）。lg は縦に積む（最初の画面用）。 */
export function Logo({ size = "md", to = "/" }: { size?: keyof typeof ICON_PX; to?: string | null }) {
  const px = ICON_PX[size];
  const content = (
    <>
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={px} height={px} className={styles.icon} />
      <span className={`wordmark ${styles.word}`}>{t.app.name}</span>
    </>
  );
  const className = `${styles.logo} ${styles[size]}`;
  return to ? (
    <Link to={to} className={className} aria-label={t.app.name}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}
