import { Dumbbell } from "lucide-react";
export default function Thumb({ path, size = 44 }: { path?: string | null; size?: number }) {
  return path ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/media/${path}`} alt="" width={size} height={size} className="rounded-lg object-cover bg-soft shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-lg bg-soft text-accent grid place-items-center shrink-0" style={{ width: size, height: size }}><Dumbbell size={size * 0.45} /></div>
  );
}
