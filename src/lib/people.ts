// 로그인 계정 → 이름.
// 저장소가 공개라서 이메일 주소를 그대로 적지 않고 SHA-256 해시로만 보관해요.
// 계정을 바꾸면: 새 이메일(소문자)의 SHA-256 값을 아래에 넣어주세요.

export type PersonName = "태형" | "경은";

export const PEOPLE_BY_EMAIL_HASH: Record<string, PersonName> = {
  "263b42a4d4f6b2438b83db40e6c34f447615845d16234eea433458dcd4aac438": "태형",
  "c365a939b86b7f34edce15feecc970980d0fdd487b9917bbea5d7a86c6d02706": "경은"
};

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 로그인 이메일로 태형/경은을 알아내요 (모르는 계정이면 null) */
export async function nameForEmail(email: string | null | undefined, table = PEOPLE_BY_EMAIL_HASH): Promise<PersonName | null> {
  if (!email) return null;
  return table[await sha256Hex(email.trim().toLowerCase())] ?? null;
}
