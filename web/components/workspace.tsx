import type { ReactNode } from "react";
import Link from "next/link";
import {
  LayoutGrid, CircleDot, GitPullRequest, BookOpen, Users, Compass,
  FolderOpen, ArrowUpRight, Plus, Github, Search, Info, GitMerge,
  CircleCheck, GitPullRequestDraft, ChevronRight, MessageSquare,
  CircleHelp, FileText
} from "lucide-react";
import { categoryFor, formatDate, itemPath, REPO, statusText, type CatalogResult, type Item, type Status } from "@/lib/model";

const navigation = [
  {href:"/",label:"Огляд",icon:LayoutGrid},
  {href:"/issues",label:"Відкриті питання",icon:CircleDot},
  {href:"/solutions",label:"Запропоновані зміни",icon:GitPullRequest},
  {href:"/charter",label:"Хартія",icon:BookOpen},
  {href:"/community",label:"Спільнота",icon:Users},
  {href:"/strategy",label:"Стратегія",icon:Compass},
  {href:"/documents",label:"Документи",icon:FolderOpen},
] as const;

export function Mark() {
  return <svg viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="currentColor"/>
    <path d="M8 9.5v10a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-10M8 15.5h16M16 8v15.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="16" cy="8" r="2.4" fill="#fff"/>
  </svg>;
}

export function Shell({active, title, children}: {active:string;title:string;children:ReactNode}) {
  return <div className="app-shell">
    <a className="skip-link" href="#main">Перейти до змісту</a>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="UAGP – головна">
        <span className="brand-mark"><Mark/></span>
        <span><strong>UAGP</strong><small>Відкритий робочий простір</small></span>
      </Link>
      <Link className="button primary sidebar-cta" href="/join#proposal"><Plus size={16}/> Запропонувати ідею</Link>
      <nav className="side-nav" aria-label="Основна навігація">
        {navigation.map(({href,label,icon:Icon})=><Link className={"nav-item"+(active===href?" selected":"")} key={href} href={href} aria-current={active===href?"page":undefined}><Icon size={17} strokeWidth={1.7}/><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-footer">
        <Link href="/join" className={"nav-item"+(active==="/join"?" selected":"")} aria-current={active==="/join"?"page":undefined}><Users size={17} strokeWidth={1.7}/> Долучитися</Link>
        <Link className="nav-item" href="/documents/faq"><CircleHelp size={17} strokeWidth={1.7}/> Як це працює</Link>
        <a className="nav-item" href={REPO}><Github size={17} strokeWidth={1.7}/> GitHub <ArrowUpRight size={13} className="nav-arrow"/></a>
        <div className="project-state"><span className="state-dot"/> Дослідницький проєкт</div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumbs"><Link href="/">UAGP</Link><ChevronRight size={14}/><span>{title}</span></div>
        <div className="top-actions"><a className="top-source" href={REPO}><Github size={16}/> <span>Відкритий код</span></a><Link className="button secondary top-join" href="/join">Долучитися <ArrowUpRight size={15}/></Link></div>
      </header>
      <main id="main" className="main-content" tabIndex={-1}>{children}</main>
      <footer className="main-footer"><span>Протокол алгоритмічного врядування України (UAGP)</span><span>Не є державним сервісом, виборами чи офіційним каналом звернень.</span><Link href="/documents/security">Безпека та приватність</Link></footer>
    </div>
  </div>;
}

export function PageHeading({title,description,children}:{title:string;description?:string;children?:ReactNode}) {
  return <div className="page-heading"><div><h1>{title}</h1>{description?<p className="lede">{description}</p>:null}</div>{children?<div className="heading-actions">{children}</div>:null}</div>;
}

export function SourceNotice({data}: {data:CatalogResult}) {
  return <div className={"source-notice"+(data.source==="snapshot"?" fallback":"")} role="status">
    {data.source==="github"?<span className="state-dot"/>:<Info size={15}/>}
    <span>{data.source==="github"?"GitHub · дані отримано":data.reason==="preview"?"Тестовий режим · знімок даних":"GitHub недоступний · показано збережений знімок"} <time dateTime={data.capturedAt}>{formatDate(data.capturedAt,true)}</time>{data.source==="snapshot"?" · статуси можуть бути застарілими":""}</span>
    <a href={REPO}>Першоджерело <ArrowUpRight size={13}/></a>
  </div>;
}

export function StatusMark({status}:{status:Status}) {
  const Icon=status==="merged"?GitMerge:status==="draft"?GitPullRequestDraft:status==="review"?GitPullRequest:status==="closed"?CircleCheck:CircleDot;
  return <span className={"status-mark status-"+status}><Icon size={15} strokeWidth={1.9} aria-hidden="true"/><span>{statusText[status]}</span></span>;
}

export function ItemRow({item}:{item:Item}) {
  return <Link className="item-row" href={itemPath(item)} aria-label={"#"+item.number+" "+item.title}>
    <div className="item-id"><span className={"state-icon status-"+item.status}>{item.kind==="issue"?<CircleDot size={17}/>:<GitPullRequest size={17}/>}</span><span>#{item.number}</span></div>
    <div className="item-main"><strong>{item.title}</strong><div className="item-meta"><span>{categoryFor(item)}</span><span className="meta-separator"/><span>{item.assignees===null?"Відомості про виконавця відсутні":item.assignees.length?item.assignees.map(x=>"@"+x).join(", "):"Без призначення"}</span>{item.comments!==null&&item.comments>0?<span className="comment-count"><MessageSquare size={13}/> {item.comments}</span>:null}</div></div>
    <div className="item-right"><StatusMark status={item.status}/><time dateTime={item.updatedAt??undefined}>{formatDate(item.updatedAt)}</time></div>
    <ChevronRight className="row-chevron" size={16} aria-hidden="true"/>
  </Link>;
}

export function ItemList({items,empty="Поки немає записів."}:{items:Item[];empty?:string}) {
  return <div className="item-list">{items.length?items.map(i=><ItemRow key={i.kind+"-"+i.number} item={i}/>):<div className="empty-state"><CircleHelp size={26}/><p>{empty}</p></div>}</div>;
}

export function SectionHeading({title,description,href,label="Переглянути всі"}:{title:string;description?:string;href?:string;label?:string}) {
  return <div className="section-heading"><div><h2>{title}</h2>{description?<p>{description}</p>:null}</div>{href?<Link className="text-link" href={href}>{label} <ChevronRight size={15}/></Link>:null}</div>;
}

export function DirectoryLink({href,title,description}:{href:string;title:string;description:string}) {
  return <Link className="directory-link" href={href}><FileText size={19} className="directory-icon"/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16}/></Link>;
}

export function SearchBox() {
  return <form className="quick-search" action="/issues" method="get"><label className="sr-only" htmlFor="quick-query">Шукати відкриті питання</label><Search size={19} aria-hidden="true"/><input id="quick-query" name="q" type="search" placeholder="Знайти питання за назвою або номером…"/><button type="submit" className="button secondary">Пошук</button></form>;
}
