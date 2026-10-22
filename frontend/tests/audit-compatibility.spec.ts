import { test, expect } from "@playwright/test"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"

test("audit works with a backend that requires windowId for both algorithms", async ({ page, request }, testInfo) => {
  // Opt in to a read-only smoke check of an existing stream on an older backend.
  const existing = process.env.CARTLENS_READ_ONLY_STREAM
  const streamId: string = existing || (await (await request.post(`${api}/streams`)).json()).streamId
  if (!existing) for (let t = 1; t <= 4; t++) {
    expect((await request.post(`${api}/streams/${streamId}/transactions`, { data: {
      id: `compat-${t}`, items: [{ itemId: "A", quantity: 1, weight: 1 }],
    } })).ok()).toBe(true)
  }
  const before = await (await request.get(`${api}/streams/${streamId}/overview`)).json()
  const live = await (await request.get(`${api}/streams/${streamId}/live`)).json()
  expect(live.ct).not.toBeNull()
  const invalid: string[] = []
  const responses: { algorithm: string; status: number; windowId: number }[] = []
  await page.route("**/api/v1/**", async route => {
    const req = route.request()
    if (existing && req.method() !== "GET") {
      invalid.push(`Unexpected mutation ${req.method()} ${req.url()}`)
      return route.abort()
    }
    const url = new URL(req.url())
    if (url.pathname.includes("/audit/") && !url.searchParams.has("windowId")) {
      invalid.push("Missing required windowId")
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "MINING_FAILED", message: "Không thể hoàn thành yêu cầu.", fieldErrors: [] }) })
    }
    return route.continue()
  })
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  await page.goto("/")
  for (const algorithm of ["CT", "DWT"]) {
    await page.getByRole("button", { name: `FWUDS-${algorithm}`, exact: true }).click()
    const responsePromise = page.waitForResponse(response => response.url().includes(`/audit/FWUDS_${algorithm}?`))
    await page.getByRole("button", { name: "Audit log", exact: true }).click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.algorithm).toBe(`FWUDS_${algorithm}`)
    expect(body.windowId).toBe(live[algorithm.toLowerCase()].windowId)
    expect(new URL(response.url()).searchParams.get("latest")).toBe("true")
    const dialog = page.getByRole("dialog", { name: `Audit log · FWUDS-${algorithm}`, exact: true })
    await expect(dialog.getByTestId("audit-sample").first()).toBeVisible()
    await expect(dialog.getByRole("alert")).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`compatible-audit-${algorithm}.png`) })
    responses.push({ algorithm: body.algorithm, status: response.status(), windowId: body.windowId })
    await page.keyboard.press("Escape")
  }
  expect(invalid).toEqual([])
  if (existing) {
    const after = await (await request.get(`${api}/streams/${streamId}/overview`)).json()
    expect(after.transactionCount).toBe(before.transactionCount)
    expect(after.configuration.sessionId).toBe(before.configuration.sessionId)
  }
  await testInfo.attach("Audit compatibility evidence", { body: JSON.stringify({ api, readOnly: !!existing, streamId, responses, invalid }, null, 2), contentType: "application/json" })
})
