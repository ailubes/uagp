"use client";
import { AtlasSection } from "@/components/civic/public-layout";
import Link from "next/link";
export default function ErrorBoundary({reset}:{error:Error&{digest?:string};reset:()=>void}) {
  return <AtlasSection><div className="page-heading"><div><h1>Не вдалося відкрити сторінку</h1><p className="lede">Спробуйте оновити сторінку або поверніться до каталогу. Першоджерело доступне в GitHub.</p></div></div><div className="inline-actions"><button className="button primary" onClick={reset}>Спробувати ще раз</button><Link className="button secondary" href="/">На головну</Link><a className="button secondary" href="https://github.com/ailubes/uagp">GitHub</a></div></AtlasSection>;
}
