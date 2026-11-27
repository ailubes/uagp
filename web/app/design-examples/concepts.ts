export const concepts = [
  { slug: "atlas", title: "Атлас участі", short: "Атлас", description: "Ілюстрований огляд. Від знайомого міського простору до конкретного питання громади." },
  { slug: "journal", title: "Спільна справа", short: "Журнал", description: "Громадський журнал. Одне питання крупним планом, поруч — документи та перебіг обговорень." },
  { slug: "register", title: "Робочий реєстр", short: "Реєстр", description: "Простір для постійної роботи. Пошук, фільтри й останні зміни доступні одразу." }
] as const;
export const basePath = "/design-examples";
export type Concept = typeof concepts[number]["slug"];
