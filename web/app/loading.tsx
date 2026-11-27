import { AtlasSection } from "@/components/civic/public-layout";
export default function Loading() {
  return <AtlasSection><div className="atlas-loading" aria-busy="true" role="status"><p>Завантажуємо робочий простір UAGP…</p><div className="skeleton wide"/><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></AtlasSection>;
}
