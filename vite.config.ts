import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
// 名前を変えるときは src/copy.ts の app と、index.html（名前の明朝の text= も）と、ことのあめ の src/lib/sisters.ts をそろえる。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "sister/kotonone.png"],
      manifest: {
        name: "말씨앗",
        short_name: "말씨앗",
        description: "아는 한자어가, 그대로 일본어가 된다.",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#fcfbf8",
        theme_color: "#fcfbf8",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // アプリシェル＋辞書データ（words.json 等）をプリキャッシュしてオフライン動作させる。
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,json}"],
        // リンクのカードの絵は、アプリの中では使わない。
        globIgnores: ["og.png"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Google Fonts（IBM Plex・明朝）は初回オンライン後キャッシュ。
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Capacitor 等で file:// から読み込めるよう相対パスにしておく（iOS ラップ時に有効）
  base: "./",
  server: {
    host: true,
  },
});
