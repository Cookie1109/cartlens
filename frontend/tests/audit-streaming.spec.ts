import { test, expect } from "@playwright/test"
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { resolve } from "node:path"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"

test("Accidents continuous replay keeps audit bounded and navigation stable", async ({ page, request }, testInfo) => {
  test.setTimeout(120000)
  const source = await (await request.get(`${api}/datasets/accidents`)).json()
  test.skip(!source.available, "Local Accidents dataset is not installed")
  const { streamId } = await (await request.post(`${api}/streams`)).json()
  const started = await request.post(`${api}/streams/${streamId}/replay`, { data: {
    dataset: "ACCIDENTS", algorithm: "FWUDS_CT", paneSize: 200, windowPaneCount: 5, minWus: 0.99,
    transactionsPerSecond: 1000, maxTransactions: 12000, weightMode: "PROVIDED_UTILITY", weightBatchSize: 10000, seed: 42,
  } })
  expect(started.ok()).toBe(true)
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  let inFlight = 0, peakInFlight = 0
  const auditRequests: { at: number; url: string }[] = []
  const failures: number[] = []
  const sizes: number[] = []
  const pending: Promise<void>[] = []
  page.on("request", req => {
    if (!req.url().includes("/audit/")) return
    inFlight++; peakInFlight = Math.max(peakInFlight, inFlight)
    auditRequests.push({ at: Date.now(), url: req.url() })
  })
  const finished = (req: { url: () => string }) => { if (req.url().includes("/audit/")) inFlight-- }
  page.on("requestfinished", finished); page.on("requestfailed", finished)
  page.on("response", response => {
    if (!response.url().includes("/audit/")) return
    if (!response.ok()) failures.push(response.status())
    pending.push(response.body().then(body => {
      sizes.push(body.length)
      const data = JSON.parse(body.toString())
      expect(data.samples.length).toBeLessThanOrEqual(48)
      expect(data.evaluatedCandidates).toBe(data.acceptedCandidates + data.prunedCandidates)
    }))
  })
  try {
    await page.goto("/")
    await page.getByRole("button", { name: "FWUDS-CT", exact: true }).click()
    await expect(page.getByRole("button", { name: "Audit log", exact: true })).toBeEnabled({ timeout: 30000 })
    expect(auditRequests).toHaveLength(0)
    await page.getByRole("button", { name: "Audit log", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: /^Audit log/ })
    await expect(dialog.getByTestId("audit-sample").first()).toBeVisible()
    const initialBounds = await dialog.boundingBox()
    const initialWindow = await dialog.getByTestId("audit-window").getAttribute("data-window-id")
    await dialog.getByRole("button", { name: "Bị loại", exact: true }).click()
    const search = dialog.getByRole("searchbox", { name: "Tìm trong ví dụ audit", exact: true })
    await search.fill("1")
    await expect.poll(() => dialog.getByTestId("audit-window").getAttribute("data-window-id"), { timeout: 15000 }).not.toBe(initialWindow)
    await expect(search).toHaveValue("1")
    await expect(search).toBeFocused()
    await expect(dialog.getByRole("button", { name: "Bị loại", exact: true })).toHaveAttribute("aria-pressed", "true")
    expect(await dialog.getByTestId("audit-sample").count()).toBeLessThanOrEqual(5)
    expect(Math.abs((await dialog.boundingBox())!.height - initialBounds!.height)).toBeLessThan(2)
    const behind = auditRequests.length
    await expect(dialog.getByTestId("audit-sample").first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("accidents-live-audit.png") })
    await dialog.getByRole("tab", { name: "Dữ liệu cửa sổ", exact: true }).click()
    const jump = dialog.getByRole("spinbutton", { name: "Trang pane trong cửa sổ", exact: true })
    await jump.fill("3")
    const dataWindow = await dialog.getByTestId("audit-window").getAttribute("data-window-id")
    await expect.poll(() => dialog.getByTestId("audit-window").getAttribute("data-window-id"), { timeout: 15000 }).not.toBe(dataWindow)
    await expect(jump).toHaveValue("3")
    await expect(jump).toBeFocused()
    await dialog.getByRole("button", { name: "Đi đến pane", exact: true }).click()
    await dialog.getByRole("tab", { name: "Log khai phá", exact: true }).click()
    await expect(search).toHaveValue("1")
    await expect(dialog.getByRole("button", { name: "Bị loại", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect.poll(async () => (await (await request.get(`${api}/streams/${streamId}/replay`)).json()).state, { timeout: 90000, intervals: [500] }).toBe("COMPLETED")
    await expect(dialog).toHaveAccessibleName("Audit log · FWUDS-CT")
    await expect(dialog.getByTestId("audit-window")).toHaveAttribute("data-window-id", "56")
    await expect(dialog.getByTestId("audit-window")).toContainText("Giao dịch thứ 11.001–12.000")
    await expect(search).toHaveValue("1")
    await dialog.getByRole("tab", { name: "Dữ liệu cửa sổ", exact: true }).click()
    await expect(dialog.getByTestId("window-transaction")).toHaveCount(20)
    await expect(dialog.getByTestId("audit-sample")).toHaveCount(0)
    await dialog.getByRole("spinbutton", { name: "Trang pane trong cửa sổ", exact: true }).fill("5")
    await dialog.getByRole("button", { name: "Đi đến pane", exact: true }).click()
    await expect(dialog.getByTestId("audit-window-data")).toContainText("Pane P60")
    await expect(dialog.getByTestId("window-transaction")).toHaveCount(20)
    await dialog.getByTestId("audit-transactions-scroll").evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(dialog.getByTestId("window-transaction").last()).toHaveAttribute("data-transaction-id", "12000")
    const rows = dialog.getByTestId("window-transaction")
    await rows.last().getByRole("button", { name: /^Chi tiết giao dịch/ }).click()
    await expect(dialog.getByRole("table").getByRole("row")).toHaveCount(11)
    await dialog.getByRole("searchbox", { name: "Tìm item trong giao dịch", exact: true }).fill("17")
    expect(await dialog.getByRole("table").getByRole("row").count()).toBeLessThanOrEqual(11)
    await page.screenshot({ path: testInfo.outputPath("accidents-window-data.png") })
    await Promise.all(pending)
    expect(failures).toEqual([])
    expect(peakInFlight).toBe(1)
    expect(auditRequests.length).toBeGreaterThanOrEqual(behind)
    for (const req of auditRequests) {
      const params = new URL(req.url).searchParams
      expect(params.get("latest")).toBe("true")
      expect(Number(params.get("windowId"))).toBeGreaterThan(0)
    }
    for (let i = 1; i < auditRequests.length; i++) expect(auditRequests[i].at - auditRequests[i - 1].at).toBeGreaterThanOrEqual(950)
    expect(Math.max(...sizes)).toBeLessThan(100000)
    const live = await (await request.get(`${api}/streams/${streamId}/live`)).json()
    expect(live.points).toHaveLength(56)
    expect(live.points.every((point: { equivalent: boolean }) => point.equivalent)).toBe(true)
    const report = { dataset: source, transactions: 12000, paneSize: 200, windowPaneCount: 5, minWus: 0.99, windows: live.points.length, auditRequests: auditRequests.length, peakInFlight, maxAuditBytes: Math.max(...sizes), ctDwtEquivalent: true }
    await testInfo.attach("Accidents streaming evidence", { body: JSON.stringify(report, null, 2), contentType: "application/json" })
  } finally {
    await request.post(`${api}/streams/${streamId}/replay/stop`)
  }
})

test("Accidents 10000-transaction window has bounded UI and matches a direct scan", async ({ page, request }, testInfo) => {
  test.setTimeout(120000)
  const source = await (await request.get(`${api}/datasets/accidents`)).json()
  test.skip(!source.available, "Local Accidents dataset is not installed")
  const { streamId } = await (await request.post(`${api}/streams`)).json()
  const started = await request.post(`${api}/streams/${streamId}/replay`, { data: {
    dataset: "ACCIDENTS", algorithm: "FWUDS_CT", paneSize: 1000, windowPaneCount: 10, minWus: 0.99,
    transactionsPerSecond: 0, maxTransactions: 20000, weightMode: "PROVIDED_UTILITY", weightBatchSize: 10000, seed: 42,
  } })
  expect(started.ok()).toBe(true)
  try {
    await expect.poll(async () => (await (await request.get(`${api}/streams/${streamId}/replay`)).json()).state, { timeout: 90000, intervals: [500] }).toBe("COMPLETED")
    const live = await (await request.get(`${api}/streams/${streamId}/live`)).json()
    expect(live.ct.windowId).toBe(11)
    expect(live.points.every((p: { equivalent: boolean }) => p.equivalent)).toBe(true)
    // Independent exhaustive scan of the final window; singleton pruning bounds
    // the subset universe for this high-threshold, dense dataset configuration.
    const tx: { items: Set<string>; twu: number }[] = []
    const singleton = new Map<string, number>()
    const lines = createInterface({ input: createReadStream(resolve("../Accidents-metadata/Accidents-metadata/Accidents-metadata/transactions.txt")), crlfDelay: Infinity })
    let ordinal = 0, sum = 0
    for await (const line of lines) {
      ordinal++
      if (ordinal > 20000) break
      if (ordinal <= 10000) continue
      const [ids, , utility] = line.split(":")
      const items = new Set(ids.trim().split(/\s+/))
      const twu = utility.trim().split(/\s+/).reduce((total, term) => total + Number(term), 0) / items.size
      sum += twu; tx.push({ items, twu })
      for (const item of items) singleton.set(item, (singleton.get(item) ?? 0) + twu)
    }
    const frequent = [...singleton].filter(([, total]) => total / sum >= 0.99).map(([item]) => item).sort()
    expect(frequent.length).toBeLessThanOrEqual(12)
    const expected = new Map<string, { wus: number; support: number }>()
    for (let bits = 1; bits < 2 ** frequent.length; bits++) {
      const items = frequent.filter((_, i) => bits & (1 << i))
      let numerator = 0, support = 0
      for (const t of tx) if (items.every(item => t.items.has(item))) { numerator += t.twu; support++ }
      if (numerator / sum >= 0.99) expected.set(items.join(","), { wus: numerator / sum, support })
    }
    expect(expected.size).toBeGreaterThan(0)
    const auditBytes: Record<string, number> = {}
    for (const algorithm of ["CT", "DWT"]) {
      const response = await request.get(`${api}/streams/${streamId}/audit/FWUDS_${algorithm}?sessionId=${live.sessionId}`)
      expect(response.ok()).toBe(true)
      const audit = await response.json()
      auditBytes[algorithm] = (await response.body()).length
      expect(audit.windowId).toBe(11)
      expect(audit.samples.length).toBeLessThanOrEqual(48)
      expect(audit.sumTwu / sum).toBeCloseTo(1, 12)
      const result = await (await request.get(`${api}/streams/${streamId}/results/window?sessionId=${encodeURIComponent(live[algorithm.toLowerCase()].runId)}&windowId=11&patternAfter=0&limit=100`)).json()
      expect(result.algorithm).toBe(`FWUDS_${algorithm}`)
      expect(result.patternCount).toBe(expected.size)
      expect(result.patterns.length).toBe(expected.size)
      for (const pattern of result.patterns) {
        const direct = expected.get([...pattern.items].sort().join(","))
        expect(direct).toBeDefined()
        expect(pattern.wus).toBeCloseTo(direct!.wus, 10)
        expect(pattern.support).toBe(direct!.support)
      }
    }
    await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
    await page.goto("/")
    await page.getByRole("button", { name: "FWUDS-DWT", exact: true }).click()
    await page.getByRole("button", { name: "Audit log", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Audit log · FWUDS-DWT", exact: true })
    await expect(dialog.getByTestId("audit-sample")).toHaveCount(5)
    await dialog.getByRole("tab", { name: "Dữ liệu cửa sổ", exact: true }).click()
    await expect(dialog.getByTestId("window-transaction")).toHaveCount(20)
    await dialog.getByRole("spinbutton", { name: "Trang pane trong cửa sổ", exact: true }).fill("10")
    await dialog.getByRole("button", { name: "Đi đến pane", exact: true }).click()
    await expect(dialog.getByTestId("audit-window-data")).toContainText("Pane P20")
    await dialog.getByTestId("audit-transactions-scroll").evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(dialog.getByTestId("window-transaction").last()).toHaveAttribute("data-transaction-id", "20000")
    expect(await dialog.getByTestId("window-transaction").count()).toBeLessThanOrEqual(20)
    await page.screenshot({ path: testInfo.outputPath("accidents-10000-window.png") })
    await page.setViewportSize({ width: 375, height: 812 })
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("accidents-10000-mobile.png") })
    const report = { transactions: 20000, windowTransactions: 10000, windows: 11, minWus: 0.99, expectedPatterns: expected.size, frequentSingletons: frequent, directScanEquivalent: true, auditBytes, maxMountedTransactions: 20, pageUnit: "pane", panePages: 10 }
    await testInfo.attach("Accidents large window evidence", { body: JSON.stringify(report, null, 2), contentType: "application/json" })
  } finally { await request.post(`${api}/streams/${streamId}/replay/stop`) }
})
