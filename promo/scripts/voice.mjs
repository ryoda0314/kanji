// ナレーションを Gemini TTS（Vertex AI）で合成する。台本は voice/lines.json、出力は public/voice/<id>.wav、
// 各クリップの長さは src/voice.json（映像の時はこの長さから決まる：src/timeline.ts）。
//   node scripts/voice.mjs --env <.env のパス>              まだ無いものだけ作る（途中で止まっても同じコマンドで続く）
//   node scripts/voice.mjs --env <path> --only V01,J01      指定の ID だけ（--force で作り直す）
//   node scripts/voice.mjs --env <path> --check             できたクリップを書き起こして、台本と並べる（耳の前の確かめ）
//   node scripts/voice.mjs --durations                      public/voice から src/voice.json だけ書き直す
// 鍵：.env の GOOGLE_SERVICE_ACCOUNT_KEY（base64 の JSON）・GOOGLE_CLOUD_PROJECT・GOOGLE_CLOUD_LOCATION（ことのは と同じ）。
// 鍵はこのリポジトリに置かない。鍵の値はどこにも出さない。
// 音の手当て（頭の無音を切る・末尾のフェードと余白・ピークの天井）は METAL-TEST の generate-tutorial-voice.mjs と同じ。
import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};
const flag = (n) => args.includes(`--${n}`);
const only = opt("only")?.split(",").map((s) => s.trim());

const SPEC = JSON.parse(readFileSync("voice/lines.json", "utf8"));
const OUT = "public/voice";
// 書き起こし（作るときの確かめと --check）。flash は1秒ほどのクリップで中身を作り足した（ことのね の映像）ので pro で。
const CHECK_MODEL = "gemini-2.5-pro";
/** 書き起こしの頼み方：形だけ伝える（どの語かは伝えない。伝えると確かめにならない）。 */
const CHECK_ASK = {
  ja: "この音声は、日本語の単語ひとつの読み上げです。聞こえた単語をひらがなで一語だけ書いてください。漢字やカタカナは使わず、ほかには何も書かないでください。",
  ko: "이 음성은 한국어 내레이션이에요. 들린 그대로 한글로 받아 적어 주세요. 번역이나 설명, 다른 말은 쓰지 마세요.",
};
const askOf = (line) => CHECK_ASK[line.lang];
const TRIM_THRESHOLD = 0.006; // 無音とみなす振幅（フルスケール比）
const TRIM_KEEP_MS = 20; // 頭に残す助走。0 にすると語頭の子音が削れる
const FADE_OUT_MS = 150;
const TAIL_SILENCE_MS = 120;
const DELAY_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 鍵と、Vertex AI の入口 --------------------------------------------------------------------------------------

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    // 値は引用符付きのことがある。付けたまま使うと弾かれる
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function credentials() {
  const path = opt("env");
  if (!path || !existsSync(path)) throw new Error("--env <.env のパス> が要る（GOOGLE_SERVICE_ACCOUNT_KEY・GOOGLE_CLOUD_PROJECT）");
  const env = readEnv(path);
  const raw = env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw || !env.GOOGLE_CLOUD_PROJECT) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY か GOOGLE_CLOUD_PROJECT が無い");
  let account;
  try {
    account = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    account = JSON.parse(raw.replace(/\\n/g, "\n"));
  }
  return { account, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION || "us-central1" };
}

const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** サービスアカウントの鍵で署名した JWT を、アクセストークンに替える。 */
async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: account.token_uri, iat: now, exp: now + 3600 }),
  );
  const sign = createSign("RSA-SHA256");
  sign.update(`${head}.${claim}`);
  const jwt = `${head}.${claim}.${b64url(sign.sign(account.private_key))}`;
  const res = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()).access_token;
}

