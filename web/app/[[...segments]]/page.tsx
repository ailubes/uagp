import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, CircleDot, GitPullRequest, GitMerge, Users, BookOpen, Compass, Info, ShieldCheck, MessageSquare, Plus, FileText, ChevronLeft, Code2 } from "lucide-react";
import { Shell, PageHeading, SectionHeading, SourceNotice, ItemList, StatusMark, SearchBox, DirectoryLink } from "@/components/workspace";
import { Catalog } from "@/components/catalog";
import { ProposalDraft } from "@/components/proposal-draft";
import { PublicMarkdown } from "@/components/markdown";
import { getCatalog } from "@/lib/github";
import { getDocument, documentUrl, hasDocument } from "@/lib/documents";
import { REPO, formatDate, latest, githubItemUrl, itemPath, referencedItems, categoryFor, type CatalogResult, type Item, type Kind } from "@/lib/model";

export const dynamic = "force-dynamic";

const documents = [
  ["charter","Хартія v0.4","Повний текст робочої Хартії з основної гілки."],
  ["principles","Принципи UAGP","Засади відкритої громадянської участі."],
  ["start","З чого почати","Інструкція для громадянина без спеціальних знань."],
  ["proposal","Шаблон пропозиції","Структура публічної знеособленої ідеї."],
  ["faq","Поширені запитання","Межі, можливості та призначення UAGP."],
  ["charter-review","Перегляд Хартії","Процедура пропонування та рецензування поправок."],
  ["groups","Робочі групи","Запропоновані напрями добровільної співпраці."],
  ["governance","Управління спільнотою","Правила відкритого дослідницького проєкту."],
  ["security","Безпека і приватність","Як поводитися з вразливостями та чутливою інформацією."],
  ["identity","Незалежна ідентифікація","ADR-010: незалежний OIDC, без Wesfin ID."],
  ["architecture","Архітектура протоколу","Принципи федеративної технічної реалізації."],
  ["steward","Participation Steward","Проєкт супроводу ініціатив · PR #21."],
  ["living-practice","Living Practice 90","Робочий план першого 90-денного пілота · PR #24."],
  ["pilot-selection","Відбір спільнот","Критерії добровільних партнерств · PR #24."],
  ["pilot-card","Картка пілотної ініціативи","Робочий шаблон для конкретного суспільного питання."],
  ["pilot-evaluation","Методика оцінювання","Початкові показники та незалежна оцінка · PR #24."],
] as const;

function DocLinks({slugs}:{slugs:readonly string[]}) {
  return <div className="directory-list">{documents.filter(d=>slugs.includes(d[0])).map(([slug,title,description])=><DirectoryLink key={slug} href={"/documents/"+slug} title={title} description={description}/>)}</div>;
}

