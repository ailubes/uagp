"use client";
import Link from "next/link";
export default function ErrorBoundary({reset}:{error:Error&{digest?:string};reset:()=>void}) {
  return <main className="loading-shell"><h1>Не вдалося відкрити сторінку</h1><p>Спробуйте оновити сторінку або поверніться до каталогу. Першоджерело доступне в GitHub.</p><div className="inline-actions"><button className="button primary" onClick={reset}>Спробувати ще раз</button><Link className="button secondary" href="/">На головну</Link><a className="button secondary" href="https://github.com/ailubes/uagp">GitHub</a></div></main>;
}
