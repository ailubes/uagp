import { authenticate, authorCard, createCard, field, listCards, QueueError, reviewerCard, transition } from "@/lib/review-store";
import type { Card, Phase } from "@/lib/review-types";

export const runtime = "nodejs";
const response = (value: unknown, status = 200) => Response.json(value, {status, headers: {"Cache-Control":"private, no-store"}});
function requireState(card: Card, expected: Phase) {
  if (card.state !== expected) throw new QueueError("Дія недоступна в поточному стані.",409);
}
function consent(value: unknown) {
  if (value !== true) throw new QueueError("Підтвердьте саме цю версію картки.");
}
const issues = "https://api.github.com/repos/ailubes/uagp/issues";
async function publish(card: Card, number?: number) {
  const reconcile = number !== undefined;
  requireState(card,reconcile ? "publishing" : "ready");
  const token = process.env.UAGP_QUEUE_GITHUB_TOKEN;
  if (!token) throw new QueueError("Для публікації потрібен серверний ключ GitHub. Картка збережена.",503);
  const body = card.body + "\n\n<!-- uagp-review:" + card.id + " -->";
  const current = reconcile ? card : transition(card,"publishing","Рецензент розпочав публікацію погодженої версії.");
  let result: Response;
  try {
    result = await fetch(reconcile ? issues + "/" + number : issues, {
      method: reconcile ? "GET" : "POST", headers: {Authorization:"Bearer "+token,Accept:"application/vnd.github+json","Content-Type":"application/json","User-Agent":"UAGP-review"},
      cache:"no-store", redirect:"error", signal:AbortSignal.timeout(12000),
      body: reconcile ? undefined : JSON.stringify({title:card.title,body}),
    });
  } catch { throw new QueueError("Відповідь GitHub не отримано. Оновіть картку та звірте запис.",502); }
  if (!result.ok) {
    if (!reconcile && [401,403,404,422,429].includes(result.status)) transition(current,"ready","GitHub відхилив запит. Картка очікує публікації.");
    throw new QueueError("GitHub не підтвердив публікацію. Оновіть стан картки.",502);
  }
  const issue = await result.json();
  if (issue.pull_request || !Number.isSafeInteger(issue.number) || issue.number < 1 ||
      issue.title !== card.title || issue.body !== body || (reconcile && issue.number !== number))
    throw new QueueError("Запис GitHub не відповідає погодженій картці.",409);
  return transition(current,"published","Погоджену картку опубліковано.",{issue:issue.number});
}
async function requestData(req: Request) {
  // Bound chunked requests as well as requests with a Content-Length.
  const reader = req.body?.getReader();
  if (!reader) throw new QueueError("Потрібні дані картки.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const {value,done} = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 100000) { await reader.cancel(); throw new QueueError("Картка надто велика.",413); }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data as Record<string,unknown>;
  } catch { throw new QueueError("Неправильний формат картки."); }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json") throw new QueueError("Потрібен JSON.",415);
    const data = await requestData(req);
    const key = req.headers.get("authorization")?.replace(/^Bearer /,"") || "";
    const action = data.action;
    if (action === "create") {
      consent(data.consent);
      return response(createCard(key,field(data.title,140),field(data.body,12000)));
    }
    const author = ["track","revise","consent"].includes(String(action));
    if (!author) authenticate(key);
    if (action === "list") {
      const offset = Number(data.offset || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new QueueError("Невірна сторінка.");
      return response(listCards(offset));
    }
    const card = author ? authorCard(key) : reviewerCard(field(data.id,50));
    if (action === "track" || action === "read") return response(card);
    if (data.version !== card.version) throw new QueueError("Картку оновлено. Перечитайте поточну версію.",409);
    if (action === "revise") {
      requireState(card,"clarify"); consent(data.consent);
      return response(transition(card,"received","Автор передав уточнену версію.",{title:field(data.title,140),body:field(data.body,12000)}));
    }
    if (action === "consent") {
      requireState(card,"approved"); consent(data.consent);
      return response(transition(card,"ready","Автор дозволив публікацію цього заголовка й тексту."));
    }
    if (action === "approve" || action === "clarify" || action === "decline") {
      requireState(card,"received");
      const state = action === "approve" ? "approved" : action === "decline" ? "declined" : "clarify";
      return response(transition(card,state,field(data.note,2000)));
    }
    if (action === "publish") return response(await publish(card));
    if (action === "reconcile") {
      const number = Number(data.number);
      if (!Number.isSafeInteger(number) || number < 1) throw new QueueError("Потрібен номер Issue.");
      return response(await publish(card,number));
    }
    throw new QueueError("Невідома дія.");
  } catch (err) {
    return err instanceof QueueError ? response({error:err.message},err.status) : response({error:"Черга тимчасово недоступна. Збережіть картку та повторіть спробу."},503);
  }
}
