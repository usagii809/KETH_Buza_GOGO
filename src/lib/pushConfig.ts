// 🔔 알림(푸시) 설정
// - PUSH_WORKER_URL: Cloudflare에 만든 알림 서버 주소 (비워두면 알림을 보내지 않아요)
// - VAPID_PUBLIC_KEY: 알림용 공개키 (Cloudflare Worker의 VAPID_PUBLIC과 같은 값. 공개돼도 괜찮아요)
export const PUSH_WORKER_URL: string = "https://buja-push.wooth809.workers.dev";
export const VAPID_PUBLIC_KEY = "BKrABh1P6TA43iMvgyKCMd0IQhaih9IG4wIV-K5WJkNy3GcOoKVjJ1a50F4q2iMoUArpm_gVdrcPBrdbqzIBuSQ";