function WorkspaceHome({data}:{data:CatalogResult}) {
  const open=data.issues.filter(i=>i.status==="open");
  const proposed=data.solutions.filter(i=>i.status==="draft"||i.status==="review");
  const merged=data.solutions.filter(i=>i.status==="merged");
  return <>
    <PageHeading title="Робочий простір" description="Протокол алгоритмічного врядування України (UAGP) – відкрита робота над правилами, технологіями та практикою громадянської участі.">
      <Link className="button primary" href="/join"><Plus size={17}/> Долучитися до роботи</Link>
    </PageHeading>
    <SourceNotice data={data}/>
    <div className="overview-stats">
      <Link href="/issues"><CircleDot size={21}/><span><strong>{open.length}</strong><small>Відкритих питань</small></span><ArrowRight size={17}/></Link>
      <Link href="/solutions"><GitPullRequest size={21}/><span><strong>{proposed.length}</strong><small>Змін на обговоренні</small></span><ArrowRight size={17}/></Link>
      <Link href="/solutions"><GitMerge size={21}/><span><strong>{merged.length}</strong><small>Злитих змін</small></span><ArrowRight size={17}/></Link>
    </div>
    <SearchBox/>
    <div className="overview-grid">
      <div className="overview-primary">
        <section>
          <SectionHeading title="Відкриті питання" description="Знайдіть конкретну справу, над якою можна працювати." href="/issues"/>
          <ItemList items={latest(open,6)} empty="Немає відкритих питань у доступному каталозі."/>
        </section>
        <section>
          <SectionHeading title="Запропоновані зміни" description="Чернетки й рішення, які ще не є прийнятим текстом." href="/solutions"/>
          <ItemList items={latest(proposed,4)} empty="Немає відкритих пропозицій змін."/>
        </section>
      </div>
      <aside className="overview-aside">
        <section className="panel">
          <h2>Знайдіть свій внесок</h2>
          <p className="muted">Не потрібно бути розробником або мати платний AI.</p>
          <Link className="action-row" href="/join#proposal"><MessageSquare size={19}/><span><strong>Запропонувати ідею</strong><small>Почніть зі своєї проблеми.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/issues"><CircleDot size={19}/><span><strong>Взятися за питання</strong><small>Пошук і добровільна допомога.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/solutions"><GitPullRequest size={19}/><span><strong>Переглянути зміни</strong><small>Альтернативи та аргументи.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/community"><Users size={19}/><span><strong>Долучити спільноту</strong><small>Координація реальної роботи.</small></span><ArrowRight size={16}/></Link>
        </section>
        <section className="panel pilot-panel">
          <div className="panel-title"><Compass size={19}/><h2>Living Practice 90</h2></div>
          <span className="plain-status"><span className="state-dot"/> Підготовка пілота</span>
          <p>Дослідити, як 2–3 добровільні спільноти можуть працювати над реальними проблемами за 90 днів після погодження старту.</p>
          <p className="muted small">Партнерів і дату старту ще не підтверджено. Це запропонований план, не результат.</p>
          <Link className="text-link" href="/strategy">Переглянути програму <ArrowRight size={15}/></Link>
        </section>
        <section className="panel quiet-panel">
          <div className="panel-title"><ShieldCheck size={19}/><h2>Значуща участь</h2></div>
          <p>Ініціатива має отримати змістовну відповідь, зрозумілий статус і наступний крок. Ніхто не повинен бути просто числом у реєстрі.</p>
          <Link className="text-link" href="/documents/steward">Проєкт Participation Steward <ArrowRight size={15}/></Link>
          <p className="muted small">Принцип у робочій редакції, функція ще не реалізована.</p>
        </section>
      </aside>
    </div>
  </>;
}

