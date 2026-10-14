import { test, expect, type Page } from "@playwright/test"
import fs from "node:fs/promises"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"
// Fig. 2 and Table 2, transcribed independently of AppProvider's demo fixture.
const quantities = [[1,0,2,2,1],[0,2,1,2,2],[2,0,1,0,1],[1,0,3,2,0],[0,1,1,1,0],[2,0,2,3,1]]
const weights = [[0.2,0.4,0.2,0.4,0.5],[0.5,0.3,0.4,0.6,0.6]]
const items = ["A","B","C","D","E"]
// Eq. (1), represented as exact integer multiples of 1/120.
const units = [57,84,44,116,52,126]
const transactions = quantities.map((q, t) => ({ id:`t${t+1}`, items:items.flatMap((id, i) => q[i] ? [{itemId:id,name:id,quantity:q[i],weight:weights[t<3?0:1][i]}] : []) }))
const fmt = (value:number, digits=8) => new Intl.NumberFormat("vi-VN",{maximumFractionDigits:digits}).format(value)
type Pattern = {items:string[];wus:number;support:number;transactionIds:string[]}

function expectedPatterns(start:number, threshold=0.5): Pattern[] {
  const denominator = units.slice(start,start+4).reduce((a,b)=>a+b,0)
  const found:Pattern[]=[]
  for(let mask=1;mask<32;mask++) {
    const pattern=items.filter((_,i)=>mask & (1<<i))
    const indices=quantities.flatMap((q,t)=>t>=start && t<start+4 && pattern.every(id=>q[items.indexOf(id)]>0)?[t]:[])
    const numerator=indices.reduce((sum,t)=>sum+units[t],0)
    if(numerator>=threshold*denominator) found.push({items:pattern,wus:numerator/denominator,support:indices.length,transactionIds:indices.map(t=>`t${t+1}`)})
  }
  return found
}

function assertPatterns(actual:Pattern[], start:number, threshold=0.5) {
  const expected=expectedPatterns(start,threshold)
  expect(actual.map(p=>p.items.join("|")).sort()).toEqual(expected.map(p=>p.items.join("|")).sort())
  for(const p of actual) {
    const e=expected.find(e=>e.items.join("|")===p.items.join("|"))!
    expect(p.wus).toBeCloseTo(e.wus,14)
    expect(p.support).toBe(e.support)
    expect(p.transactionIds).toEqual(e.transactionIds)
  }
}

async function openStream(page:Page, streamId:string) {
  await page.addInitScript(id=>localStorage.setItem("cartlens.streamId",id),streamId)
  await page.goto("/")
  await expect(page.getByRole("button",{name:"Stream mới",exact:true})).toBeEnabled()
}

async function assertVisiblePatterns(page:Page,start:number) {
  const expected=expectedPatterns(start)
  const seen:string[]=[]
  await expect(page.getByTestId("pattern-count")).toHaveText(String(expected.length))
  const next=page.getByRole("button",{name:"Trang sau kết quả",exact:true})
  for(let n=0;n<expected.length;n++) {
    const table=page.getByTestId("pattern-table")
    await expect(table).toHaveAttribute("aria-busy","false")
    const rows=table.locator("tbody tr")
    for(let i=0;i<await rows.count();i++) {
      const cells=rows.nth(i).locator("td")
      const text=await cells.nth(0).innerText()
      const e=expected.find(p=>`{${p.items.join(", ")}}`===text.trim())!
      expect(e,`unexpected UI pattern ${text}`).toBeDefined()
      expect(seen).not.toContain(text.trim());seen.push(text.trim())
      await expect(cells.nth(1)).toHaveText(fmt(e.wus,6))
      await expect(cells.nth(2)).toHaveText(String(e.support))
      await cells.nth(0).getByRole("button").click()
      const dialog=page.getByRole("dialog",{name:"Chi tiết mẫu"})
      await expect(dialog.locator("dd").nth(0)).toHaveText(fmt(e.wus,10))
      await expect(dialog.locator("dd").nth(1)).toHaveText(String(e.support))
      await expect(dialog.locator("span.font-mono")).toHaveText(e.transactionIds.map(id=>id.slice(1)))
      await dialog.getByRole("button",{name:"Đóng hộp thoại"}).click()
    }
    if(await next.isDisabled()) break
    await next.click()
  }
  expect(seen.sort()).toEqual(expected.map(p=>`{${p.items.join(", ")}}`).sort())
}

