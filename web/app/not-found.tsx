import { AtlasSection } from "@/components/civic/public-layout";
import Link from "next/link";
import { PageHeading } from "@/components/workspace";
export default function NotFound() {
  return <AtlasSection><PageHeading title="Запис не знайдено" description="Запитаний запис не знайдено у доступному каталозі. Якщо джерело недоступне, скористайтеся GitHub."/><div className="inline-actions"><Link className="button primary" href="/issues">Переглянути питання</Link><Link className="button secondary" href="/">На головну</Link><a className="button secondary" href="https://github.com/ailubes/uagp">GitHub</a></div></AtlasSection>;
}
