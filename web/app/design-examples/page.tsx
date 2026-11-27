import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { basePath, concepts } from "./concepts";

export default function Gallery() {
  return <main className="gallery">
    <header className="gallery-header"><strong>UAGP</strong><Link href="/">Поточний сайт <ArrowUpRight size={16}/></Link></header>
    <div className="gallery-title"><h1>Три версії UAGP</h1><p>Відкрийте варіант і спробуйте знайти питання, до якого хотіли б долучитися.</p></div>
    <div className="gallery-options">{concepts.map(concept =>
      <Link className="gallery-choice" key={concept.slug} href={basePath + "/" + concept.slug}>
        <div className={"gallery-image " + concept.slug}><Image src={basePath + "/screen-" + concept.slug + ".webp"} width={1200} height={840} sizes="(max-width: 720px) 100vw, 33vw" alt=""/></div>
        <div className="choice-title"><h2>{concept.title}</h2><ArrowUpRight size={23}/></div><p>{concept.description}</p>
      </Link>)}</div>
  </main>;
}
