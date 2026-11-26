import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeItem, filterItems, categoryFor, referencedItems, githubItemUrl } from "../lib/model.ts";

const snapshot = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const defaults = {query:"",status:"all",category:"all",assignment:"all",sort:"updated"};

test("GitHub issue list never counts a pull request as an issue", () => {
  assert.equal(normalizeItem({number:7,title:"PR",state:"open",pull_request:{}}, "issue"), null);
  assert.equal(normalizeItem({number:-1,title:"bad",state:"open"}, "issue"), null);
});
test("draft, review, merged into target, closed are distinct", () => {
  const base = {number:2,title:"Change",state:"open"};
  assert.equal(normalizeItem({...base,draft:true},"pr").status,"draft");
  assert.equal(normalizeItem({...base,draft:false},"pr").status,"review");
  assert.equal(normalizeItem({...base,state:"closed",merged_at:"2026-11-01T00:00:00Z"},"pr").status,"merged");
  assert.equal(normalizeItem({...base,state:"closed",merged_at:null},"pr").status,"closed");
});
test("snapshot has unique issue and PR numbers and real known entries", () => {
  const combined = [...snapshot.issues,...snapshot.solutions];
  assert.equal(new Set(combined.map(x=>x.number)).size,combined.length);
  assert.ok(snapshot.issues.some(x=>x.number===22&&x.status==="open"));
  assert.ok(snapshot.solutions.some(x=>x.number===23&&x.status==="draft"));
  assert.ok(snapshot.issues.some(x=>x.number===29));
});
test("search by exact number and title in Ukrainian, combine filters", () => {
  assert.deepEqual(filterItems(snapshot.issues,{...defaults,query:"#22"}).map(x=>x.number),[22]);
  assert.ok(filterItems(snapshot.issues,{...defaults,query:"громадянськ"}).length>0);
  assert.equal(filterItems(snapshot.issues,{...defaults,query:"nonexistent-phrase-abc"}).length,0);
  assert.ok(filterItems(snapshot.solutions,{...defaults,status:"draft"}).every(x=>x.status==="draft"));
  assert.equal(categoryFor(snapshot.issues.find(x=>x.number===25)),"Практичний пілот");
});
test("missing assignee metadata is not the same as unassigned", () => {
  const unknown = normalizeItem({number:1,title:"a",state:"open"},"issue");
  const empty = normalizeItem({number:2,title:"b",state:"open",assignees:[]},"issue");
  assert.equal(unknown.assignees,null);
  assert.deepEqual(filterItems([unknown,empty],{...defaults,assignment:"unassigned"}).map(x=>x.number),[2]);
});
test("references are explicit mentions, URLs built from fixed repository", () => {
  const i = snapshot.issues.find(x=>x.number===22);
  const derived = {...i,body:"See #23 and https://github.com/ailubes/uagp/issues/29 and #22."};
  assert.deepEqual(referencedItems(derived,[...snapshot.issues,...snapshot.solutions]).map(x=>x.number).sort(),[23,29]);
  assert.equal(githubItemUrl(i),"https://github.com/ailubes/uagp/issues/22");
});
