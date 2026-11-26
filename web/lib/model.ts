export type Kind = "issue" | "pr";
export type Status = "open" | "closed" | "draft" | "review" | "merged";

export interface Item {
  kind: Kind;
  number: number;
  title: string;
  body: string;
  status: Status;
  createdAt: string | null;
  updatedAt: string | null;
  labels: string[];
  assignees: string[] | null;
  comments: number | null;
  base: string | null;
  head: string | null;
}

export interface CatalogData {
  capturedAt: string;
  issues: Item[];
  solutions: Item[];
}

export interface CatalogResult extends CatalogData {
  source: "github" | "snapshot";
  reason?: "offline" | "preview";
}

export const REPO = "https://github.com/ailubes/uagp";
export const statusText: Record<Status, string> = {
  open: "Відкрито",
  closed: "Закрито",
  draft: "Чернетка",
  review: "Відкрито до розгляду",
  merged: "Злито в цільову гілку",
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const date = (value: unknown): string | null =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;

function names(value: unknown, field: "name" | "login"): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => str(record(v)[field])).filter((v): v is string => v !== null);
}

/** Normalize only public fields from the fixed repository. Never forward tokens or raw user objects. */
export function normalizeItem(input: unknown, kind: Kind): Item | null {
  const x = record(input);
  if (kind === "issue" && x.pull_request) return null;
  if (typeof x.number !== "number" || !Number.isSafeInteger(x.number) ||
      x.number < 1 || typeof x.title !== "string" ||
      (x.state !== "open" && x.state !== "closed")) return null;
  const status: Status = kind === "issue" ? x.state :
    x.merged_at ? "merged" : x.state === "closed" ? "closed" :
    x.draft === true ? "draft" : "review";
  return {
    kind,
    number: x.number,
    title: x.title,
    body: str(x.body) ?? "",
    status,
    createdAt: date(x.created_at),
    updatedAt: date(x.updated_at),
    labels: names(x.labels, "name"),
    assignees: Array.isArray(x.assignees) ? names(x.assignees, "login") : null,
    comments: typeof x.comments === "number" && Number.isInteger(x.comments) && x.comments >= 0 ? x.comments : null,
    base: kind === "pr" ? str(record(x.base).ref) : null,
    head: kind === "pr" ? str(record(x.head).ref) : null,
  };
}

export function githubItemUrl(item: Pick<Item, "kind" | "number">): string {
  return REPO + "/" + (item.kind === "issue" ? "issues/" : "pull/") + item.number;
}

export function itemPath(item: Pick<Item, "kind" | "number">): string {
  return (item.kind === "issue" ? "/issues/" : "/solutions/") + item.number;
}

/** Editorial navigation only; not GitHub labels or project-assigned roles. */
export const categories = [
  "Громадянська участь", "Практичний пілот", "Право та Хартія",
  "Технології", "Інші питання",
] as const;
export type Category = typeof categories[number];

export function categoryFor(item: Pick<Item, "kind" | "number" | "title">): Category {
  if (item.kind === "issue") {
    if ([25, 26, 27, 28].includes(item.number)) return "Практичний пілот";
    if ([13, 15, 18, 19, 20, 22].includes(item.number)) return "Громадянська участь";
    if ([1, 6, 12, 16, 17].includes(item.number)) return "Право та Хартія";
    if ([2, 3, 4, 5, 14, 29].includes(item.number)) return "Технології";
  } else {
    if (item.number === 24) return "Практичний пілот";
    if ([21, 23].includes(item.number)) return "Право та Хартія";
    if (item.number === 11) return "Громадянська участь";
    if ([7, 8, 9, 10].includes(item.number)) return "Технології";
  }
  if (/living practice|sg-\d+|пілот/i.test(item.title)) return "Практичний пілот";
  if (/харті|charter|правов|legal/i.test(item.title)) return "Право та Хартія";
  if (/participation|громадянськ|community|спільнот/i.test(item.title)) return "Громадянська участь";
  if (/web-\d+|feat:|api|oidc|mcp|schema|протокол/i.test(item.title)) return "Технології";
  return "Інші питання";
}

export interface Filters {
  query: string;
  status: Status | "all";
  category: Category | "all";
  assignment: "all" | "assigned" | "unassigned";
  sort: "updated" | "number";
}

const folded = (s: string) => s.normalize("NFKC").toLocaleLowerCase("uk").replace(/[’‘ʼ]/g, "'");

export function filterItems(items: readonly Item[], filters: Filters): Item[] {
  const q = folded(filters.query.trim());
  const numberQuery = /^#?(\d+)$/.exec(q);
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    const category = categoryFor(item);
    if (filters.category !== "all" && category !== filters.category) return false;
    if (filters.assignment === "assigned" && !item.assignees?.length) return false;
    if (filters.assignment === "unassigned" && item.assignees?.length !== 0) return false;
    if (numberQuery) return Number(numberQuery[1]) === item.number;
    if (!tokens.length) return true;
    const text = folded([item.title, item.body, category, ...item.labels, "#" + item.number].join(" "));
    return tokens.every(token => text.includes(token));
  }).sort((a, b) => filters.sort === "number" ? b.number - a.number :
    (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0) || b.number - a.number);
}

/** These are textual mentions, not verified dependency or approval edges. */
export function referencedItems(item: Item, items: readonly Item[]): Item[] {
  const refs = new Set<number>();
  for (const match of item.body.matchAll(/(?:^|[\s(])#(\d+)\b/g)) refs.add(Number(match[1]));
  for (const match of item.body.matchAll(/https:\/\/github\.com\/ailubes\/uagp\/(?:issues|pull)\/(\d+)\b/g)) refs.add(Number(match[1]));
  refs.delete(item.number);
  return items.filter(other => refs.has(other.number));
}

export function latest(items: readonly Item[], limit: number): Item[] {
  return [...items].sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) -
    (Date.parse(a.updatedAt ?? "") || 0) || b.number - a.number).slice(0, limit);
}

export function formatDate(value: string | null, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Немає даних";
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}),
  }).format(new Date(value));
}
