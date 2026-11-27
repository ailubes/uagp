import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Catalog } from "@/components/catalog";
import type { CatalogResult } from "@/lib/model";
import { AtlasFrame, Source } from "./public-layout";

export function Register({ data, initialQuery = "" }: { data: CatalogResult; initialQuery?: string }) {
  return (
    <AtlasFrame active="/issues">
      <header className="register-masthead">
        <div>
          <h1>Робочий <em>реєстр</em></h1>
          <Source data={data}/>
        </div>
        <Image className="register-plate" src="/illustrations/civic-atlas.webp" width={220} height={147} alt=""/>
      </header>
      <div className="register-catalog">
        <Catalog key={initialQuery} items={data.issues} kind="issue" initialQuery={initialQuery}
          action={<Link className="ink-button" href="/join#proposal"><Plus size={16}/> Нова пропозиція</Link>}/>
      </div>
    </AtlasFrame>
  );
}
