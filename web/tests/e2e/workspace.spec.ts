import { test, expect } from "@playwright/test";

test("overview loads real dated catalogue without login", async ({page},testInfo)=>{
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Робочий простір",exact:true})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"знімок даних"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Відкриті питання",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Запропоновані зміни",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath("overview.png"),fullPage:true});
  expect(errors).toEqual([]);
});

test("search by number, empty state and reset; see issue detail",async({page},testInfo)=>{
  await page.goto("/issues");
  const search=page.getByRole("searchbox",{name:"Пошук за номером, назвою або змістом"});
  await search.fill("#22");
  await expect(page.getByRole("link",{name:/^#22 Participation Steward/})).toBeVisible();
  await expect(page.locator(".item-list .item-row")).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath("issue-search.png"),fullPage:true});
  await search.fill("no-such-public-issue-abc123");
  await expect(page.getByRole("heading",{name:"Нічого не знайдено"})).toBeVisible();
  await page.getByRole("button",{name:"Скинути фільтри"}).click();
  await expect(page.getByRole("link",{name:/^#22 Participation Steward/})).toBeVisible();
  await page.getByRole("link",{name:/^#22 Participation Steward/}).click();
  await expect(page.getByRole("heading",{level:1,name:/Participation Steward/})).toBeVisible();
  await expect(page.getByRole("link",{name:"Відкрити обговорення"})).toHaveAttribute("href","https://github.com/ailubes/uagp/issues/22");
  await expect(page.getByText("Не призначено",{exact:true})).toBeVisible();
});

test("draft changes and merged changes remain distinct",async({page})=>{
  await page.goto("/solutions");
  await page.getByRole("button",{name:/^Чернетки/}).click();
  await expect(page.getByRole("link",{name:/^#23 /})).toBeVisible();
  await expect(page.getByRole("link",{name:/^#11 /})).toHaveCount(0);
  await page.getByRole("link",{name:/^#23 /}).click();
  await expect(page.locator(".document-header .status-mark")).toHaveText("Чернетка");
  await expect(page.getByRole("link",{name:"Переглянути різницю файлів"})).toHaveAttribute("href","https://github.com/ailubes/uagp/pull/23/files");
});

test("local proposal downloads markdown without submitting it",async({page},testInfo)=>{
  await page.goto("/join");
  await page.getByLabel("Назва пропозиції").fill("Тест доступності");
  await page.getByLabel("Що саме не працює?").fill("Знеособлений приклад проблеми.");
  await page.getByLabel("Що має змінитися?").fill("Перевірний результат.");
  const requests:string[]=[];
  page.on("request",req=>{if(!["GET","HEAD","OPTIONS"].includes(req.method()))requests.push(req.url());});
  const downloading=page.waitForEvent("download");
  await page.getByRole("button",{name:"Завантажити чернетку"}).click();
  const download=await downloading;
  expect(download.suggestedFilename()).toBe("uagp-proposal.md");
  await expect(page.getByRole("status")).toContainText("Нічого не надіслано");
  expect(requests).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath("join.png"),fullPage:true});
});

test("charter and strategic plan are readable with source and draft markings",async({page})=>{
  await page.goto("/charter");
  await page.getByRole("link",{name:"Читати текст Хартії"}).click();
  await expect(page.locator(".reading-document")).toBeVisible();
  await expect(page.getByRole("link",{name:"Оригінал у GitHub"})).toHaveAttribute("href","https://github.com/ailubes/uagp/blob/main/docs/charter-full-v0.4.md");
  await page.goto("/documents/living-practice");
  await expect(page.getByRole("status")).toContainText("Робоча гілка");
  await expect(page.locator(".reading-document")).toContainText("90 днів");
});
