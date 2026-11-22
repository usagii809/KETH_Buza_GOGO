/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"]
      },
      colors: {
        toss: {
          bg: "#F2F4F6",
          card: "#FFFFFF",
          blue: "#3182F6",
          blueDark: "#1B64DA",
          blueLight: "#E8F3FF",
          text: "#191F28",
          sub: "#4E5968",
          muted: "#8B95A1",
          border: "#E5E8EB",
          green: "#00B37E",
          amber: "#FF9F00",
          red: "#F04452"
        }
      }
    }
  },
  plugins: []
};
