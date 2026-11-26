import Markdown from "react-markdown";
import { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { REPO } from "@/lib/model";

type Context = {ref?:string;path?:string};

/** Markdown from public sources is data, not trusted HTML. Suppress remote images and unsafe URLs. */
export function PublicMarkdown({text,context}: {text:string;context?:Context}) {
  function transform(href:string):string {
    const safe=defaultUrlTransform(href);
    if(!safe) return "";
    if(safe.startsWith("#")||/^https?:\/\//i.test(safe)) return safe;
    if(safe.startsWith("//")||/^[a-z][a-z0-9+.-]*:/i.test(safe)) return "";
    if(context?.path&&context.ref) {
      try {
        const relative=new URL(safe,"https://repository.invalid/"+context.path);
        if(relative.origin!=="https://repository.invalid") return "";
        return REPO+"/blob/"+context.ref+relative.pathname+relative.hash;
      } catch { return ""; }
    }
    return "";
  }
  return <div className="markdown"><Markdown skipHtml remarkPlugins={[remarkGfm]} urlTransform={transform}
      components={{
        a:({href,children})=>href?<a href={href} rel="noopener noreferrer">{children}</a>:<span>{children}</span>,
        img:()=> <span className="image-placeholder">[Зображення доступне у першоджерелі]</span>,
        table:({children})=><div className="markdown-table"><table>{children}</table></div>,
      }}>{text}</Markdown></div>;
}
