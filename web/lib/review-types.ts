export const phases = {
  received: "Отримано на розгляд",
  clarify: "Потрібне уточнення",
  declined: "Відхилено з поясненням",
  approved: "Перевірено · очікує вашої згоди",
  ready: "Погоджено для GitHub",
  publishing: "Триває перевірка публікації",
  published: "Опубліковано в GitHub",
} as const;

export type Phase = keyof typeof phases;
export type Card = {
  id: string;
  version: number;
  title: string;
  body: string;
  state: Phase;
  issue?: number;
  history: { state: Phase; at: string; note: string }[];
};
