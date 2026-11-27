"use client";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X, CircleHelp } from "lucide-react";
import { categories, filterItems, type Category, type Filters, type Item, type Kind, type Status } from "@/lib/model";
import { ItemList } from "./workspace";

const issueTabs: {value:Status|"all";label:string}[] = [
  {value:"all",label:"Усі"},{value:"open",label:"Відкриті"},{value:"closed",label:"Закриті"},
];
const solutionTabs: {value:Status|"all";label:string}[] = [
  {value:"all",label:"Усі"},{value:"draft",label:"Чернетки"},{value:"review",label:"До розгляду"},{value:"merged",label:"Злиті"},{value:"closed",label:"Закриті без злиття"},
];

export function Catalog({items,kind,initialQuery="",action}:{items:Item[];kind:Kind;initialQuery?:string;action?:ReactNode}) {
  const [query,setQuery]=useState(initialQuery);
  const [status,setStatus]=useState<Status|"all">("all");
  const [category,setCategory]=useState<Category|"all">("all");
  const [assignment,setAssignment]=useState<Filters["assignment"]>("all");
  const [sort,setSort]=useState<Filters["sort"]>("updated");
  const deferred=useDeferredValue(query);
  const visible=useMemo(()=>filterItems(items,{query:deferred,status,category,assignment,sort}),[items,deferred,status,category,assignment,sort]);
  const tabs=kind==="issue"?issueTabs:solutionTabs;
  const reset=()=>{setQuery("");setStatus("all");setCategory("all");setAssignment("all");setSort("updated");};
  return <section className="catalog" aria-label={kind==="issue"?"Реєстр питань":"Реєстр запропонованих змін"}>
    <div className="catalog-toolbar">
      <div className="catalog-actions">
        <div className="status-tabs" role="group" aria-label="Фільтр за станом">
          {tabs.map(tab=><button key={tab.value} type="button" className={"tab"+(status===tab.value?" active":"")} aria-pressed={status===tab.value} onClick={()=>setStatus(tab.value)}>{tab.label}<span>{items.filter(i=>tab.value==="all"||i.status===tab.value).length}</span></button>)}
        </div>
        {action}
      </div>
      <div className="filters">
        <div className="search-field"><Search size={18}/><label className="sr-only" htmlFor="catalog-search">Пошук за номером, назвою або змістом</label><input id="catalog-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Назва, зміст або #номер" autoComplete="off"/>{query?<button type="button" className="icon-button" onClick={()=>setQuery("")} aria-label="Очистити пошук"><X size={15}/></button>:null}</div>
        <div className="filter-field"><SlidersHorizontal size={16}/><label htmlFor="category" className="sr-only">Напрям роботи</label><select id="category" value={category} onChange={e=>setCategory(e.target.value as Category|"all")}><option value="all">Усі напрями</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        {kind==="issue"?<div className="filter-field"><label htmlFor="assignment" className="sr-only">Призначення виконавця</label><select id="assignment" value={assignment} onChange={e=>setAssignment(e.target.value as Filters["assignment"])}><option value="all">Усі виконавці</option><option value="unassigned">Без призначення</option><option value="assigned">Є виконавець</option></select></div>:null}
        <div className="filter-field"><label htmlFor="sort" className="sr-only">Сортування</label><select id="sort" value={sort} onChange={e=>setSort(e.target.value as Filters["sort"])}><option value="updated">За оновленням</option><option value="number">За номером</option></select></div>
      </div>
      <div className="filter-summary" aria-live="polite"><span>Знайдено: {visible.length} із {items.length}{query!==deferred?" · оновлення пошуку…":""}</span><button type="button" className="link-button" onClick={reset}>Скинути фільтри</button></div>
    </div>
    {visible.length?<ItemList items={visible}/>:<div className="empty-state"><CircleHelp size={30}/><h2>Нічого не знайдено</h2><p>Спробуйте номер питання, інше слово або змініть фільтри.</p><button type="button" className="button secondary" onClick={reset}>Показати всі</button></div>}
    <p className="catalog-footnote">Напрями роботи – навігаційне групування сайту, а не офіційні мітки GitHub. Статуси й призначення походять із джерела.</p>
  </section>;
}
