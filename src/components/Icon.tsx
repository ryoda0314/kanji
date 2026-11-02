// 線画のアイコン（ことのあめ の Icon.tsx と同じ線の太さと端の丸め）。絵文字は使わない。
type IconName =
  | "collect"
  | "find"
  | "words"
  | "hanja"
  | "me"
  | "back"
  | "close"
  | "arrow"
  | "speaker"
  | "check"
  | "download"
  | "upload";

const PATHS: Record<IconName, React.ReactNode> = {
  // 芽と根：地面の上に二枚の葉、下に根。覚えた語（葉）を漢字の根でつなぐ。
  collect: (
    <>
      <path d="M12 13V8.5" />
      <path d="M12 9.5C12 6.4 9.9 4.5 6.6 4.5c0 3 2.1 5 5.4 5z" />
      <path d="M12 8.5c0-2.8 1.9-4.6 5-4.6 0 2.8-1.9 4.6-5 4.6z" />
      <path d="M4.5 13h15" />
      <path d="M12 13v7" />
      <path d="M12 15.5l-3.5 3" />
      <path d="M12 15.5l3.5 3" />
    </>
  ),
  find: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  // 開いた本。
  words: (
    <>
      <path d="M12 7c-2.2-1.6-5.2-2.1-8.5-1.6v13c3.3-.5 6.3 0 8.5 1.6 2.2-1.6 5.2-2.1 8.5-1.6v-13C17.2 4.9 14.2 5.4 12 7z" />
      <path d="M12 7v13" />
    </>
  ),
  // 田字格：字を習う升目。
  hanja: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 4v16" strokeDasharray="2 2.2" />
      <path d="M4 12h16" strokeDasharray="2 2.2" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 10.5l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4.5" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
