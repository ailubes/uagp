import "server-only";
import { unstable_cache } from "next/cache";
import archive from "@/data/documents.json";
import { githubHeaders } from "./github";
import { REPO } from "./model";

type StoredDocument = {
  title: string;
  path: string;
  ref: string;
  stage: "main" | "draft";
  sha: string;
  content: string;
  capturedAt?: string;
};
export interface DocumentInfo extends StoredDocument {
  source: "github" | "snapshot";
  capturedAt: string;
}

const docs = archive.documents as Record<string, StoredDocument>;

export function hasDocument(slug: string): boolean {
  return Object.hasOwn(docs, slug);
}

export function documentUrl(doc: Pick<StoredDocument, "ref" | "path">): string {
  return REPO + "/blob/" + doc.ref + "/" + doc.path;
}

export function docTitle(slug: string): string {
  return hasDocument(slug) ? docs[slug].title : "";
}

const loadRemote = unstable_cache(async (slug: string) => {
  if (!hasDocument(slug)) throw new Error("Document not allowed");
  const doc = docs[slug];
  const path = doc.path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("https://api.github.com/repos/ailubes/uagp/contents/" + path +
      "?ref=" + encodeURIComponent(doc.ref), {
    headers: githubHeaders("application/vnd.github.raw+json"),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Document unavailable");
  const content = await response.text();
  if (!content.trim() || content.length > 1_000_000) throw new Error("Unexpected document size");
  return { content, capturedAt: new Date().toISOString() };
}, ["uagp-documents-v1"], { revalidate: 600 });

export async function getDocument(slug: string): Promise<DocumentInfo | null> {
  if (!hasDocument(slug)) return null;
  const doc = docs[slug];
  if (process.env.UAGP_DATA_MODE !== "snapshot") {
    try {
      const remote = await loadRemote(slug);
      // The original snapshot blob SHA is not claimed to be the current GitHub blob.
      return { ...doc, ...remote, source: "github" };
    } catch { /* dated, explicit read-only fallback */ }
  }
  return { ...doc, source: "snapshot", capturedAt: doc.capturedAt ?? archive.capturedAt };
}
