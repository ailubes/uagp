import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Card, Phase } from "./review-types";

export class QueueError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function directory() {
  const configured = process.env.UAGP_QUEUE_DIR;
  if (!configured && process.env.NODE_ENV === "production") throw new QueueError("Сховище черги ще не налаштовано.", 503);
  const dir = configured || join(process.env.LOCALAPPDATA || homedir(), "uagp-private-review");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
let database: DatabaseSync | undefined;
function db() {
  if (!database) {
    const connection = new DatabaseSync(join(directory(), "cards.sqlite"));
    connection.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, owner TEXT UNIQUE NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL)");
    database = connection;
  }
  return database;
}
const hash = (value: string) => createHash("sha256").update(value).digest();
export function prepareDevelopmentReviewer() {
  if (!process.env.UAGP_REVIEW_KEY && process.env.NODE_ENV === "development") {
    const path = join(directory(), "reviewer.key");
    try { writeFileSync(path, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err; }
    return path;
  }
}
export function authenticate(key: string) {
  const path = prepareDevelopmentReviewer();
  const expected = path ? readFileSync(path, "utf8").trim() : process.env.UAGP_REVIEW_KEY;
  if (!expected || expected.length < 32) throw new QueueError("Доступ рецензента ще не налаштовано.", 503);
  if (!key || !timingSafeEqual(hash(key), hash(expected))) throw new QueueError("Перевірте ключ рецензента.", 403);
}
export function ownerKey(key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new QueueError("Потрібне приватне посилання автора.", 403);
  return hash(key).toString("hex");
}
export function field(value: unknown, limit: number) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new QueueError("Перевірте заповнення та довжину полів.");
  return value.trim();
}
function decode(row: Record<string, unknown> | undefined): Card {
  if (!row) throw new QueueError("Картку не знайдено.", 404);
  return JSON.parse(String(row.data));
}
export function authorCard(key: string) {
  return decode(db().prepare("SELECT data FROM cards WHERE owner=?").get(ownerKey(key)));
}
export function reviewerCard(id: string) {
  return decode(db().prepare("SELECT data FROM cards WHERE id=?").get(id));
}
export function listCards(offset: number) {
  return db().prepare("SELECT data FROM cards ORDER BY rowid DESC LIMIT 25 OFFSET ?").all(offset).map(row => {
    const {id,title,state} = decode(row);
    return {id,title,state};
  });
}
export function createCard(key: string, title: string, body: string) {
  const owner = ownerKey(key);
  const card: Card = {id: randomUUID(), title, body, state: "received", version: 1,
    history: [{state:"received", at:new Date().toISOString(), note:"Картку передано для приватного розгляду."}]};
  const result = db().prepare("INSERT INTO cards VALUES(?,?,?,?) ON CONFLICT(owner) DO NOTHING").run(card.id,owner,1,JSON.stringify(card));
  if (result.changes) return card;
  const existing = authorCard(key);
  if (existing.title !== title || existing.body !== body) throw new QueueError("За цим посиланням уже є інша картка.",409);
  return existing;
}
export function transition(card: Card, state: Phase, note: string, changes: Partial<Pick<Card,"title"|"body"|"issue">> = {}) {
  const next = {...card,...changes,state,version:card.version+1,
    history:[...card.history,{state,at:new Date().toISOString(),note}]};
  const result = db().prepare("UPDATE cards SET data=?,version=? WHERE id=? AND version=?").run(JSON.stringify(next),next.version,card.id,card.version);
  if (!result.changes) throw new QueueError("Стан уже змінився. Оновіть картку.",409);
  return next;
}
