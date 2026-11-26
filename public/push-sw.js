// 🔔 알림(웹 푸시) 받기 · 서비스 워커에 붙어서 돌아가요 (vite.config.ts의 importScripts)
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data && event.data.text() }; }
  const title = data.title || "💌 같이 보기에 새 소식이 있어요";
  const tag = data.tag || "buja";
  event.waitUntil((async () => {
    // 브라우저 규칙상 알림은 꼭 띄워야 해요
    await self.registration.showNotification(title, {
      body: data.body || "",
      tag,
      renotify: true,
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: data.url || "./?feed=1" }
    });
    // 앱을 보고 있으면 앱 안에서 아래에 살짝 보여주니까, 폰 알림은 바로 치워요
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === "visible")) {
      const shown = await self.registration.getNotifications({ tag });
      shown.forEach((n) => n.close());
    }
  })());
});

// 알림을 누르면 앱을 열고 같이 보기로
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "./?feed=1", self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) {
      await win.focus();
      win.postMessage({ type: "buja-open-feed" });
      return;
    }
    await self.clients.openWindow(target);
  })());
});