async function generate(cred, token, model, body) {
  const host = cred.location === "global" ? "aiplatform.googleapis.com" : `${cred.location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1beta1/projects/${cred.project}/locations/${cred.location}/publishers/google/models/${model}:generateContent`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---- 音の手当て ---------------------------------------------------------------------------------------------------

/** 頭の無音を、10ms 窓の RMS で見て落とす（単発のクリックで止まらないように）。 */
function trimLeadingSilence(s, rate) {
  const limit = TRIM_THRESHOLD * 32768;
  const win = Math.max(1, Math.floor((rate * 10) / 1000));
  let i = 0;
  for (; i + win <= s.length; i += win) {
    let sum = 0;
    for (let k = i; k < i + win; k++) sum += s[k] * s[k];
    if (Math.sqrt(sum / win) >= limit) break;
  }
  if (i + win > s.length) return s;
  return s.subarray(Math.max(0, i - Math.floor((rate * TRIM_KEEP_MS) / 1000)));
}

/**
 * 末尾の長い無音は落とし（映像の時がクリップの長さで決まるので）、声の終わりから 250ms は残す。
 * そこにフェードアウトと短い余白を足す。語尾は切らない（フェードは声が消えてから掛かる）。
 */
function fadeAndPad(s, rate) {
  const limit = TRIM_THRESHOLD * 32768;
  const win = Math.max(1, Math.floor((rate * 10) / 1000));
  let end = s.length;
  for (; end - win >= 0; end -= win) {
    let sum = 0;
    for (let k = end - win; k < end; k++) sum += s[k] * s[k];
    if (Math.sqrt(sum / win) >= limit) break;
  }
  const body = s.subarray(0, Math.min(s.length, end + Math.floor((rate * 250) / 1000)));
  const fade = Math.min(body.length, Math.floor((rate * FADE_OUT_MS) / 1000));
  const out = new Int16Array(body.length + Math.floor((rate * TAIL_SILENCE_MS) / 1000));
  out.set(body, 0);
  for (let i = body.length - fade; i < body.length; i++) out[i] = Math.round(out[i] * (1 - (i - (body.length - fade)) / fade));
  return out;
}

/** ピークが天井に触れていたら下げる（音量をそろえるためではない）。 */
function normalizePeak(s, ceiling = 0.92) {
  let peak = 0;
  for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
  const limit = ceiling * 32768;
  if (peak <= limit || peak === 0) return s;
  for (let i = 0; i < s.length; i++) s[i] = Math.round((s[i] * limit) / peak);
  return s;
}

function toWav(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}

const seconds = (file) => {
  const b = readFileSync(file);
  return b.readUInt32LE(40) / 2 / b.readUInt32LE(24);
};

/** public/voice にあるクリップの長さを src/voice.json に（映像の時を決める）。 */
function writeDurations() {
  const out = {};
  for (const line of SPEC.lines) {
    const f = `${OUT}/${line.id}.wav`;
    if (existsSync(f)) out[line.id] = Math.round(seconds(f) * 1000) / 1000;
  }
  writeFileSync("src/voice.json", `${JSON.stringify(out, null, 1)}\n`);
  const missing = SPEC.lines.filter((l) => !(l.id in out)).map((l) => l.id);
  console.log(`  src/voice.json：${Object.keys(out).length}本${missing.length ? `（まだ無い：${missing.join(",")}）` : ""}`);
}

// ---- 合成・確かめ ------------------------------------------------------------------------------------------------

/** 声の指示：行に書いてあればそれ。無ければその行の言葉（韓国語の語り・日本語の語ひとつ）の指示。 */
const styleOf = (line) => SPEC.style[line.style ?? line.lang];

async function synth(cred, token, line) {
  const j = await generate(cred, token, SPEC.model, {
    contents: [{ role: "user", parts: [{ text: styleOf(line) + line.text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEC.voice } } } },
  });
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith("audio"));
  if (!part) throw new Error(`音声が返らなかった: ${JSON.stringify(j).slice(0, 160)}`);
  // レートは mimeType から読む（audio/L16;codec=pcm;rate=24000）
  const rate = Number(part.inlineData.mimeType.match(/rate=(\d+)/i)?.[1]) || 24000;
  const bytes = Buffer.from(part.inlineData.data, "base64");
  const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + (bytes.byteLength & ~1)));
  return toWav(normalizePeak(fadeAndPad(trimLeadingSilence(pcm, rate), rate)), rate);
}

async function transcribe(cred, token, line, wav) {
  const j = await generate(cred, token, CHECK_MODEL, {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: askOf(line) }] }],
    generationConfig: { temperature: 0 },
  });
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

