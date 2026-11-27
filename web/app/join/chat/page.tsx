import { ChatParticipation } from "@/components/chat-participation";
import { AtlasSection } from "@/components/civic/public-layout";
import { PageHeading } from "@/components/workspace";
import { getCatalog } from "@/lib/github";
import { formatDate, githubItemUrl, statusText } from "@/lib/model";
import "./guide.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Участь через власний чат" };

export default async function ChatGuide() {
  const data = await getCatalog();
  const records = [...data.issues, ...data.solutions].sort((a, b) => b.number - a.number);
  const catalog = [
    "Публічний реєстр UAGP · " + (data.source === "snapshot" ? "резервний знімок" : "дані GitHub") + " · " + formatDate(data.capturedAt, true),
    ...records.map(item => [githubItemUrl(item), item.kind === "issue" ? "Питання" : "Запропонована зміна", statusText[item.status], item.title].join(" · ")),
  ].join("\n");
  return <AtlasSection active="/join">
    <PageHeading title={<>Участь через <em>власний чат</em></>} description="Опишіть, що ви помітили, або доповніть відкрите питання. Чат допоможе підготувати чернетку для перевірки."/>
    <ChatParticipation catalog={catalog}/>
  </AtlasSection>;
}
