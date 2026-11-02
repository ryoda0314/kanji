import { Link, Outlet, ScrollRestoration } from "react-router-dom";
import { t } from "../copy";
import styles from "../app.module.css";
import { BottomNav } from "./BottomNav";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

/** 한국어 → 日本語：ことのあめ の言葉の組と同じ札。押すと 自分 へ。 */
export function PairLink() {
  return (
    <Link to="/me" className={styles.pair}>
      <span>{t.app.from}</span>
      <Icon name="arrow" size={16} />
      <span className="t-ja" lang="ja">
        {t.app.to}
      </span>
    </Link>
  );
}

/** アプリの殻：画面と、下（広い画面では左）のタブ。 */
export default function Layout() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav brand={<Logo size="sm" />} side={<PairLink />} />
      <ScrollRestoration />
    </div>
  );
}
