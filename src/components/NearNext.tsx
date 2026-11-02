import { useMemo } from "react";
import { nearWords, wordKey } from "../data/combine";
import { splitKanji } from "../data/dataset";
import { pairLabel, soundParts } from "../data/sounds";
import type { WordData } from "../data/types";
import { t } from "../copy";
import app from "../app.module.css";
import { WordRow } from "./WordRow";

/**
 * 読める語がまだ増えなかったときの次の一手：この語の字が入っていて、あと1音で読める語。
 * 多くの語に効く音（その音に出会うと読める語がまとめて増える音）の語から並べる。
 */
export function NearNext({
  kanji,
  sounds,
  owned,
  onOpen,
  limit = 3,
}: {
  kanji: string;
  sounds: Set<string>;
  owned: Set<string>;
  onOpen: (w: Pick<WordData, "kanji" | "kana" | "gloss">) => void;
  limit?: number;
}) {
  const rows = useMemo(() => {
    const mine = new Set(splitKanji(kanji));
    const near = nearWords(sounds, owned).filter((n) => splitKanji(n.word.kanji).some((c) => mine.has(c)));
    const weight = new Map<string, number>();
    for (const n of near) weight.set(n.missing, (weight.get(n.missing) ?? 0) + 1);
    // nearWords は読みやすい順。並べ替えは安定なので、同じ重みの中ではその順のまま。
    return [...near].sort((a, b) => (weight.get(b.missing) ?? 0) - (weight.get(a.missing) ?? 0)).slice(0, limit);
  }, [kanji, sounds, owned, limit]);

  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="label">{t.gain.next}</h3>
      <ul className={app.plainList}>
        {rows.map((n) => {
          const { char, reading } = soundParts(n.missing);
          return (
            <WordRow
              key={wordKey(n.word)}
              word={n.word}
              missing={char}
              meta={t.find.missingNote(pairLabel(char, reading))}
              onOpen={() => onOpen(n.word)}
            />
          );
        })}
      </ul>
    </section>
  );
}
