"use client";
import { useState } from "react";
import { phases, type Card } from "@/lib/review-types";

export async function queueRequest<T>(key: string, action: string, data: Record<string,unknown> = {}): Promise<T> {
  const r = await fetch("/api/review-queue", { method:"POST", cache:"no-store", credentials:"omit",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},body:JSON.stringify({action,...data}) });
  const result = await r.json();
  if (!r.ok) throw Error(result.error);
  return result;
}

export function useQueueAction() {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function run(task: () => Promise<void>) {
    setBusy(true); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося виконати дію."); }
    finally { setBusy(false); }
  }
  return { busy,error,run };
}
export function CardView({card}:{card:Card}) {
  return <>
    <section className="queue-paper"><p className="queue-phase">{phases[card.state]}</p><h2>{card.title}</h2>
      <div className="queue-text">{card.body}</div>
      {card.issue && <a href={"https://github.com/ailubes/uagp/issues/"+card.issue}>Переглянути Issue #{card.issue} у GitHub</a>}
    </section>
    <section><h2>Перебіг розгляду</h2><ol className="queue-history">{card.history.map((e,i)=><li key={i}>
      <strong>{phases[e.state]}</strong> <time dateTime={e.at}>{new Date(e.at).toLocaleString("uk-UA")}</time><p>{e.note}</p>
    </li>)}</ol></section>
  </>;
}
export function CardForm({card,busy,onSubmit}:{card?:Card;busy:boolean;onSubmit:(title:string,body:string)=>void}) {
  const [title,setTitle]=useState(card?.title || "");
  const [body,setBody]=useState(card?.body || "");
  const [confirmed,setConfirmed]=useState(false);
  return <form className="draft-form" onSubmit={e=>{e.preventDefault();if(confirmed)onSubmit(title,body);}}>
    <label htmlFor="card-title">Назва картки</label><input id="card-title" required maxLength={140} value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false);}}/>
    <label htmlFor="card-text">Погоджений текст картки</label><textarea id="card-text" required rows={9} maxLength={12000} value={body} onChange={e=>{setBody(e.target.value);setConfirmed(false);}}/>
    <label className="queue-check"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Я перевірив(-ла) цей заголовок і текст та передаю їх рецензенту. Дозвіл на публікацію надам окремо.</label>
    <button className="button primary" disabled={busy || !confirmed || !title.trim() || !body.trim()}>Передати на перевірку</button>
  </form>;
}
