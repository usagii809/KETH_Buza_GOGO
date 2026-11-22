/** 받침에 맞는 조사: josa("쿠폰", "을", "를") → "쿠폰을" (이모지·숫자로 끝나면 둘 다 붙여요) */
export function josa(word: string, withJong: string, withoutJong: string): string {
  const chars = [...word.trim()];
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i].charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const jong = (c - 0xac00) % 28;
      // ㄹ 받침 뒤엔 '로' (서울로, 여행으로)
      if (withJong === "으로" && jong === 8) return word + withoutJong;
      return word + (jong ? withJong : withoutJong);
    }
  }
  return `${word}${withJong}(${withoutJong})`;
}
