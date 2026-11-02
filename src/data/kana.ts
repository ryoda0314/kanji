// かなの小さな道具：カタカナ⇄ひらがな、ローマ字→ひらがな、字のふだんの読みが語の中でどう変わったか
// （学 がく → 学校 の がっ。促音・連濁・半濁音・転音）。
// アプリと辞書の生成（scripts/build-data.mjs。Node が型を外して直接読む）の両方から使うので、
// ほかのモジュールを import せず、型を外すだけで動く書き方（enum などを使わない）にしておく。

/** カタカナをひらがなに（ー はそのまま）。 */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** ひらがなをカタカナに。 */
export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** かなだけでできているか（ひらがな・カタカナ・ー）。 */
export function isKana(s: string): boolean {
  return s.length > 0 && /^[ぁ-ゖァ-ヺー]+$/.test(s);
}

/** 読みどうしを比べる形：ひらがなにして、空白を外す。 */
export function normalizeReading(s: string): string {
  return toHiragana(s.normalize("NFC")).replace(/\s+/g, "");
}

// --- ローマ字 → ひらがな（日本語のキーボードが無くても打てるように）--------------------------

const VOWELS: Record<string, string> = { a: "あ", i: "い", u: "う", e: "え", o: "お" };

/** 子音 + 母音（あいうえお の順）。 */
const ROWS: Record<string, string> = {
  k: "かきくけこ", g: "がぎぐげご", s: "さしすせそ", z: "ざじずぜぞ", t: "たちつてと", d: "だぢづでど",
  n: "なにぬねの", h: "はひふへほ", b: "ばびぶべぼ", p: "ぱぴぷぺぽ", m: "まみむめも", r: "らりるれろ", l: "らりるれろ",
};

const ROMAJI: Record<string, string> = (() => {
  const table: Record<string, string> = { ...VOWELS };
  const order = ["a", "i", "u", "e", "o"];
  for (const [c, kana] of Object.entries(ROWS)) order.forEach((v, i) => (table[c + v] = kana[i]));
  // 拗音（きゃ・しゃ …）
  const yoon: Record<string, string> = { ky: "き", gy: "ぎ", sy: "し", sh: "し", zy: "じ", j: "じ", jy: "じ", ty: "ち", ch: "ち", cy: "ち", dy: "ぢ", ny: "に", hy: "ひ", by: "び", py: "ぴ", my: "み", ry: "り", ly: "り" };
  for (const [c, kana] of Object.entries(yoon)) {
    table[c + "a"] = kana + "ゃ";
    table[c + "u"] = kana + "ゅ";
    table[c + "o"] = kana + "ょ";
  }
  Object.assign(table, {
    shi: "し", chi: "ち", tsu: "つ", fu: "ふ", ji: "じ", je: "じぇ", she: "しぇ", che: "ちぇ", ci: "ち",
    ya: "や", yu: "ゆ", yo: "よ", wa: "わ", wo: "を", wi: "うぃ", we: "うぇ", ye: "いぇ",
    fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ", va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
    thi: "てぃ", dhi: "でぃ", twu: "とぅ", dwu: "どぅ", tsa: "つぁ",
    xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ", xya: "ゃ", xyu: "ゅ", xyo: "ょ", xtu: "っ", xtsu: "っ", xwa: "ゎ",
    la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ", lya: "ゃ", lyu: "ゅ", lyo: "ょ", ltu: "っ", ltsu: "っ",
    xn: "ん", "-": "ー",
  });
  return table;
})();

const KEYS_BY_LENGTH = [4, 3, 2, 1];
const PREFIXES = new Set(Object.keys(ROMAJI).flatMap((k) => Array.from({ length: k.length }, (_, i) => k.slice(0, i + 1))));

/**
 * ローマ字をひらがなに（gakusei → がくせい、gakkou → がっこう、konnnichiha・kon'nichiha → こんにちは）。
 * partial なら、打っている途中の終わりの字（gakus の s、kon の n）はそのまま残す（打つたびに直すため）。
 * ローマ字でない字（かな・ハングル・漢字）はそのまま。
 */
