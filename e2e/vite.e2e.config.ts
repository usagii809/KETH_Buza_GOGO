// 화면 테스트용 빌드: Firebase 대신 메모리 가짜 DB를 씀
import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "../vite.config";

const mock = (f: string) => fileURLToPath(new URL(`./mocks/${f}`, import.meta.url));
export default mergeConfig(base, defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: {
    alias: {
      "firebase/app": mock("app.js"),
      "firebase/auth": mock("auth.js"),
      "firebase/firestore": mock("firestore.js")
    }
  },
  build: { outDir: "e2e/dist", emptyOutDir: true, rollupOptions: { output: { manualChunks: undefined } } }
}));
