import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight, BookOpen, CircleDot, Compass, FolderOpen, GitPullRequest, Menu, Users
} from "lucide-react";
import { categoryFor, formatDate, itemPath, REPO, statusText, type CatalogResult, type Item } from "@/lib/model";
import "./civic.css";

const sections = [
  { href: "/issues", title: "Питання", icon: CircleDot },
  { href: "/solutions", title: "Запропоновані зміни", icon: GitPullRequest },
  { href: "/charter", title: "Хартія", icon: BookOpen },
  { href: "/community", title: "Спільнота", icon: Users },
  { href: "/strategy", title: "Стратегія", icon: Compass },
  { href: "/documents", title: "Документи", icon: FolderOpen }
];

function CivicSurface({ children }: { children: ReactNode }) {
  return (
    <div className="civic-surface">
      <a className="skip-link" href="#main">Перейти до змісту</a>
      {children}
    </div>
  );
}

export function Source({ data }: { data: CatalogResult }) {
  const cached = data.source === "snapshot";
  return (
    <p className={cached ? "civic-source cached" : "civic-source"} role="status">
      <span className="source-dot" aria-hidden="true"/>
      {cached ? "Збережений знімок даних · статуси можуть бути застарілими" : "Дані з GitHub"}
      <span aria-hidden="true">·</span>
      <time dateTime={data.capturedAt}>{formatDate(data.capturedAt, true)}</time>
      <a href={REPO}>Першоджерело <ArrowUpRight size={12}/></a>
    </p>
  );
}

function SectionMenu({ active }: { active?: string }) {
  return (
    <details className="civic-menu">
      <summary aria-label="Усі розділи"><Menu size={20}/></summary>
      <nav aria-label="Усі розділи">
        <Link href="/" aria-current={active === "/" ? "page" : undefined}>Атлас участі</Link>
        {sections.map(s => <Link key={s.href} href={s.href} aria-current={active === s.href ? "page" : undefined}>{s.title}</Link>)}
        <Link href="/join" aria-current={active === "/join" ? "page" : undefined}>Долучитися</Link>
      </nav>
    </details>
  );
}

export function SiteNav({ active }: { active?: string }) {
  return (
    <header className="civic-header">
      <Link href="/" className="wordmark" aria-label="UAGP — Атлас участі">UAGP</Link>
      <span className="wordmark-name">Протокол алгоритмічного<br/>врядування України</span>
      <nav className="wide-nav" aria-label="Основні розділи">
        <Link href="/issues" aria-current={active === "/issues" ? "page" : undefined}>Питання</Link><Link href="/charter" aria-current={active === "/charter" ? "page" : undefined}>Хартія</Link><Link href="/community" aria-current={active === "/community" ? "page" : undefined}>Спільнота</Link>
      </nav>
      <Link className="join-action" href="/join" aria-current={active === "/join" ? "page" : undefined}>Долучитися <ArrowUpRight size={16}/></Link>
      <SectionMenu active={active}/>
    </header>
  );
}

export function Entries({ items }: { items: Item[] }) {
  if (!items.length) return <p className="no-entries">Поки немає записів.</p>;
  return (
    <ol className="entries">
      {items.map(item => (
        <li key={item.number}>
          <Link href={itemPath(item)}>
            <span className="entry-id">#{item.number}</span>
            <span className="entry-main">
              <strong>{item.title}</strong>
              <small>{categoryFor(item)} <span aria-hidden="true">·</span> {statusText[item.status]}</small>
            </span>
            <ArrowUpRight size={18}/>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function FootLinks() {
  return (
    <footer className="civic-footer">
      <div className="footer-links">
        <strong>UAGP</strong>
        <nav aria-label="Додаткові посилання">
          {sections.map(s => <Link key={s.href} href={s.href}>{s.title}</Link>)}
        </nav>
      </div>
      <div className="footer-note">
        <span>Протокол алгоритмічного врядування України (UAGP). Не є державним сервісом, виборами чи офіційним каналом звернень.</span>
        <Link href="/documents/faq">Як це працює</Link>
        <Link href="/documents/security">Безпека та приватність</Link>
        <a href={REPO}>GitHub <ArrowUpRight size={12}/></a>
      </div>
    </footer>
  );
}

export function AtlasFrame({ active, children }: { active?: string; children: ReactNode }) {
  return (
    <CivicSurface>
      <div className="atlas-page">
        <div className="print-width">
          <SiteNav active={active}/>
          <main id="main" tabIndex={-1}>{children}</main>
          <FootLinks/>
        </div>
      </div>
    </CivicSurface>
  );
}

export function AtlasSection({ active, children }: { active?: string; children: ReactNode }) {
  return (
    <AtlasFrame active={active}>
      <div className="atlas-section">{children}</div>
    </AtlasFrame>
  );
}
