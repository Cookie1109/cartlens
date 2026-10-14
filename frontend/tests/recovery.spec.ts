import { test, expect } from "@playwright/test"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"
const failure = { code: "MINING_FAILED", message: "Không thể hoàn thành yêu cầu.", fieldErrors: [] }

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