function ItemDetail({item,data}:{item:Item;data:CatalogResult}) {
  const issue=item.kind==="issue";
  const ref=githubItemUrl(item);
  const related=referencedItems(item,[...data.issues,...data.solutions]);
  return <>
    <Link className="back-link" href={issue?"/issues":"/solutions"}><ChevronLeft size={16}/> {issue?"Усі питання":"Усі запропоновані зміни"}</Link>
    <PageHeading title={item.title} description={(issue?"Питання":"Запропонована зміна")+" #"+item.number}>
      <a className="button primary" href={ref}>{issue?"Долучитися в GitHub":"Переглянути PR"} <ArrowUpRight size={16}/></a>
    </PageHeading>
    <SourceNotice data={data}/>
    <div className="detail-grid">
      <section className="document-body">
        <div className="document-header"><StatusMark status={item.status}/><span className="muted">#{item.number}</span></div>
        {item.body?<PublicMarkdown text={item.body}/>:<p className="muted">Опис відсутній у джерелі. Перегляньте запис у GitHub.</p>}
        {related.length?<section className="references"><SectionHeading title="Згадки в описі" description="Посилання, знайдені в тексті запису. Не означають підтвердженої залежності."/><ItemList items={related}/></section>:null}
      </section>
      <aside className="detail-sidebar">
        <section className="panel metadata-panel"><h2>Відомості</h2>
          <dl>
            <div><dt>Стан у GitHub</dt><dd><StatusMark status={item.status}/></dd></div>
            <div><dt>Напрям на сайті</dt><dd>{categoryFor(item)}</dd></div>
            <div><dt>Призначення в GitHub</dt><dd>{item.assignees===null?"Немає даних":item.assignees.length?item.assignees.map(x=>"@"+x).join(", "):"Не призначено"}</dd></div>
            <div><dt>Останнє оновлення</dt><dd>{formatDate(item.updatedAt,true)}</dd></div>
            {item.labels.length?<div><dt>Мітки GitHub</dt><dd>{item.labels.join(", ")}</dd></div>:null}
            {!issue&&item.base?<div><dt>Цільова гілка</dt><dd className="code-value">{item.base}</dd></div>:null}
            {!issue&&item.head?<div><dt>Гілка змін</dt><dd className="code-value">{item.head}</dd></div>:null}
          </dl>
          <p className="small muted">{issue?"Призначення у GitHub не є підтвердженням ролі громадянського координатора.":"Злиття в цільову гілку саме по собі не створює юридичного рішення."}</p>
        </section>
        <section className="panel">
          <h2>Як долучитися</h2>
          <p>{issue?"Прочитайте опис, перевірте попередні коментарі та запропонуйте конкретний внесок.":"Перегляньте текст змін, порівняйте альтернативи та залиште аргументовані зауваження."}</p>
          <a className="button primary full" href={ref}><MessageSquare size={16}/> {issue?"Відкрити обговорення":"Рецензувати зміни"}</a>
          {!issue?<a className="button secondary full" href={ref+"/files"}>Переглянути різницю файлів <ArrowUpRight size={16}/></a>:null}
          <p className="small muted">Для коментування потрібен GitHub-акаунт. Ніколи не публікуйте приватні дані в публічних обговореннях.</p>
        </section>
      </aside>
    </div>
  </>;
}

function Charter({data}:{data:CatalogResult}) {
  const amendments=data.solutions.filter(i=>[21,23].includes(i.number));
  return <>
    <PageHeading title="Хартія UAGP" description="Робоча концепція алгоритмічних країв України. Відкрита для критичного перегляду, не є чинним нормативно-правовим актом."/>
    <section className="document-intro"><BookOpen size={24}/><div><h2>Хартія v0.4</h2><p>Права громадян, компетенції, громадянський протокол і федеративна архітектура.</p><Link className="button primary" href="/documents/charter">Читати текст Хартії <ArrowRight size={16}/></Link></div></section>
    <SectionHeading title="Запропоновані поправки" description="Робочі зміни відокремлено від тексту основної гілки."/>
    <SourceNotice data={data}/>
    <ItemList items={amendments} empty="Записи поправок недоступні. Перевірте Pull Requests у GitHub."/>
    <section className="spaced-section"><SectionHeading title="Взяти участь у перегляді"/><DocLinks slugs={["principles","charter-review","governance","steward"]}/><div className="inline-actions"><a className="button secondary" href={REPO+"/issues/new/choose"}>Запропонувати поправку <ArrowUpRight size={16}/></a><Link className="button secondary" href="/issues">Питання для розгляду</Link></div></section>
  </>;
}

function Community({data}:{data:CatalogResult}) {
  const groupLinks=[
    ["Громадянська участь і фасилітація","Допомогти з доступними поясненнями й супроводом ідей.","/issues/22"],
    ["Право та місцеве самоврядування","Рецензувати компетенції, правові межі й процедури.","/issues/17"],
    ["Приватність і безпека","Перевірити безпечність участі, захист даних і модерацію.","/issues/19"],
    ["Дослідження та оцінювання","Узгодити критерії перевірного результату.","/issues/27"],
    ["Технології, AI та веб","Протокол, архітектура, інтерфейс і тестування.","/issues/29"],
    ["Практичні спільноти","Запропонувати добровільний пілот із конкретною проблемою.","/issues/25"],
  ] as const;
  return <>
    <PageHeading title="Спільнота" description="Відкриті напрями роботи для громадян, фахівців та спільнот. Виберіть завдання, у якому ваш досвід може бути корисним."/>
    <div className="notice-line"><Info size={18}/><p>Це запропоновані робочі напрями, а не підтверджені команди з призначеними керівниками.</p></div>
    <div className="directory-list">{groupLinks.map(([title,description,href])=><DirectoryLink key={href} href={href} title={title} description={description}/>)}</div>
    <section className="spaced-section"><SectionHeading title="Координація та співзасновники"/><SourceNotice data={data}/><ItemList items={data.issues.filter(i=>[20,26,19].includes(i.number))}/></section>
    <section className="spaced-section"><SectionHeading title="Правила співпраці"/><DocLinks slugs={["groups","governance","principles","security"]}/></section>
  </>;
}

