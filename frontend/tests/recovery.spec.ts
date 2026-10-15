import { test, expect } from "@playwright/test"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"
const failure = { code: "MINING_FAILED", message: "Không thể hoàn thành yêu cầu.", fieldErrors: [] }

test("a failed first window shows the mining error instead of waiting for another transaction", async ({ page, request }) => {
  const { streamId } = await (await request.post(`${api}/streams`)).json()
  const config = { paneSize: 400, windowPaneCount: 3, minWus: 0.5 }
  await request.post(`${api}/streams/${streamId}/configuration`, { data: { algorithm: "FWUDS_DWT", ...config } })
  const message = "Kết quả vượt giới hạn 1.000.000 lượt tham chiếu ID giao dịch/cửa sổ."
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  await page.route(`${api}/streams/${streamId}/overview`, async route => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ response, json: { ...body, transactionCount: 1200, miningError: message, latestRun: null,
      metrics: { ...body.metrics, processedTransactions: 1199, retainedTransactions: 1199, bufferedTransactions: 399 } } })
  })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Cấu hình luồng", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText(message)
  await expect(page.getByText(/Khai phá đã dừng do lỗi; chưa có kết quả cửa sổ đầu tiên/)).toBeVisible()
  await expect(page.getByText(/Chờ cửa sổ đầu tiên: còn/)).toHaveCount(0)
  await expect(page.getByRole("progressbar", { name: "Tiến độ cửa sổ đầu tiên" })).toHaveCount(0)
})

test("initial API failure recovers without reloading or replacing the saved stream", async ({page,request}) => {
  const {streamId} = await (await request.post(`${api}/streams`)).json()
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  let unavailable = true
  const created: string[] = []
  page.on("request", r => { if (r.method() === "POST" && r.url() === `${api}/streams`) created.push(r.url()) })
  await page.route(`${api}/**`, route => unavailable ? route.fulfill({status:500,json:failure}) : route.continue())
  await page.goto("/")
  await expect(page.getByRole("alert")).toContainText(failure.message)
  unavailable = false
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Stream mới",exact:true})).toBeEnabled()
  await expect(page.getByLabel("Trạng thái hệ thống: Đã kết nối")).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("cartlens.streamId"))).toBe(streamId)
  await page.getByRole("button",{name:"Giao dịch",exact:true}).click()
  await expect(page.getByRole("button",{name:"Nạp Retail",exact:true})).toBeEnabled()
  expect(created).toEqual([])
})

test("live polling clears a transient API error and continues on the same tab", async ({page,request}) => {
  const {streamId} = await (await request.post(`${api}/streams`)).json()
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  let unavailable = false
  await page.route(`${api}/streams/${streamId}/**`, route => unavailable ? route.fulfill({status:500,json:failure}) : route.continue())
  await page.goto("/")
  await expect(page.getByRole("button",{name:"Stream mới",exact:true})).toBeEnabled()
  await page.getByRole("button",{name:"FWUDS-CT",exact:true}).click()
  unavailable = true
  await expect(page.getByRole("alert")).toContainText(failure.message)
  unavailable = false
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByRole("heading",{name:"FWUDS-CT",exact:true})).toBeVisible()
  await expect(page.getByLabel("Trạng thái hệ thống: Đã kết nối")).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("cartlens.streamId"))).toBe(streamId)
})
