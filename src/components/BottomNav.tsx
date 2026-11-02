import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { t } from "../copy";
import { Icon } from "./Icon";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: "/", label: t.nav.collect, icon: "collect", end: true },
  { to: "/find", label: t.nav.find, icon: "find", end: false },
  { to: "/words", label: t.nav.words, icon: "words", end: false },
  { to: "/hanja", label: t.nav.hanja, icon: "hanja", end: false },
  { to: "/me", label: t.nav.me, icon: "me", end: false },
] as const;

/**
 * 五つのタブ：電話では下のバー、広い画面では左の列（ことのあめ の BottomNav と同じ）。
 * 左の列では名前（brand）と言葉の組（side）も持つ。
 */
export function BottomNav({ brand, side }: { brand?: ReactNode; side?: ReactNode }) {
  return (
    <nav className={styles.nav} aria-label={t.nav.label}>
      {brand ? <div className={styles.brand}>{brand}</div> : null}
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
        >
          <Icon name={item.icon} size={22} />
          {item.label}
        </NavLink>
      ))}
      {side ? <div className={styles.side}>{side}</div> : null}
    </nav>
  );
}
