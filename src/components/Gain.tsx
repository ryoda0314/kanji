import { useEffect, useState } from "react";
import { t } from "../copy";
import styles from "./Gain.module.css";

/** 動きを減らす設定か。 */
function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * あつめると読める語がいくつ増えるか（before）、増えたか（after）を大きな数で。
 * 1語覚えると読める語がまとめて増える：말씨앗 のいちばんの手応えなので、after は 0 から数え上がる。
 */
export function Gain({ count, when }: { count: number; when: "before" | "after" }) {
  const animate = when === "after" && count > 1 && !reducedMotion();
  const [shown, setShown] = useState(animate ? 0 : count);

  useEffect(() => {
    if (!animate) {
      setShown(count);
      return;
    }
    const start = performance.now();
    const duration = Math.min(900, 300 + count * 40);
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(Math.round(count * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animate, count]);

  if (when === "before") {
    return (
      <p className={styles.gain}>
        <span className={styles.text}>{t.gain.beforeHead}</span>
        <strong className={styles.num}>{count}</strong>
        <span className={styles.text}>{t.gain.beforeTail}</span>
      </p>
    );
  }
  return (
    <p className={`${styles.gain} ${styles.after}`} aria-label={`+${count}${t.gain.afterTail}`}>
      <strong className={styles.num} aria-hidden="true">
        +{shown}
      </strong>
      <span className={styles.text} aria-hidden="true">
        {t.gain.afterTail}
      </span>
    </p>
  );
}
