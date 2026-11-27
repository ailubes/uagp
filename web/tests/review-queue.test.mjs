import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { chromium } from "playwright";

test("private review, versioned author consent, safe GitHub handoff and recovery", {timeout:120000}, async() => {
  const dir=await mkdtemp(join(tmpdir(),"uagp-queue-test-"));
  const reviewer=randomBytes(32).toString("hex");
  const owner=randomBytes(32).toString("hex");
  const probe=createServer();probe.listen(0,"127.0.0.1");await once(probe,"listening");
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const url="http://127.0.0.1:"+port;
  const start=()=>spawn(process.execPath,["--require","./tests/queue-github-stub.cjs","node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{
    windowsHide:true,stdio:"ignore",env:{...process.env,NODE_ENV:"production",UAGP_QUEUE_DIR:dir,UAGP_REVIEW_KEY:reviewer,UAGP_QUEUE_GITHUB_TOKEN:"TEST-ONLY",UAGP_DATA_MODE:"snapshot"}
  });
  async function ready(){for(let i=0;i<100;i++){try{if((await fetch(url+"/review")).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error("Server unavailable");}
  async function post(key,action,params={},status=200){
    const response=await fetch(url+"/api/review-queue",{method:"POST",headers:{authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({action,...params})});
    const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
  }
  let server=start(),browser;
  const stop=async()=>{if(server.exitCode===null&&server.signalCode===null){const exited=once(server,"exit");server.kill();await exited;}};
  try{
    await ready();
    await post(owner,"list",{},403);
    await post(owner,"create",{title:"Тема",body:"Особисте спостереження"},400);
    let card=await post(owner,"create",{title:"Тема",body:"Особисте спостереження",consent:true});
    assert.equal((await post(owner,"create",{title:card.title,body:card.body,consent:true})).id,card.id);
    await post(randomBytes(32).toString("hex"),"track",{id:card.id},404);
    const id=card.id;
    await post(owner,"approve",{id,version:1,note:"ok"},403);
    await post(reviewer,"publish",{id,version:1},409);
    card=await post(reviewer,"clarify",{id,version:1,note:"Уточніть період."});
    card=await post(owner,"revise",{version:card.version,consent:true,title:"Розклад",body:"Погоджений текст."});
    await post(reviewer,"approve",{id,version:1,note:"Застаріла версія"},409);
    card=await post(reviewer,"approve",{id,version:card.version,note:"Перевірено джерело."});
    await post(reviewer,"publish",{id,version:card.version},409);
    await post(owner,"consent",{version:card.version,consent:false},400);
    card=await post(owner,"consent",{version:card.version,consent:true});
    const publishRequest=()=>fetch(url+"/api/review-queue",{
      method:"POST",headers:{authorization:"Bearer "+reviewer,"Content-Type":"application/json"},
      body:JSON.stringify({action:"publish",id,version:card.version})
    });
    const simultaneous=await Promise.all([publishRequest(),publishRequest()]);
    assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
    card=await post(owner,"track");
    assert.equal(card.issue,1);
    await post(reviewer,"publish",{id,version:card.version},409);
    for(const [title,state] of [["Відмова","ready"],["Втрачена відповідь","publishing"]]){
      const k=randomBytes(32).toString("hex");
      let c=await post(k,"create",{title,body:"погоджено",consent:true});
      c=await post(reviewer,"approve",{id:c.id,version:c.version,note:"Перевірено"});
      c=await post(k,"consent",{version:c.version,consent:true});
      await post(reviewer,"publish",{id:c.id,version:c.version},502);
      c=await post(k,"track");assert.equal(c.state,state);
      if(state==="publishing"){
        await post(reviewer,"publish",{id:c.id,version:c.version},409);
        await post(reviewer,"reconcile",{id:c.id,version:c.version,number:1},409);
        assert.equal((await post(reviewer,"reconcile",{id:c.id,version:c.version,number:2})).state,"published");
      }
    }
    await stop();server=start();await ready();
    assert.equal((await post(owner,"track")).state,"published");
    browser=await chromium.launch();
    const author=await browser.newPage({viewport:{width:360,height:800}});
    const desk=await browser.newPage();
    await author.goto(url+"/join/chat");
    await author.getByRole("link",{name:"Передати картку на розгляд"}).click();
    await author.getByLabel("Назва картки").fill("Тест браузера");
    await author.getByLabel("Погоджений текст картки").fill("Тільки ця картка");
    await author.getByRole("checkbox").check();
    await author.getByRole("button",{name:"Передати на перевірку"}).click();
    await author.getByLabel("Приватне посилання").waitFor();
    assert.ok(author.url().includes("#"));
    await desk.goto(url+"/review");
    await desk.getByLabel("Ключ рецензента").fill(reviewer);
    await desk.getByRole("button",{name:"Відкрити чергу"}).click();
    await desk.getByRole("button",{name:"Тест браузера"}).click();
    await desk.getByLabel("Пояснення для автора").fill("Виходить за межі пілота.");
    await desk.getByRole("button",{name:"Відхилити",exact:true}).click();
    await desk.getByText("Виходить за межі пілота.",{exact:true}).waitFor();
    await author.reload();
    await author.getByText("Виходить за межі пілота.",{exact:true}).waitFor();
    assert.equal(await author.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{if(browser)await browser.close();await stop();await rm(dir,{recursive:true,force:true});}
});
