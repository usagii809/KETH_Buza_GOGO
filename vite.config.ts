import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages(usagii809.github.io/buja/) 하위 경로에서도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: "./",
  plugins: [
    react(),
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
        navigateFallback: "index.html"
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
