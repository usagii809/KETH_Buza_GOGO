/** @type {import('tailwindcss').Config} */
export default {
  // 설정에서 고른 모드를 <html class="dark">로 켜요
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"]
      },
      colors: {
        // 밝게 · 어둡게 모드에 따라 바뀌는 색 (값은 src/index.css의 --toss-*)
        toss: {
          bg: "rgb(var(--toss-bg) / <alpha-value>)",
          card: "rgb(var(--toss-card) / <alpha-value>)",
          blue: "rgb(var(--toss-blue) / <alpha-value>)",
          blueDark: "rgb(var(--toss-blue-dark) / <alpha-value>)",
          blueLight: "rgb(var(--toss-blue-light) / <alpha-value>)",
          text: "rgb(var(--toss-text) / <alpha-value>)",
          sub: "rgb(var(--toss-sub) / <alpha-value>)",
          muted: "rgb(var(--toss-muted) / <alpha-value>)",
          border: "rgb(var(--toss-border) / <alpha-value>)",
          green: "rgb(var(--toss-green) / <alpha-value>)",
          amber: "rgb(var(--toss-amber) / <alpha-value>)",
          red: "rgb(var(--toss-red) / <alpha-value>)"
        }
      }
    }
  },
  plugins: []
};
