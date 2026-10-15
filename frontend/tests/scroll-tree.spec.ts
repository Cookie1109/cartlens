import { test, expect, type Page, type APIRequestContext } from "@playwright/test"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"

async function openStream(page: Page, request: APIRequestContext, config?: { paneSize: number; windowPaneCount: number; minWus: number }) {
  const response = await request.post(`${api}/streams`)
  expect(response.ok()).toBe(true)
  const { streamId } = await response.json()
  if (config) expect((await request.post(`${api}/streams/${streamId}/configuration`, { data: { algorithm: "FWUDS_DWT", ...config } })).ok()).toBe(true)
  await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
  return streamId as string
}

test("DSe displays the whole tree with zoom, drag, fit and page-scrolled results", async ({ page, request }, testInfo) => {
  await openStream(page, request)
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await page.getByRole("button", { name: "Nạp DSe", exact: true }).click()
  for (const name of ["FWUDS-CT", "FWUDS-DWT"]) {
    await page.getByRole("button", { name, exact: true }).click()
    if (name === "FWUDS-CT") {
      await expect(page.getByTestId("ct-structure").locator("[aria-label^='CTset ']")).toHaveCount(5)
      await expect(page.getByRole("button", { name: /Trang (sau|trước) CTset/ })).toHaveCount(0)
      expect(await page.getByTestId("ct-structure").evaluate(node => getComputedStyle(node).overflowY)).toBe("visible")
      await page.screenshot({ path: testInfo.outputPath("all-ctsets-desktop.png"), fullPage: true })
    }
    await expect(page.getByTestId("pattern-table").locator("tbody tr")).toHaveCount(11)
    await expect(page.getByRole("button", { name: /Trang (sau|trước) kết quả/ })).toHaveCount(0)
    const list = page.getByTestId("pattern-list")
    expect(await list.evaluate(node => node.scrollHeight === node.clientHeight && !["auto", "scroll"].includes(getComputedStyle(node).overflowY))).toBe(true)
    await list.locator("tbody tr").last().scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await expect(list.locator("thead")).toBeInViewport()
  }
  const tree = page.getByTestId("dwt-structure")
  const transform = page.getByTestId("tree-transform")
  await expect(tree.getByRole("button")).toHaveCount(8)
  await tree.scrollIntoViewIfNeeded()
  // All four levels, including leaves, must fit on screen at once.
  for (const node of await tree.getByRole("button").all()) await expect(node).toBeInViewport({ ratio: 0.999 })
  const fitted = await transform.getAttribute("transform")
  const fittedZoom = await page.getByTestId("tree-zoom").textContent()
  await page.getByRole("button", { name: "Phóng to cây", exact: true }).click()
  await expect(transform).not.toHaveAttribute("transform", fitted!)
  await page.getByRole("button", { name: "Thu nhỏ cây", exact: true }).click()
  await expect(page.getByTestId("tree-zoom")).toHaveText(fittedZoom!)
  const bounds = (await tree.boundingBox())!
  await page.mouse.move(bounds.x + 15, bounds.y + 15)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 95, bounds.y + 45, { steps: 5 })
  await page.mouse.up()
  await expect(transform).not.toHaveAttribute("transform", fitted!)
  const dragged = await transform.getAttribute("transform")
  // Routine live polling must preserve the user's position.
  await page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/live"))
  await page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/live"))
  await expect(transform).toHaveAttribute("transform", dragged!)
  await page.mouse.wheel(0, -120)
  await expect(transform).not.toHaveAttribute("transform", dragged!)
  await page.getByRole("button", { name: "Vừa khung cây", exact: true }).click()
  await expect.poll(() => transform.getAttribute("transform")).toBe(fitted)
  await page.screenshot({ path: testInfo.outputPath("whole-tree-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(tree.getByRole("button")).toHaveCount(8)
  await tree.scrollIntoViewIfNeeded()
  for (const node of await tree.getByRole("button").all()) await expect(node).toBeInViewport({ ratio: 0.999 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("whole-tree-mobile.png"), fullPage: true })
  expect(errors).toEqual([])
})

test("continuous result scrolling loads every batch and retries without losing rows", async ({ page, request }) => {
  const id = await openStream(page, request, { paneSize: 1, windowPaneCount: 1, minWus: 0.5 })
  const items = "ABCDEFGH".split("").map(itemId => ({ itemId, quantity: 1, weight: 1 }))
  expect((await request.post(`${api}/streams/${id}/transactions`, { data: { id: "many-patterns", items } })).ok()).toBe(true)
  let failed = false
  await page.route("**/results/window?**", async route => {
    if (!failed && new URL(route.request().url()).searchParams.get("patternAfter") === "100") {
      failed = true
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "TEST_FAILURE", message: "Temporary failure" }) })
    }
    return route.continue()
  })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "FWUDS-DWT", exact: true }).click()
  const rows = page.getByTestId("pattern-table").locator("tbody tr")
  const list = page.getByTestId("pattern-list")
  await expect(rows).toHaveCount(100)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(list.getByText("Không tải được kết quả.")).toBeVisible()
  await expect(rows).toHaveCount(100)
  await list.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(rows).toHaveCount(200)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(rows).toHaveCount(255)
  const labels = await rows.locator("td:first-child").allTextContents()
  expect(new Set(labels).size).toBe(255)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(list.getByText("Đã hiển thị đủ 255 mẫu")).toBeVisible()
})

test("structures larger than the live preview load all CTsets and tree branches", async ({ page, request }) => {
  const id = await openStream(page, request, { paneSize: 70, windowPaneCount: 1, minWus: 0.9 })
  for (let i = 0; i < 70; i++) {
    expect((await request.post(`${api}/streams/${id}/transactions`, { data: { id: `tree-${i}`, items: [
      { itemId: "C", quantity: 1, weight: 1 }, { itemId: `item-${i}`, quantity: 1, weight: 1 },
    ] } })).ok()).toBe(true)
  }
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "FWUDS-CT", exact: true }).click()
  const ctsets = page.getByTestId("ct-structure").locator("[aria-label^='CTset ']")
  await expect(ctsets).toHaveCount(10)
  await expect(page.getByTestId("ct-page")).toHaveText("1/8")
  const previous = page.getByRole("button", { name: "Trang trước CTset", exact: true })
  const next = page.getByRole("button", { name: "Trang sau CTset", exact: true })
  await expect(previous).toBeDisabled()
  const seen: string[] = []
  for (let index = 0; index < 8; index++) {
    await expect(page.getByTestId("ct-page")).toHaveText(`${index + 1}/8`)
    await expect(ctsets).toHaveCount(index === 7 ? 1 : 10)
    seen.push(...await ctsets.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label")!)))
    if (index < 7) await next.click()
  }
  expect(new Set(seen).size).toBe(71)
  await expect(next).toBeDisabled()
  await previous.click()
  await expect(page.getByTestId("ct-page")).toHaveText("7/8")
  await expect(ctsets).toHaveCount(10)
  await page.getByRole("button", { name: "FWUDS-DWT", exact: true }).click()
  await expect(page.getByTestId("dwt-structure").getByRole("button")).toHaveCount(72)
  await expect(page.getByText(/đầy đủ 72 nút/)).toBeVisible()
})