function csvRows(text:string) {
  return text.replace(/^\uFEFF/,"").trim().split(/\r?\n/).map(line=> {
    const row:string[]=[];let value="",quoted=false
    for(let i=0;i<line.length;i++) {
      if(line[i]==='"') {if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}
      else if(line[i]===","&&!quoted){row.push(value);value=""}else value+=line[i]
    }
    row.push(value);return row
  })
}

test("paper DSe data, every visible result page, detail IDs, CSV and chart values are correct",async({page,request},testInfo)=> {
  const created=await request.post(`${api}/streams`);expect(created.ok()).toBe(true)
  const {streamId}=await created.json();await openStream(page,streamId)
  await page.getByRole("button",{name:"Giao dịch",exact:true}).click()
  await page.getByRole("button",{name:"Nạp DSe",exact:true}).click()
  await expect(page.getByRole("heading",{name:"Danh sách (6 giao dịch)",exact:true})).toBeVisible()
  const data=await(await request.get(`${api}/streams/${streamId}/transactions`)).json()
  expect(data.map(({id,items}:{id:string;items:unknown})=>({id,items}))).toEqual(transactions)
  for(let t=0;t<6;t++) {
    expect(data[t].twu).toBeCloseTo(units[t]/120,14)
    const button=page.getByRole("button",{name:`Chi tiết giao dịch ${t+1}`,exact:true})
    await expect(button.locator("xpath=ancestor::tr").locator("td").last()).toHaveText(fmt(units[t]/120,4))
    await button.click()
    const rows=page.locator(`#transaction-t${t+1} tbody tr`)
    await expect(rows).toHaveCount(transactions[t].items.length)
    for(let i=0;i<transactions[t].items.length;i++) {
      const item=transactions[t].items[i]
      await expect(rows.nth(i).locator("td")).toHaveText([item.itemId,String(item.quantity),fmt(item.weight)])
    }
    await button.click()
  }
  const snapshot=await(await request.get(`${api}/streams/${streamId}/live`)).json()
  expect(snapshot.points).toHaveLength(2)
  for(const algorithm of ["ct","dwt"] as const) {
    const title=algorithm==="ct"?"FWUDS-CT":"FWUDS-DWT"
    for(let windowId=1;windowId<=2;windowId++) {
      const response=await request.get(`${api}/streams/${streamId}/results/window`,{params:{sessionId:snapshot[algorithm].runId,windowId,limit:100}})
      expect(response.ok()).toBe(true)
      const result=await response.json();assertPatterns(result.patterns,(windowId-1)*2)
      expect(result.patternCount).toBe(expectedPatterns((windowId-1)*2).length)
    }
    await page.getByRole("button",{name:title,exact:true}).click()
    await assertVisiblePatterns(page,2)
    await page.screenshot({path:testInfo.outputPath(`${algorithm}-paper-results.png`)})
    const event=page.waitForEvent("download")
    await page.getByRole("link",{name:`Tải CSV toàn phiên ${title}`,exact:true}).click()
    const download=await event;const csv=csvRows(await fs.readFile((await download.path())!,"utf8"))
    expect(csv[0]).toEqual(["sessionId","windowId","algorithm","pattern","wus","support","transactionIds","executionTimeMs"])
    expect(csv).toHaveLength(1+expectedPatterns(0).length+expectedPatterns(2).length)
    for(let w=1;w<=2;w++) {
      const rows=csv.slice(1).filter(row=>Number(row[1])===w)
      expect(rows.every(row=>row[0]===snapshot[algorithm].runId&&row[2]===title.replace("-","_"))).toBe(true)
      assertPatterns(rows.map(row=>({items:row[3].replace(/[{} ]/g,"").split(","),wus:Number(row[4]),support:Number(row[5]),transactionIds:row[6].split(";")})),(w-1)*2)
    }
  }
  await page.getByRole("button",{name:"So sánh",exact:true}).click()
  for(const point of snapshot.points) {
    await page.getByLabel("Cửa sổ đang xem").selectOption(String(point.windowId))
    for(const [title,ct,dwt] of [
      ["Thời gian thực thi",point.ctUpdateMs+point.ctMiningMs,point.dwtUpdateMs+point.dwtMiningMs],
      ["Bộ nhớ sử dụng (ước tính)",point.ctMemoryBytes/1048576,point.dwtMemoryBytes/1048576],
      ["Thời gian cập nhật cửa sổ",point.ctUpdateMs,point.dwtUpdateMs],
    ] as const) {
      const display=(n:number)=>fmt(n,n<0.01?5:3)
      await expect(page.getByTestId(`chart-${title}`)).toContainText(`#${point.windowId} · CT ${display(ct)} / DWT ${display(dwt)}`)
    }
  }
  await page.getByRole("button",{name:"Phương pháp đo",exact:true}).click()
  await expect(page.getByRole("dialog")).toContainText("Đây không phải bộ nhớ đỉnh")
  await expect(page.getByRole("dialog")).toContainText("đo đơn luồng bằng C#")
})

