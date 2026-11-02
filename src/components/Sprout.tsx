import styles from "./Sprout.module.css";

/**
 * 地面の上に二枚の葉、下に根。葉（覚えた言葉）は根（漢字）でつながっている。
 * 最初の画面と空のときだけの飾り：根が下へ伸び、葉が開く。動きを減らす設定では止まった絵。
 */
export function Sprout({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.sprout} ${className}`} viewBox="0 0 200 168" aria-hidden="true">
      <defs>
        <linearGradient id="sprout-leaf-a" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--leaf-green)" />
          <stop offset="1" stopColor="#b6ead2" />
        </linearGradient>
        <linearGradient id="sprout-leaf-b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--leaf-sky)" />
          <stop offset="1" stopColor="#c9e3ff" />
        </linearGradient>
        {/* 座標で指定する：まっすぐ下へ伸びる根は幅が0なので、形を基準にすると色が付かない。 */}
        <linearGradient id="sprout-root" gradientUnits="userSpaceOnUse" x1="0" y1="92" x2="0" y2="156">
          <stop offset="0" stopColor="var(--root-violet)" />
          <stop offset="1" stopColor="var(--root-pink)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <g className={styles.roots} stroke="url(#sprout-root)" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path pathLength={1} d="M100 92 V150" />
        <path pathLength={1} d="M100 100 C 92 112, 80 118, 70 140" />
        <path pathLength={1} d="M100 100 C 108 112, 120 118, 130 140" />
        <path pathLength={1} d="M84 118 C 76 122, 66 124, 54 128" />
        <path pathLength={1} d="M116 118 C 124 122, 134 124, 146 128" />
        <path pathLength={1} d="M100 124 C 96 132, 92 136, 88 152" />
      </g>
      <path d="M30 92 H170" stroke="var(--line-2)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M100 92 V58" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
      <path className={styles.leafA} d="M100 70 C 94 46, 72 34, 46 38 C 52 62, 72 76, 100 70 Z" fill="url(#sprout-leaf-a)" />
      <path className={styles.leafB} d="M100 62 C 108 40, 128 30, 154 34 C 148 56, 128 68, 100 62 Z" fill="url(#sprout-leaf-b)" />
    </svg>
  );
}
