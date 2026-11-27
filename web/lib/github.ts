import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import snapshotFile from "@/data/catalog.json";
import { normalizeItem, type CatalogData, type CatalogResult } from "./model";

const api = "https://api.github.com/repos/ailubes/uagp";
const snapshot = snapshotFile as CatalogData;
const PAGE_SIZE = 100;
const PAGE_LIMIT = 20;

/** Only fixed GitHub endpoints; optional server-only read token. */
export function githubHeaders(accept = "application/vnd.github+json"): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "UAGP-public-workspace",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  return headers;
}

async function allPages(endpoint: "issues" | "pulls"): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const url = api + "/" + endpoint + "?state=all&per_page=" + PAGE_SIZE + "&page=" + page;
    const response = await fetch(url, {
      headers: githubHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("GitHub catalogue unavailable: " + response.status);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected GitHub response");
    items.push(...data);
    if (data.length < PAGE_SIZE) return items;
  }
  throw new Error("Catalogue pagination limit reached; refusing partial results");
}

const fetchCatalogue = unstable_cache(async (): Promise<CatalogData> => {
  const [rawIssues, rawPulls] = await Promise.all([allPages("issues"), allPages("pulls")]);
  const issues = rawIssues.map(i => normalizeItem(i, "issue")).filter(i => i !== null);
  const solutions = rawPulls.map(i => normalizeItem(i, "pr")).filter(i => i !== null);
  // GitHub's Issues endpoint also returns PRs. Invalid real records must not silently disappear.
  const expectedIssues = rawIssues.filter(i => i !== null && typeof i === "object" && !("pull_request" in i)).length;
  if (issues.length !== expectedIssues || solutions.length !== rawPulls.length) {
    throw new Error("Catalogue contains unsupported records");
  }
  if (new Set([...issues, ...solutions].map(i => i.number)).size !== issues.length + solutions.length) {
    throw new Error("Duplicate GitHub record");
  }
  return { capturedAt: new Date().toISOString(), issues, solutions };
}, ["uagp-catalogue-v1"], { revalidate: 300 });

export const getCatalog = cache(async (): Promise<CatalogResult> => {
  if (process.env.UAGP_DATA_MODE === "snapshot") return { ...snapshot, source: "snapshot", reason: "preview" };
  try {
    return { ...await fetchCatalogue(), source: "github" };
  } catch {
    return { ...snapshot, source: "snapshot", reason: "offline" };
  }
});
