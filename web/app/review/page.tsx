import { prepareDevelopmentReviewer } from "@/lib/review-store";
import { ReviewDesk } from "@/components/review-desk";
import { AtlasSection } from "@/components/civic/public-layout";
import { PageHeading } from "@/components/workspace";
import "@/components/civic/review.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Черга розгляду", robots: {index:false,follow:false}, referrer: "no-referrer" as const };
export default function Page() {
  prepareDevelopmentReviewer();
  return <AtlasSection><PageHeading title="Черга розгляду" description="Робочий простір рецензента UAGP"/><ReviewDesk/></AtlasSection>;
}
