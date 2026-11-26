import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FeedbackProvider } from "./ui/feedback";
import "./index.css";
import { initTheme } from "./lib/theme";

// 화면이 그려지기 전에 밝게 · 어둡게를 먼저 입혀요 (깜빡임 없이)
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </StrictMode>
);