function Strategy({data}:{data:CatalogResult}) {
  return <>
    <PageHeading title="Стратегія" description="Від живої громадянської практики до перевірених змін протоколу."/>
    <section className="document-intro"><Compass size={24}/><div><h2>SG-01 · Living Practice 90</h2><p>Запропонована програма першого пілота: 2–3 діючі спільноти, 90 днів від погодження старту, реальні ініціативи, людська координація й незалежна оцінка.</p><span className="plain-status"><span className="state-dot"/> Підготовка · старт не підтверджено</span><div className="inline-actions"><Link className="button primary" href="/documents/living-practice">Читати план <ArrowRight size={16}/></Link><Link className="button secondary" href="/issues/25">Запропонувати спільноту</Link></div></div></section>
    <SectionHeading title="Що потрібно зробити зараз"/>
    <SourceNotice data={data}/>
    <ItemList items={data.issues.filter(i=>[25,26,27,28].includes(i.number)).sort((a,b)=>a.number-b.number)}/>
    <section className="spaced-section"><SectionHeading title="Матеріали для практичної роботи"/><DocLinks slugs={["pilot-selection","pilot-card","pilot-evaluation"]}/></section>
    <section className="spaced-section"><SectionHeading title="Статус запропонованої програми"/><ItemList items={data.solutions.filter(i=>i.number===24)}/></section>
  </>;
}

function Join() {
  return <>
    <PageHeading title="Долучитися до UAGP" description="Почніть із конкретної справи. Читання і пошук відкриті для всіх; участь добровільна, AI необов'язковий."/>
    <div className="join-layout">
      <div>
        <ProposalDraft/>
      </div>
      <aside>
        <section className="panel"><h2>Інші способи допомогти</h2>
          <Link className="action-row" href="/issues"><CircleDot size={19}/><span><strong>Знайти наявне питання</strong><small>Вибрати завдання та запропонувати допомогу.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/solutions"><GitPullRequest size={19}/><span><strong>Рецензувати рішення</strong><small>Додати аргументоване зауваження.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/charter"><BookOpen size={19}/><span><strong>Переглянути Хартію</strong><small>Запропонувати зміни до принципів.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/issues/25"><Users size={19}/><span><strong>Долучити свою громаду</strong><small>Обговорити майбутній пілот.</small></span><ArrowRight size={16}/></Link>
          <Link className="action-row" href="/issues/29"><Code2 size={19}/><span><strong>Розвивати сам портал</strong><small>Код, дизайн, доступність і тести.</small></span><ArrowRight size={16}/></Link>
        </section>
        <section className="panel quiet-panel"><h2>Що доступно сьогодні</h2><p>Публічний перегляд і локальна підготовка ідеї. Публікація, коментарі й рецензування наразі виконуються в GitHub.</p><p className="small muted">Незалежний кабінет учасника та нативна подача без GitHub потребують окремої реалізації, правил модерації та перевірки приватності.</p><Link className="text-link" href="/documents/start">Інструкція для громадянина <ArrowRight size={15}/></Link></section>
      </aside>
    </div>
  </>;
}

