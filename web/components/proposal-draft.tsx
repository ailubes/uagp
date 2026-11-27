"use client";
import { useState, type FormEvent } from "react";
import { Download, ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ProposalDraft() {
  const [title,setTitle]=useState("");
  const [problem,setProblem]=useState("");
  const [outcome,setOutcome]=useState("");
  const [solution,setSolution]=useState("");
  const [message,setMessage]=useState("");
  function download(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!title.trim()||!problem.trim()||!outcome.trim()) {setMessage("Заповніть назву, опис проблеми й бажаний результат.");return;}
    const text=["# "+title.trim(),"","## Проблема",problem.trim(),"","## Бажаний результат",outcome.trim(),"","## Можливе рішення",solution.trim()||"Ще не визначено.","","---","Чернетка для добровільного публічного обговорення UAGP. Не є офіційним зверненням до органу влади. Перевірте текст і не публікуйте приватні дані."].join("\n");
    const url=URL.createObjectURL(new Blob([text],{type:"text/markdown;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="uagp-proposal.md";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage("Чернетку підготовлено для завантаження. Нічого не надіслано на сервер.");
  }
  return <div id="proposal" className="proposal-panel">
    <div className="section-heading"><div><h2>Підготуйте власну пропозицію</h2><p>Без реєстрації, без AI та без надсилання даних.</p></div></div>
    <div className="privacy-note"><ShieldCheck size={20}/><p>Використовуйте тільки знеособлену інформацію, яку можна оприлюднити. Текст не зберігається на сервері. Для розгляду передайте фінальну картку в закриту чергу.</p></div>
    <form className="draft-form" onSubmit={download}>
      <label htmlFor="draft-title">Назва пропозиції <span>*</span></label>
      <input id="draft-title" required maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Наприклад, узгодження розкладів транспорту"/>
      <label htmlFor="draft-problem">Що саме не працює? <span>*</span></label>
      <textarea id="draft-problem" required maxLength={3000} rows={4} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Опишіть проблему без персональних даних"/>
      <label htmlFor="draft-outcome">Що має змінитися? <span>*</span></label>
      <textarea id="draft-outcome" required maxLength={2000} rows={3} value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="Який результат можна буде перевірити?"/>
      <label htmlFor="draft-solution">Ваша ідея рішення (необов'язково)</label>
      <textarea id="draft-solution" maxLength={3000} rows={3} value={solution} onChange={e=>setSolution(e.target.value)} placeholder="Можливі кроки, альтернативи або запитання"/>
      <div className="draft-actions"><button className="button primary" type="submit"><Download size={17}/> Завантажити чернетку</button><Link className="button secondary" href="/join/card">Передати погоджену картку <ArrowUpRight size={16}/></Link></div>
      <p className="form-message" role="status">{message}</p>
    </form>
  </div>;
}
