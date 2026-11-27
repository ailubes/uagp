import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight, ChevronRight, CircleCheck, CircleDot, CircleHelp, FileText, GitMerge,
  GitPullRequest, GitPullRequestDraft, Info, MessageSquare, Search
} from "lucide-react";
import { categoryFor, formatDate, itemPath, REPO, statusText, type CatalogResult, type Item, type Status } from "@/lib/model";

export function PageHeading({title,description,children}:{title:ReactNode;description?:string;children?:ReactNode}) {
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
  return <form className="quick-search" action="/issues" method="get"><label className="sr-only" htmlFor="quick-query">Шукати питання</label><Search size={19} aria-hidden="true"/><input id="quick-query" name="q" type="search" placeholder="Знайти питання за назвою або номером…"/><button type="submit" className="button secondary">Пошук</button></form>;
}
