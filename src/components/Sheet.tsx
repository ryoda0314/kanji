import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { t } from "../copy";
import { Icon } from "./Icon";
import styles from "./Sheet.module.css";

/**
 * 下から開く紙（広い画面では真ん中の窓）。Escape と外側で閉じ、閉じたら開く前の場所に戻る。
 * ことのあめ の WordDetail と同じ開き方。
 */
export function Sheet({
  label,
  labelledBy,
  onClose,
  children,
}: {
  label: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // 中の字を押して別の画面へ移ったら閉じる（字のページから字のページへ移ると、ページは同じまま残るため）。
  const { pathname } = useLocation();
  const openedAt = useRef(pathname);
  useEffect(() => {
    if (pathname !== openedAt.current) close.current();
  }, [pathname]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className="label">{label}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.common.close}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
