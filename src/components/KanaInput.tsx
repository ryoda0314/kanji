import { forwardRef, useRef, type InputHTMLAttributes } from "react";
import { hasRomaji, romajiToKana } from "../data/kana";

/**
 * 読みを打つ欄。日本語のキーボードが無くても、ローマ字で打てばその場でひらがなになる（gakkou → がっこう）。
 * 日本語のキーボードで変換している間（composition）は触らない。ハングル・漢字はそのまま（韓国語でも探せるように）。
 */
export const KanaInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValue: (v: string) => void;
}>(function KanaInput({ value, onValue, className = "", ...rest }, ref) {
  const composing = useRef(false);
  const convert = (v: string) => (hasRomaji(v) ? romajiToKana(v, true) : v);
  return (
    <input
      ref={ref}
      {...rest}
      className={`${className} t-ja`}
      lang="ja"
      value={value}
      onChange={(e) => onValue(composing.current ? e.target.value : convert(e.target.value))}
      onCompositionStart={() => (composing.current = true)}
      onCompositionEnd={(e) => {
        composing.current = false;
        onValue(convert(e.currentTarget.value));
      }}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
});
