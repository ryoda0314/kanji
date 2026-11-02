import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
Config.setCrf(16);
// ふつうの動画の色（BT.709・yuv420p）で書く。JPEG のコマのまま（yuvj420p・全域）だと、再生するところによっては
// 薄い灰色（打つ欄の地など）が白に飛ぶ。
Config.setColorSpace("bt709");
Config.setPixelFormat("yuv420p");
