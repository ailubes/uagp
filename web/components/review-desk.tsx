"use client";
import { useState } from "react";
import { CardView, queueRequest, useQueueAction } from "./review-ui";
import { phases, type Card } from "@/lib/review-types";

type Entry = Pick<Card,"id"|"title"|"state">;
export function ReviewDesk() {
  const [key,setKey]=useState("");
  const [rows,setRows]=useState<Entry[]|null>(null);
  const [offset,setOffset]=useState(0);
  const [card,setCard]=useState<Card|null>(null);
  const [note,setNote]=useState("");
  const [number,setNumber]=useState("");
  const {busy,error,run}=useQueueAction();
  function list(start:number) {
    return run(async()=>{setRows(await queueRequest<Entry[]>(key,"list",{offset:start}));setOffset(start);setCard(null);});
  }
  function open(id:string) {
    return run(async()=>{setCard(await queueRequest<Card>(key,"read",{id}));setNote("");setNumber("");});
  }
  function act(action:string) {
    if(!card)return;
    return run(async()=>{setCard(await queueRequest<Card>(key,action,{id:card.id,version:card.version,note,number}));setNote("");});
  }
  return <div className="queue-flow">
    {error && <p role="alert">{error}</p>}
    {rows===null ? <form className="draft-form" onSubmit={e=>{e.preventDefault();void list(0);}}>
      <label htmlFor="review-key">Ключ рецензента</label>
      <input id="review-key" type="password" autoComplete="current-password" required value={key} onChange={e=>setKey(e.target.value)}/>
      <button className="button primary" disabled={busy}>Відкрити чергу</button>
    </form> : <>
      <div className="inline-actions"><button className="button secondary" disabled={busy} onClick={()=>list(offset)}>{card?"До черги":"Оновити чергу"}</button>
        {card && <button className="button secondary" disabled={busy} onClick={()=>open(card.id)}>Оновити картку</button>}
        <button className="button secondary" disabled={busy} onClick={()=>{setKey("");setRows(null);setCard(null);setNote("");}}>Вийти</button></div>
      {!card ? <><ul className="queue-list">{rows.map(row=><li key={row.id}>
        <button disabled={busy} onClick={()=>open(row.id)}>{row.title}</button><span>{phases[row.state]}</span>
      </li>)}</ul>{!rows.length && <p>Карток на цій сторінці поки немає.</p>}
        <div className="inline-actions">{offset>0 && <button disabled={busy} onClick={()=>list(Math.max(0,offset-25))}>Попередні</button>}
        {rows.length===25 && <button disabled={busy} onClick={()=>list(offset+25)}>Наступні</button>}</div></> :
      <><CardView card={card}/>
        {card.state==="received" && <section className="draft-form"><h2>Результат перевірки</h2>
          <label htmlFor="review-note">Пояснення для автора</label><textarea id="review-note" maxLength={2000} rows={4} value={note} onChange={e=>setNote(e.target.value)}/>
          <div className="inline-actions">
            <button disabled={busy||!note.trim()} className="button primary" onClick={()=>act("approve")}>Схвалити картку</button>
            <button disabled={busy||!note.trim()} className="button secondary" onClick={()=>act("clarify")}>Запросити уточнення</button>
            <button disabled={busy||!note.trim()} className="button secondary" onClick={()=>act("decline")}>Відхилити</button></div>
        </section>}
        {card.state==="ready" && <section><p>Автор погодив публікацію цієї версії.</p><button className="button primary" disabled={busy} onClick={()=>act("publish")}>Опублікувати Issue в ailubes/uagp</button></section>}
        {card.state==="publishing" && <section className="draft-form"><p>Звірте останні Issues в ailubes/uagp. Укажіть номер створеного запису: сервер перевірить текст і службову позначку.</p>
          <label htmlFor="issue-number">Номер Issue</label><input id="issue-number" type="number" min="1" value={number} onChange={e=>setNumber(e.target.value)}/>
          <button className="button secondary" disabled={busy||!number} onClick={()=>act("reconcile")}>Звірити з GitHub</button></section>}
      </>}
    </>}
  </div>;
}