export function romajiToKana(input: string, partial = false): string {
  const s = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!/[a-z'\-]/.test(c)) {
      out += input[i];
      i++;
      continue;
    }
    const next = s[i + 1];
    // 子音が重なれば っ（kk・tt・tch）。n は ん の書き方なので除く。
    if (next && c === next && /[bcdfghjklmpqrstvwxyz]/.test(c) && c !== "n") {
      out += "っ";
      i++;
      continue;
    }
    if (c === "t" && next === "c") {
      out += "っ";
      i++;
      continue;
    }
    // ん：n'、nn（そのあとが母音・y なら n を一つだけ使う：konnichiha → こんにちは、hann → はん）、
    // 子音の前の n（kanji → かんじ）。
    if (c === "n" && next === "'") {
      out += "ん";
      i += 2;
      continue;
    }
    if (c === "n" && next === "n") {
      out += "ん";
      i += /[aiueoy]/.test(s[i + 2] ?? "") ? 1 : 2;
      continue;
    }
    if (c === "n" && next !== undefined && !/[aiueoy]/.test(next)) {
      out += "ん";
      i++;
      continue;
    }
    let matched = false;
    for (const len of KEYS_BY_LENGTH) {
      const key = s.slice(i, i + len);
      if (key.length === len && ROMAJI[key] !== undefined) {
        out += ROMAJI[key];
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const rest = s.slice(i);
    if (partial && PREFIXES.has(rest)) {
      out += input.slice(i);
      break;
    }
    if (rest === "n") {
      out += "ん";
      break;
    }
    out += input[i];
    i++;
  }
  return out;
}

/** ローマ字が入っているか（ローマ字で打っているときだけ、かなに直す）。 */
export function hasRomaji(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

// --- 字の読みが語の中で変わる形 -----------------------------------------------------------

/**
 * 字のふだんの読みが、語の中で変わるわけ。
 * sokuon  促音：終わりの く・き・つ・ち が っ に（学 がく → 学校 がっこう、一 いち → 一緒 いっしょ）
 * rendaku 連濁：はじめの音がにごる（社 しゃ → 会社 は かいしゃ、株式会社 は かぶしきがいしゃ。人 ひと → 人々 ひとびと）
 * handaku 半濁音：は行 が ぱ行 に（表 ひょう → 発表 はっぴょう、本 ほん → 一本 いっぽん）
 * vowel   転音：終わりの音の母音が変わる（雨 あめ → 雨戸 あまど、酒 さけ → 酒屋 さかや）
 */
export type SoundChange = "sokuon" | "rendaku" | "handaku" | "vowel";

const VOICED: Record<string, string[]> = {
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], ち: ["ぢ", "じ"], つ: ["づ", "ず"], て: ["で"], と: ["ど"],
  は: ["ば"], ひ: ["び"], ふ: ["ぶ"], へ: ["べ"], ほ: ["ぼ"],
};
const HANDAKU: Record<string, string> = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
const SOKUON_FROM = new Set(["く", "き", "つ", "ち"]);
/** 転音：終わりの音の母音の変わり方（え段 → あ段、い段 → お段、お段 → あ段）。 */
const VOWEL_SHIFT: Record<string, string[]> = {
  え: ["あ"], け: ["か"], せ: ["さ"], て: ["た"], ね: ["な"], へ: ["は"], め: ["ま"], れ: ["ら"], げ: ["が"], ぜ: ["ざ"], で: ["だ"], べ: ["ば"],
  き: ["こ"], ひ: ["ほ"], い: ["お"],
  ろ: ["ら"], お: ["あ"],
};

/** はじめの音を、にごった形・ぱ行に。 */
function firstSounds(base: string): { kana: string; change: SoundChange | null }[] {
  const head = base[0];
  const out: { kana: string; change: SoundChange | null }[] = [{ kana: head, change: null }];
  for (const v of VOICED[head] ?? []) out.push({ kana: v, change: "rendaku" });
  if (HANDAKU[head]) out.push({ kana: HANDAKU[head], change: "handaku" });
  return out;
}

/**
 * here（語の中での読み）が、base（字のふだんの読み）からどう変わった形か。同じなら []、どの形でもなければ null。
 * 促音と連濁（半濁音）は重なることがある（出発 しゅっぱつ の 発 は はつ → ぱつ）。
 */
export function changesOf(base: string, here: string): SoundChange[] | null {
  if (!base || !here) return null;
  if (base === here) return [];
  if (base.length !== here.length) return null;
  if (base.length === 1 && (VOWEL_SHIFT[base] ?? []).includes(here)) return ["vowel"];
  for (const head of firstSounds(base)) {
    if (here[0] !== head.kana) continue;
    const changes: SoundChange[] = head.change ? [head.change] : [];
    if (base.length === 1) {
      if (changes.length) return changes;
      continue;
    }
    const mid = base.slice(1, -1);
    if (here.slice(1, -1) !== mid) continue;
    const last = base[base.length - 1];
    const hereLast = here[here.length - 1];
    if (last === hereLast) return changes;
    if (hereLast === "っ" && SOKUON_FROM.has(last)) return [...changes, "sokuon"];
    if ((VOWEL_SHIFT[last] ?? []).includes(hereLast)) return [...changes, "vowel"];
  }
  return null;
}

/** KANJIDIC の訓読み（た.べる・なま-・-がた）から、語の中で字が受け持つ部分（た・なま・がた）。 */
export function kunStem(kun: string): string {
  return toHiragana(kun.replace(/^-|-$/g, "").split(".")[0]);
}

/**
 * 語の中での字の読み here を、字のふだんの読み（readings：ひらがな。音読みはひらがなに、訓読みは kunStem で）の
 * どれかに結びつける。そのままの読みを先に、次に変わり方の少ないもの。どれにも結びつかなければ null
 * （その語だけの特別な読み）。
 */
export function findBase(readings: readonly string[], here: string): { base: string; changes: SoundChange[] } | null {
  const h = toHiragana(here);
  let best: { base: string; changes: SoundChange[] } | null = null;
  for (const r of readings) {
    const changes = changesOf(r, h);
    if (changes && (!best || changes.length < best.changes.length)) best = { base: r, changes };
    if (best && best.changes.length === 0) break;
  }
  return best;
}