export default async function Page({params,searchParams}:{params:Promise<{segments?:string[]}>;searchParams:Promise<{q?:string|string[]}>}) {
  const [{segments=[]},query]=await Promise.all([params,searchParams]);
  const [section,id,...rest]=segments;
  if(rest.length) notFound();
  if(!section) {
    const data=await getCatalog();
    return <Shell active="/" title="Огляд"><WorkspaceHome data={data}/></Shell>;
  }
  if(section==="issues"||section==="solutions") {
    const kind:Kind=section==="issues"?"issue":"pr";
    const title=kind==="issue"?"Відкриті питання":"Запропоновані зміни";
    if(id!==undefined&&(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))) notFound();
    const data=await getCatalog();
    const items=kind==="issue"?data.issues:data.solutions;
    if(id!==undefined) {
      const item=items.find(x=>x.number===Number(id));
      if(!item) notFound();
      return <Shell active={"/"+section} title={title+" / #"+item.number}><ItemDetail item={item} data={data}/></Shell>;
    }
    return <Shell active={"/"+section} title={title}>
      <PageHeading title={title} description={kind==="issue"?"Питання, завдання і громадянські пропозиції з відкритого репозиторію UAGP.":"Pull Requests – запропоновані зміни до текстів, правил і коду; вони можуть бути чернетками, злитими або закритими без злиття."}>
        {kind==="issue"?<Link className="button primary" href="/join#proposal"><Plus size={16}/> Нова пропозиція</Link>:<a className="button secondary" href={REPO+"/pulls"}>Усі PR у GitHub <ArrowUpRight size={16}/></a>}
      </PageHeading>
      <SourceNotice data={data}/>
      <Catalog key={kind+(typeof query.q==="string"?query.q:"")} items={items} kind={kind} initialQuery={typeof query.q==="string"?query.q.slice(0,300):""}/>
    </Shell>;
  }
  if(section==="documents") {
    if(id) {
      if(!hasDocument(id)) notFound();
      const doc=await getDocument(id);
      if(!doc) notFound();
      return <Shell active={id==="charter"?"/charter":"/documents"} title={doc.title}>
        <Link className="back-link" href={id==="charter"?"/charter":"/documents"}><ChevronLeft size={16}/> До документів</Link>
        <PageHeading title={doc.title}><a className="button secondary" href={documentUrl(doc)}>Оригінал у GitHub <ArrowUpRight size={16}/></a></PageHeading>
        <div className="source-notice" role="status"><FileText size={16}/><span>{doc.stage==="draft"?"Робоча гілка · не прирівнюється до прийнятого тексту":"Основна гілка репозиторію"} · {doc.source==="snapshot"?"Збережений знімок":"Отримано з GitHub"} <time dateTime={doc.capturedAt}>{formatDate(doc.capturedAt,true)}</time></span></div>
        <article className="reading-document"><PublicMarkdown text={doc.content} context={{ref:doc.ref,path:doc.path}}/></article>
      </Shell>;
    }
    return <Shell active="/documents" title="Документи"><PageHeading title="Документи" description="Хартія, правила, технічні документи й проєкти змін, що зберігаються у відкритому репозиторії."/><SectionHeading title="Основна гілка"/><DocLinks slugs={documents.slice(0,11).map(d=>d[0])}/><section className="spaced-section"><SectionHeading title="Матеріали в робочих гілках" description="Не прирівнюються до ухвалених редакцій."/><DocLinks slugs={documents.slice(11).map(d=>d[0])}/></section></Shell>;
  }
  if(id) notFound();
  if(section==="join") return <Shell active="/join" title="Долучитися"><Join/></Shell>;
  if(section==="charter"||section==="community"||section==="strategy") {
    const data=await getCatalog();
    const title=section==="charter"?"Хартія":section==="community"?"Спільнота":"Стратегія";
    return <Shell active={"/"+section} title={title}>{section==="charter"?<Charter data={data}/>:section==="community"?<Community data={data}/>:<Strategy data={data}/>}</Shell>;
  }
  notFound();
}
