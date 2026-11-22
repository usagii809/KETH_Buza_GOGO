import type { Profile } from "../lib/types";

const BG: Record<string, string> = { 태형: "bg-blue-100 text-toss-blue", 경은: "bg-rose-100 text-rose-600" };

/** 동그란 프로필 사진. 사진이 없으면 이름 첫 글자 */
export function Avatar({ profile, size = 40, className = "" }: { profile?: Profile | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (profile?.photo) {
    return <img src={profile.photo} alt={profile.name || "프로필"} style={style} className={`rounded-full object-cover bg-toss-bg ${className}`} />;
  }
  const name = profile?.name;
  return (
    <span style={{ ...style, fontSize: size * 0.42 }}
      className={`rounded-full inline-flex items-center justify-center font-bold ${name ? BG[name] : "bg-toss-bg text-toss-sub"} ${className}`}>
      {name ? name[0] : "🙂"}
    </span>
  );
}
