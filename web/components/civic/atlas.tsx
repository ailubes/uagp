import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import { latest, type CatalogResult } from "@/lib/model";
import { SearchBox } from "@/components/workspace";
import { AtlasFrame, Entries, Source } from "./public-layout";

export function Atlas({ data }: { data: CatalogResult }) {
  const open = data.issues.filter(item => item.status === "open");
  const proposed = data.solutions.filter(item => item.status === "draft" || item.status === "review");

  return (
    <AtlasFrame active="/">
      <section className="atlas-spread">
        <div className="atlas-copy">
          <h1>Атлас <em>участі</em></h1>
          <p>Знайдіть питання, важливе для вашої громади. Подивіться, що вже запропоновано і де потрібна допомога.</p>
          <div className="atlas-actions">
            <a className="ink-button" href="#open-questions">До відкритих питань <ArrowDown size={16}/></a>
            <Link href="/documents/start">З чого почати <ArrowUpRight size={15}/></Link>
          </div>
        </div>
        <figure className="atlas-plate">
          <Image src="/illustrations/civic-atlas.webp" width={1200} height={800}
            sizes="(max-width: 490px) 95vw, (max-width: 1272px) 50vw, 625px"
            alt="Ілюстрація міської площі з громадською будівлею, житловими кварталами й деревами." preload/>
        </figure>
      </section>
      <div className="atlas-index">
        <div>
          <section id="open-questions" aria-labelledby="open-heading">
            <div className="section-line">
              <h2 id="open-heading">Відкриті питання</h2>
              <Link href="/issues">Усі питання ({data.issues.length}) <ArrowRight size={15}/></Link>
            </div>
            <Entries items={latest(open, 5)}/>
            <Source data={data}/>
            <SearchBox/>
          </section>
          <section className="atlas-changes" aria-labelledby="changes-heading">
            <div className="section-line">
              <h2 id="changes-heading">Запропоновані зміни</h2>
              <Link href="/solutions">Усі зміни <ArrowRight size={15}/></Link>
            </div>
            <Entries items={latest(proposed, 3)}/>
          </section>
        </div>
        <aside className="reading-index">
          <h2>Бібліотека</h2>
          <Link className="charter-cover" href="/charter">
            <BookOpen size={31} strokeWidth={1.15}/>
            <strong>Хартія<br/><em>UAGP</em></strong>
            <span>Читати документ <ArrowRight size={16}/></span>
          </Link>
          <Link className="quiet-resource" href="/solutions">Запропоновані зміни <ArrowRight size={15}/></Link>
          <Link className="quiet-resource" href="/strategy">Living Practice 90 <ArrowRight size={15}/></Link>
        </aside>
      </div>
    </AtlasFrame>
  );
}