/** 句読点と空白を除いた字（カタカナはひらがなに：書き起こしがカタカナで返すことがある）。 */
const bare = (s) => s.replace(/[\s.,!?。、！？「」…~～-]/g, "").replace(/[ァ-ヶ]/g, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60));
/** 書き起こしが台本と合うまで作り直す回数。 */
const TAKES = 4;
/** 合っているとみなす字の違い：日本語の語ひとつは 0、韓国語の語りは長さの 5% まで（書き起こしの揺れ）。 */
const allowed = (line) => (line.lang === "ja" ? 0 : Math.floor(bare(line.text).length * 0.05));

/**
 * 日本語の語ひとつは、ときどき別の語になる・語を足す（ことのね の映像で 구체 が 구체적으로 になった）。韓国語の語りも
 * 言い換えることがある。書き起こしが台本と合ったテイクを使う。合わなければ、いちばん近いテイク（字の違いが少ないもの）。
 */
async function synthChecked(cred, token, line) {
  let best = null;
  for (let take = 1; take <= TAKES; take++) {
    const wav = await retry(() => synth(cred, token, line), line.id);
    const heard = await retry(() => transcribe(cred, token, line, wav), `${line.id} 書き起こし`);
    const miss = distance(bare(heard), bare(line.text));
    if (!best || miss < best.miss) best = { wav, heard, miss };
    if (miss <= allowed(line)) break;
    console.log(`    ${line.id} ${take}回目：「${heard}」と聞こえた。作り直す`);
    await sleep(DELAY_MS);
  }
  if (best.miss > allowed(line)) console.log(`  ⚠ ${line.id}：${TAKES}回とも合わず、いちばん近い「${best.heard}」を使う`);
  else if (best.miss > 0) console.log(`    ${line.id}：書き起こし「${best.heard}」（違い ${best.miss}字）`);
  return best.wav;
}

function distance(a, b) {
  const x = [...a];
  const y = [...b];
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return d[x.length][y.length];
}

async function retry(fn, label) {
  for (let a = 0; ; a++) {
    try {
      return await fn();
    } catch (e) {
      const m = String(e.message || e);
      if (a < 4 && /HTTP (429|500|502|503|504)|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET|ETIMEDOUT|音声が返らなかった/.test(m)) {
        const back = DELAY_MS * 2 ** a;
        console.log(`    再試行 ${a + 1}/4（${back / 1000}秒待つ）${label}: ${m.slice(0, 90)}`);
        await sleep(back);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  if (flag("durations")) return writeDurations();
  const cred = credentials();
  const token = await accessToken(cred.account);
  const lines = SPEC.lines.filter((l) => !only || only.includes(l.id));

  if (flag("check")) {
    for (const line of lines) {
      const f = `${OUT}/${line.id}.wav`;
      if (!existsSync(f)) continue;
      const heard = await retry(() => transcribe(cred, token, line, readFileSync(f)), line.id);
      console.log(`  ${line.id}  ${seconds(f).toFixed(2)}秒  台本「${line.text}」\n        聞こえた「${heard}」`);
      await sleep(400);
    }
    return;
  }

  mkdirSync(OUT, { recursive: true });
  console.log(`  ${SPEC.model} 声=${SPEC.voice}（Vertex AI ${cred.location}）`);
  let made = 0;
  for (const line of lines) {
    const f = `${OUT}/${line.id}.wav`;
    if (existsSync(f) && !flag("force")) continue;
    try {
      const wav = await synthChecked(cred, token, line);
      writeFileSync(f, wav);
      made++;
      console.log(`  OK  ${line.id}  ${seconds(f).toFixed(2)}秒  ${line.text}`);
      await sleep(DELAY_MS);
    } catch (e) {
      console.error(`  失敗 ${line.id}: ${String(e.message || e).slice(0, 200)}`);
      process.exitCode = 1;
    }
  }
  console.log(`  作った ${made}本`);
  writeDurations();
}

main().catch((e) => {
  console.error("止まった:", String(e.message || e).slice(0, 300));
  process.exit(1);
});
