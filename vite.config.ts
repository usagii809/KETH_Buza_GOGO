import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// 버전: v{큰 변화}.{기능 추가}.{배포 번호}  예) v2.1.57
// - 앞 두 자리는 package.json의 version에서 (큰 기능을 넣으면 직접 2.0.0 → 2.1.0처럼 올려요)
// - 마지막 자리는 GitHub Actions 배포 번호라 올릴 때마다 저절로 1씩 커져요 (내 컴퓨터 빌드는 dev)
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const [major = "0", minor = "0"] = pkg.version.split(".");
const build = process.env.GITHUB_RUN_NUMBER || "dev";
const version = `v${major}.${minor}.${build}`;
const sha = (process.env.GITHUB_SHA || (() => {
  try { return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "local"; }
})()).slice(0, 7);
const builtAt = new Date();

/** 배포 결과에 version.json을 넣어요 → 앱이 지금 서버 버전과 비교해서 '새 버전이 있어요'를 알려줘요 */
const versionFile = (): Plugin => ({
  name: "version-file",
  apply: "build",
  writeBundle(opts) {
    writeFileSync(resolve(opts.dir || "dist", "version.json"), JSON.stringify({ version, sha, builtAt: builtAt.getTime() }));
  }
});

// GitHub Pages(usagii809.github.io/buja/) 하위 경로에서도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_SHA__: JSON.stringify(sha),
    __APP_BUILT_AT__: JSON.stringify(builtAt.getTime())
  },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "태형이와 경은이의 부자 되기 프로젝트",
        short_name: "부자 가계부",
        description: "태형이와 경은이의 공동 가계부",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#F2F4F6",
        theme_color: "#F2F4F6",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // 앱 화면은 오프라인에서도 뜨게, 데이터(Firebase)는 항상 네트워크로
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        navigateFallback: "index.html",
        // 🔔 알림 받기 · 누르면 같이 보기 열기 (public/push-sw.js)
        importScripts: ["push-sw.js"]
      }
    })
  ],
  build: {
    // Firebase·React는 따로 묶어서, 앱 코드만 바뀌면 그 부분만 새로 받게
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom"]
        }
      }
    }
  },
  test: {
    include: ["src/**/*.test.ts"]
  }
});
