import { test, expect } from "@playwright/test"
const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"

test("paired DSe structures, page-scrolled results and responsive tree/comparison layouts", async ({page,request}) => {
  const {streamId} = await (await request.post(`${api}/streams`)).json()
  await page.addInitScript(id=>localStorage.setItem("cartlens.streamId",id),streamId)
  await page.goto("/")
  await expect(page.getByRole("button",{name:"Stream mới",exact:true})).toBeEnabled()
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(6)
  await expect(page.getByRole("button",{name:"Kết quả",exact:true})).toHaveCount(0)
  await page.getByRole("button",{name:"Giao dịch",exact:true}).click()
  await page.getByRole("button",{name:"Nạp DSe",exact:true}).click()
  await expect(page.getByRole("heading",{name:"Danh sách (6 giao dịch)",exact:true})).toBeVisible()
  const snapshot = await (await request.get(`${api}/streams/${streamId}/live`)).json()
  expect(snapshot.ct.windowId).toBe(2); expect(snapshot.dwt.windowId).toBe(2)
  expect(snapshot.points.every((p:{equivalent:boolean})=>p.equivalent)).toBe(true)
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:1280,height:600}]) {
    await page.setViewportSize(viewport)
    for (const [name,structure] of [["FWUDS-CT","ct-structure"],["FWUDS-DWT","dwt-structure"],["So sánh","comparison-page"]]) {
      if (viewport.width < 768) await page.getByRole("button",{name:"Mở menu",exact:true}).click()
      await page.getByRole("button",{name,exact:true}).click()
      await expect(page.getByTestId(structure)).toBeVisible()
      if(name!=="So sánh") {
        await expect(page.getByRole("heading",{name:"Theo dõi luồng",exact:true})).toBeVisible()
        await expect(page.getByTestId("stream-live-status").locator("dt")).toHaveText(["Pane đang nhận", "Cửa sổ"])
        await expect(page.getByRole("progressbar",{name:"Giao dịch trong pane hiện tại"})).toHaveAttribute("aria-valuenow", "0")
        await expect(page.getByRole("progressbar",{name:"Pane hoàn tất trong cửa sổ"})).toHaveAttribute("aria-valuenow", "2")
        await expect(page.getByTestId("pattern-count")).toHaveText(String(snapshot.ct.patternCount))
        await expect(page.getByTestId("processed-count")).toHaveText("6")
        await expect(page.getByTestId("pattern-table").locator("tbody tr").first()).toBeVisible()
        const last = page.getByTestId("pattern-table").locator("tbody tr").last()
        await last.scrollIntoViewIfNeeded()
        const bottom = await last.boundingBox()
        expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(viewport.height)
      } else {
        await expect(page.getByRole("img",{name:/Thời gian thực thi/})).toBeVisible()
        await expect(page.getByRole("img",{name:/Bộ nhớ sử dụng/})).toBeVisible()
        await expect(page.getByRole("img",{name:/Thời gian cập nhật/})).toBeVisible()
      }
      expect(await page.evaluate(()=>document.documentElement.scrollHeight > innerHeight+1)).toBe(name !== "So sánh")
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if(viewport.width===1440) await page.screenshot({path:`../tmp/parallel-${name}.png`})
    }
  }
  await page.setViewportSize({width:1440,height:900})
  await request.post(`${api}/streams/${streamId}/transactions`, {data:{id:"partial-pane",items:[{itemId:"A",name:"A",quantity:1,weight:1}]}})
  for (const algorithm of ["FWUDS-CT", "FWUDS-DWT"]) {
    await page.getByRole("button",{name:algorithm,exact:true}).click()
    await expect(page.getByRole("progressbar",{name:"Giao dịch trong pane hiện tại"})).toHaveAttribute("aria-valuenow", "1")
    await expect(page.getByRole("progressbar",{name:"Pane hoàn tất trong cửa sổ"})).toHaveAttribute("aria-valuenow", "2")
  }
  await page.getByRole("button",{name:"Cấu hình luồng",exact:true}).click()
  await expect(page.getByRole("radio")).toHaveCount(0)
})

for (const dataset of ["RETAIL","ACCIDENTS"] as const) {
  test(`${dataset} streams both algorithms with real utility data`, async ({page,request}) => {
    const {streamId} = await (await request.post(`${api}/streams`)).json()
    await page.addInitScript(id=>localStorage.setItem("cartlens.streamId",id),streamId)
    await page.goto("/")
    await expect(page.getByRole("button",{name:"Stream mới",exact:true})).toBeEnabled()
    await page.getByRole("button",{name:"Giao dịch",exact:true}).click()
    await page.getByLabel("Bộ dữ liệu để nạp",{exact:true}).selectOption(dataset)
    await page.getByRole("button",{name:"Cấu hình luồng",exact:true}).click()
    await page.getByLabel("Kích thước pane").fill("20")
    await page.getByLabel("Số pane trong window").fill("2")
    await page.getByLabel("Ngưỡng minWus").fill("0.9")
    await page.getByLabel("Tốc độ giao dịch/giây").fill("0")
    await page.getByLabel("Số giao dịch muốn đọc").fill("60")
    await page.getByRole("button",{name:`Bắt đầu ${dataset==="RETAIL"?"Retail":"Accidents"}`,exact:true}).click()
    await expect.poll(async()=> {
      const response = await request.get(`${api}/streams/${streamId}/replay`)
      return response.status() === 204 ? "PENDING" : (await response.json()).state
    }).toBe("COMPLETED")
    const snapshot = await (await request.get(`${api}/streams/${streamId}/live`)).json()
    expect(snapshot.ct.windowId).toBe(2); expect(snapshot.dwt.windowId).toBe(2)
    expect(snapshot.points).toHaveLength(2)
    expect(snapshot.points.every((p:{equivalent:boolean,processedTransactions:number})=>p.equivalent && p.processedTransactions<=60)).toBe(true)
    const ct = await (await request.get(`${api}/streams/${streamId}/results/window?sessionId=${encodeURIComponent(snapshot.ct.runId)}&windowId=2`)).json()
    const dwt = await (await request.get(`${api}/streams/${streamId}/results/window?sessionId=${encodeURIComponent(snapshot.dwt.runId)}&windowId=2`)).json()
    expect(ct.patterns).toEqual(dwt.patterns)
    const transactions = await (await request.get(`${api}/streams/${streamId}/transactions`)).json()
    expect(transactions).toHaveLength(60)
    expect(transactions[0].items[0]).toMatchObject({itemId:"1",quantity:1,weight:dataset==="RETAIL"?326108:118131})
    const replay = await (await request.get(`${api}/streams/${streamId}/replay`)).json()
    expect(replay.request.dataset).toBe(dataset)
    await page.getByRole("button",{name:"FWUDS-DWT",exact:true}).click()
    await expect(page.getByTestId("processed-count")).toHaveText("60")
    await expect(page.getByTestId("dwt-structure")).toBeVisible()
  })
}
