# データの出典とライセンス

本アプリ（말씨앗）のバンドル辞書データ（`public/data/words.json`・`kanji.json`・`sentences.json`）は、以下の公開データから
`scripts/build-data.mjs`・`scripts/build-sentences.mjs` で生成しています。各ライセンスの帰属表示義務を満たすため、出典を明記します。
生成物は CC BY-SA の素材を含むので、配布するときは CC BY-SA の継承条件に留意してください。

## 1. JMdict（語の表記・読み・英語の意味・よく使う語の印）

- 出典: JMdict — Electronic Dictionary Research and Development Group（EDRDG）, https://www.edrdg.org/
  （取得元: jmdict-simplified https://github.com/scriptin/jmdict-simplified ）
- ライセンス: **CC BY-SA 4.0**
- This publication has included material from the JMdict (EDICT, etc.) dictionary files in accordance with
  the licence provisions of the Electronic Dictionaries Research Group.

## 2. JmdictFurigana（語の字ごとの読み）

- 出典: Doublevil/JmdictFurigana, https://github.com/Doublevil/JmdictFurigana
- ライセンス: **CC BY-SA 4.0**（JMdict 由来）

## 3. KANJIDIC2（字の音読み・訓読み・韓国語の音・画数・学年・英語の意味）

- 出典: KANJIDIC2 — EDRDG, https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
  （取得元: jmdict-simplified の kanjidic2-en）
- ライセンス: **CC BY-SA 4.0**

## 4. 한국어기초사전（語の韓国語の意味）

- 出典: 国立国語院 한국어기초사전, https://krdict.korean.go.kr
  （取得元: https://github.com/spellcheck-ko/korean-dict-nikl-krdict ）
- ライセンス: **CC BY-SA 2.0 KR**
- 韓国語の見出しの日本語の対訳を逆に引き、日本語の語の韓国語の意味にしています（派生物）。

## 5. JLPT の級（語・字）

- 語: jamsinclair/open-anki-jlpt-decks（MIT）。もとは Jonathan Waller の一覧（tanos.co.uk、CC BY）
- 字: davidluzgouveia/kanji-data（MIT）

## 6. libhangul の漢字の訓（배울 학 の 배울）

- 出典: libhangul `data/hanja/hanja.txt`, https://github.com/libhangul/libhangul
- ライセンス: **BSD 3-Clause**（Copyright (c) 2005,2006 Choe Hwanjin）
- 学校で習う訓に合わない字は `scripts/hun-ko.json` で手で直しています。

## 7. FrequencyWords（よく使うか）

- 出典: Hermit Dave（OpenSubtitles 2018）, https://github.com/hermitdave/FrequencyWords
- ライセンス: **CC BY-SA 4.0**

## 8. ことのね の辞書（韓国語の漢字語・字の韓国語の音と訓）

- 姉妹アプリ ことのね の `public/data/words.json`・`hanja-chars.json`。もとは kengdic（CC BY-SA 3.0）・Unicode Unihan（Unicode License v3）・
  한국어기초사전 から作ったもの。同じ漢字の韓国語の語（学生 ↔ 학생）と、字の韓国語の音と訓に使います。
- kyujitai（hakatashi、MIT）：新字体 → 旧字体（韓国で書く形）。

## 9. 例文（文で出会う）

- 姉妹アプリ ことのあめ の例文（韓国語）とその日本語訳、ことのね のために書いた文。
- 말씨앗 のために書いた文（`scripts/sentences/hashi-*.json`）。AI が書いた下書きで、まだ人の目で確かめていません。
- 日本語の文を語に分けるのに kuromoji（Apache License 2.0、辞書は mecab-ipadic）を生成のときだけ使います（アプリには入りません）。

## 10. 手で書いたもの

- `scripts/glosses-ko.json`：対訳から引けない学びはじめの語の、韓国語の意味と、見直しで直した意味（対訳が別の語・同音の語を
  指していたもの、差別語が入っていたもの）。
- `scripts/hun-ko.json`：字の訓の直し。
- `scripts/same-hanjaeo.json`：同じ漢字語の、韓国語の語との意味・使い方のちがい（한국어와 다른 점）と、同じ漢字語かどうか・韓国語の語の直し。
  AI が書いて一件ずつ確かめたもので、韓国語を話す人の確認はまだです。