test("paper W1 to W2 updates visible CTsets and actual DSWUN paths without stale pane data",async({page,request},testInfo)=> {
  const {streamId}=await(await request.post(`${api}/streams`)).json()
  await openStream(page,streamId)
  for(let t=0;t<6;t++) {
    const response=await request.post(`${api}/streams/${streamId}/transactions`,{data:transactions[t]})
    expect(response.ok()).toBe(true)
    if(t!==3&&t!==5)continue
    const start=t===3?0:2
    await page.getByRole("button",{name:"FWUDS-CT",exact:true}).click()
    await expect(page.getByTestId("pattern-count")).toHaveText(String(expectedPatterns(start).length))
    await expect(page.getByText(`#${start===0?1:2}`,{exact:true})).toBeVisible()
    await expect(page.getByTestId("ct-structure").getByLabel("CTset A")).toBeVisible()
    const snapshot=await(await request.get(`${api}/streams/${streamId}/live`)).json()
    const tids=start===0?[[1,3,4],[2],[1,2,3,4],[1,2,4],[1,2,3]]:[[3,4,2],[1],[3,4,1,2],[4,1,2],[3,2]]
    expect(snapshot.ctStructure.currentLcTid).toBe(start===0?4:2)
    expect(snapshot.ctStructure.sumTwu).toBeCloseTo((start===0?301:338)/120,14)
    for(let i=0;i<items.length;i++) {
      const row=snapshot.ctStructure.ctsets.find((row:{item:string})=>row.item===items[i])
      expect(row.tids).toEqual(tids[i]);expect(row.support).toBe(tids[i].length)
    }
    const seenItems:string[]=[]
    const ctNext=page.getByRole("button",{name:"Trang sau CTset",exact:true})
    for(let n=0;n<5;n++) {
      const visible=page.getByTestId("ct-structure").locator("[aria-label^='CTset ']")
      for(let i=0;i<await visible.count();i++) {
        const list=visible.nth(i)
        const item=(await list.getAttribute("aria-label"))!.slice(6)
        seenItems.push(item)
        const row=snapshot.ctStructure.ctsets.find((row:{item:string})=>row.item===item)
        await expect(list.locator("span").filter({hasText:/^\d+$/})).toHaveText(row.tids.map(String))
        await expect(list.locator("xpath=..")).toContainText(`WUS ${fmt(row.wus,4)}`)
        await expect(list.locator("xpath=..")).toContainText(`${row.support} TID`)
      }
      if(await ctNext.isDisabled())break
      await ctNext.click()
    }
    expect(seenItems.sort()).toEqual(items)
    await assertVisiblePatterns(page,start)
    await page.getByRole("button",{name:"FWUDS-DWT",exact:true}).click()
    const expected:Record<string,number>=start===0?{C:301,CD:257,CDA:173,CDAE:57,CDE:84,CDEB:84,CA:44,CAE:44}:{C:338,CD:294,CDA:242,CDAE:126,CDB:52,CA:44,CAE:44}
    const nodes=snapshot.dwtStructure.nodes
    const path=(node:any):string=>node.parentId===null?"":path(nodes.find((n:any)=>n.id===node.parentId))+node.item
    expect(nodes.filter((n:any)=>n.parentId!==null).map(path).sort()).toEqual(Object.keys(expected).sort())
    for(const node of nodes.filter((n:any)=>n.parentId!==null)) {
      expect(node.weight).toBeCloseTo(expected[path(node)]/120,14)
      await page.getByLabel("Chọn nút cây").selectOption(String(node.id))
      await expect(page.getByRole("button",{name:`Nút ${node.item}, pre ${node.pre}, post ${node.post}, ${node.count} giao dịch`,exact:true})).toHaveAttribute("aria-pressed","true")
      await expect(page.getByTestId("dwt-structure")).toContainText(`${node.item}: TWU ${fmt(node.weight,2)}, pre=${node.pre}, post=${node.post}`)
    }
    expect(snapshot.dwtStructure.tails.map((tail:{transactionId:string})=>tail.transactionId)).toEqual(transactions.slice(start,start+4).map(tx=>tx.id))
    await assertVisiblePatterns(page,start)
    await page.screenshot({path:testInfo.outputPath(`window-${start===0?1:2}.png`)})
  }
})
