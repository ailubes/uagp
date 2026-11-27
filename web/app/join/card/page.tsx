import { AuthorCard } from "@/components/author-card";
import { AtlasSection } from "@/components/civic/public-layout";
import { PageHeading } from "@/components/workspace";
import "@/components/civic/review.css";

export const metadata = { title: "Моя картка", robots: {index:false,follow:false}, referrer: "no-referrer" as const };
export default function Page() {
  return <AtlasSection active="/join"><PageHeading title="Моя картка" description="Приватний розгляд пропозиції"/><AuthorCard/></AtlasSection>;
}
