// 起動していちばん先に（ルーターができる前に。main.tsx で最初に読む）：ことのあめ でつないで戻ってきた（/login#kotonoame=…）なら、
// ログインの印を受け取って URL から外し、自分 の画面を開く（そこでログインする。util/connect・components/Account）。
import { captureReturn } from "./util/connect";

const back = captureReturn();
if (back) history.replaceState(null, "", `${location.origin}/#${back}`);
