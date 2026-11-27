"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { roles, participationPrompt } from "@/lib/participation-prompts";

const providers = {
  ChatGPT: {
    steps: "У налаштуваннях відкрийте Plugins → GitHub. Якщо для вашого акаунта доступний ailubes/uagp, виберіть його й попросіть чат прочитати правила участі. Доступ залежить від тарифу та робочого простору.",
    help: "https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt",
  },
  Claude: {
    steps: "У чаті натисніть «+» → Add from GitHub. Виберіть ailubes/uagp і файли GOVERNANCE.md та docs/community/PROPOSALS.md з гілки main. Інтеграція читає файли. Перелік питань передається окремо в тексті нижче.",
    help: "https://support.claude.com/en/articles/10167454-use-the-github-integration",
  },
  Gemini: {
    steps: "На комп’ютері у вебверсії виберіть Add files → More uploads → Import code та введіть https://github.com/ailubes/uagp. Імпорт фіксує версію файлів на момент завантаження. Питання й PR передайте разом із підготовленим текстом.",
    help: "https://support.google.com/gemini/answer/16176929",
  },
};

export function ChatParticipation({ catalog }: { catalog: string }) {
  const [provider, setProvider] = useState<keyof typeof providers>("ChatGPT");
  const [role, setRole] = useState(0);
  const [message, setMessage] = useState("");
  const prompt = participationPrompt(roles[role].task, roles[role].name, catalog);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("Текст скопійовано. Вставте його в нову розмову.");
    } catch {
      setMessage("Скористайтеся завантаженням або виділіть і скопіюйте текст нижче.");
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "uagp-uchast.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="chat-guide">
    <section><h2>Виберіть свій чат</h2>
      <div className="chat-choices" role="group" aria-label="Чат">
        {(Object.keys(providers) as (keyof typeof providers)[]).map(name => <button type="button" key={name} aria-pressed={provider === name} onClick={() => setProvider(name)}>{name}</button>)}
      </div>
      <p>Найпростіше — вставити підготовлений текст у свій чат. У ньому вже є інструкція та перелік тем із реєстру.</p>
      <details><summary>Як додати файли репозиторію в {provider}</summary><p>{providers[provider].steps} <a href={providers[provider].help}>Довідка {provider}</a></p></details>
    </section>
    <section><h2><label htmlFor="contribution-role">З якого досвіду ви виходите?</label></h2>
      <select id="contribution-role" value={role} onChange={e => {setRole(Number(e.target.value));setMessage("");}}>
        {roles.map((r, index) => <option key={r.name} value={index}>{r.name}</option>)}
      </select>
      <p>{roles[role].task}</p>
    </section>
    <section><h2>Почніть розмову</h2>
      <p>Скопіюйте текст або прикріпіть файл. Свою тему опишіть у чаті одним реченням. Використовуйте лише відомості, які можна передати обраному сервісу.</p>
      <div className="inline-actions"><button className="button primary" onClick={copy}><Copy size={16}/>Скопіювати для чату</button><button className="button secondary" onClick={download}><Download size={16}/>Завантажити .txt</button></div>
      <p role="status">{message}</p>
      <details><summary>Переглянути весь текст</summary><pre>{prompt}</pre></details>
    </section>
    <section><h2>Передайте погоджену картку</h2><p>Перевірте переказ у своєму чаті. На платформу скопіюйте заголовок і фінальний текст картки. За приватним посиланням ви побачите відповідь рецензента і зможете погодити публікацію.</p>
      <Link className="button primary" href="/join/card">Передати картку на розгляд</Link>
    </section>
  </div>;
}
