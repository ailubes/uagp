import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, LayoutGrid } from "lucide-react";
import { Atlas } from "@/components/civic/atlas";
import { Register } from "@/components/civic/register";
import { Entries, FootLinks, SiteNav, Source } from "@/components/civic/public-layout";
import { getCatalog } from "@/lib/github";
import { formatDate, itemPath, latest, type CatalogResult } from "@/lib/model";
import { basePath, concepts, type Concept } from "../concepts";

function Switcher({ current }: { current: Concept }) {
  return <nav className="switcher" aria-label="Варіанти дизайну">
    <Link className="switcher-index" href={basePath}><LayoutGrid size={15}/> <span>Усі варіанти</span></Link>
    <div>{concepts.map(c => <Link href={basePath + "/" + c.slug} key={c.slug} aria-current={current === c.slug ? "page" : undefined}>{c.short}</Link>)}</div>
  </nav>;
}

function Journal({ data }: { data: CatalogResult }) {
  const open = data.issues.filter(i => i.status === "open");
  const lead = open.find(i => i.number === 25) ?? latest(open, 1)[0];
  const pilotLead = lead?.number === 25;
  return <div className="journal-page"><div className="print-width"><SiteNav/>
    <main id="main" tabIndex={-1}><header className="nameplate"><h1>Спільна справа</h1><div><span>Журнал відкритої роботи UAGP</span><time dateTime={data.capturedAt}>Дані за {formatDate(data.capturedAt)}</time></div></header>
      <div className="journal-lead"><article>{lead ? <>
        <Link className="journal-ref" href={itemPath(lead)}>Питання #{lead.number} <ArrowUpRight size={14}/></Link>
        <h2><Link href={itemPath(lead)}>{pilotLead ? "Які спільноти долучаться до першого пілота?" : lead.title}</Link></h2>
        {pilotLead && <p>UAGP шукає дві або три спільноти, які хотіли б випробувати процедуру участі на власному питанні. Команда ще узгоджує партнерства й умови.</p>}
        <Link className="journal-more" href={itemPath(lead)}>Читати питання <ArrowRight size={17}/></Link>
      </> : <h2>Відкритих питань поки немає</h2>}</article>
      <Link className="pilot-poster" href="/documents/living-practice"><span>Living Practice</span><strong>90</strong><em>днів</em><small>Робочий план пілота <ArrowUpRight size={17}/></small></Link></div>
      <div className="journal-columns"><section><div className="section-line"><h2>Порядок денний</h2><Link href="/issues">Усі питання <ArrowRight size={15}/></Link></div><Entries items={latest(open.filter(i => i.number !== lead?.number), 4)}/></section>
      <section><div className="section-line"><h2>На обговоренні</h2></div><Entries items={latest(data.solutions.filter(i => i.status === "draft" || i.status === "review"), 3)}/></section></div><Source data={data}/>
    </main><FootLinks/></div></div>;
}

export default async function Example({ params }: { params: Promise<{concept: string}> }) {
  const { concept } = await params;
  const current = concepts.find(c => c.slug === concept);
  if (!current) notFound();
  const data = await getCatalog();
  return <>{current.slug === "journal" && <a className="skip-link" href="#main">Перейти до змісту</a>}<Switcher current={current.slug}/>
    {current.slug === "atlas" ? <Atlas data={data}/> : current.slug === "journal" ? <Journal data={data}/> : <Register data={data}/>}</>;
}
