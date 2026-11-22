// 기기별로 기억하는 값 (각자 폰이라 마지막 선택 = 대부분 본인)
export const store = {
  get(key: string, fallback: string): string {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }
};
