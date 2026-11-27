"use client";
import { useEffect, useRef, useState } from "react";
import { CardForm, CardView, queueRequest, useQueueAction } from "./review-ui";
import type { Card } from "@/lib/review-types";

function freshKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), x=>x.toString(16).padStart(2,"0")).join("");
}
export function AuthorCard() {
  const [key,setKey]=useState<string|null>(null);
  const [card,setCard]=useState<Card|null>(null);
  const [allow,setAllow]=useState(false);
  const [saved,setSaved]=useState(false);
  const pending=useRef("");
  const {busy,error,run}=useQueueAction();
  useEffect(()=>{
    let active=true;
    async function load() {
      const token=location.hash.slice(1);
      setCard(null);setKey(token);setAllow(false);setSaved(false);
      if(token) await run(async()=>{
        const found=await queueRequest<Card>(token,"track");
        if(active && location.hash.slice(1)===token)setCard(found);
      });
    }
    void load();
    window.addEventListener("hashchange",load);
    return ()=>{active=false;window.removeEventListener("hashchange",load);};
    // The private fragment is the only input used to open a receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const refresh=()=>run(async()=>{setCard(await queueRequest<Card>(key!,"track"));setAllow(false);});
  return <div className="queue-flow">
    {error && <p role="alert">{error}</p>}
    {key===null ? <p>Завантаження…</p> : !key ? <>
      <p>Вставте лише фінальну знеособлену картку. Після передавання ви отримаєте приватне посилання на її стан.</p>
      <CardForm busy={busy} onSubmit={(title,body)=>run(async()=>{
        pending.current ||= freshKey();
        const found=await queueRequest<Card>(pending.current,"create",{title,body,consent:true});
        history.replaceState(null,"","#"+pending.current);
        setKey(pending.current);setCard(found);
      })}/>
    </> : <>
      <section><h2>Ваше приватне посилання</h2><p>Збережіть цю адресу, щоб повернутися з іншого пристрою. Той, хто має посилання, може читати картку й діяти від імені автора.</p>
        <input aria-label="Приватне посилання" readOnly value={location.href} onFocus={e=>e.target.select()}/>
        <div className="inline-actions"><button className="button secondary" onClick={()=>run(async()=>{await navigator.clipboard.writeText(location.href);setSaved(true);})}>{saved?"Скопійовано":"Скопіювати посилання"}</button>
          <button className="button secondary" disabled={busy} onClick={refresh}>Оновити стан</button></div>
      </section>
      {card && <><CardView card={card}/>
        {card.state==="clarify" && <section><h2>Уточнити картку</h2><CardForm key={card.version} card={card} busy={busy} onSubmit={(title,body)=>run(async()=>{
          setCard(await queueRequest<Card>(key,"revise",{title,body,consent:true,version:card.version}));
        })}/></section>}
        {card.state==="approved" && <section><h2>Погодження публікації</h2><p>Перечитайте картку вище. Саме її заголовок і текст зможе опублікувати рецензент у відкритому репозиторії ailubes/uagp.</p>
          <label className="queue-check"><input type="checkbox" checked={allow} onChange={e=>setAllow(e.target.checked)}/>Дозволяю оприлюднити цю версію в GitHub.</label>
          <button className="button primary" disabled={!allow||busy} onClick={()=>run(async()=>{setCard(await queueRequest<Card>(key,"consent",{version:card.version,consent:true}));setAllow(false);})}>Погодити публікацію</button>
        </section>}
      </>}
    </>}
  </div>;
}
