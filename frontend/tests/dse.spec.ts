import { test, expect } from "@playwright/test"

const api = process.env.CARTLENS_E2E_API || "http://localhost:8081/api/v1"

for (const algorithm of ["FWUDS-CT", "FWUDS-DWT"] as const) {
  test(`DSe preserves the selected ${algorithm} when loading, replacing and reloading`, async ({ page, request }) => {
    const apiAlgorithm = algorithm.replace("-", "_")
    const previousAlgorithm = algorithm === "FWUDS-CT" ? "FWUDS_DWT" : "FWUDS_CT"
    const created = await request.post(`${api}/streams`)
    expect(created.ok()).toBe(true)
    const { streamId } = await created.json()
    const configured = await request.post(`${api}/streams/${streamId}/configuration`, {
      data: { algorithm: previousAlgorithm, paneSize: 3, windowPaneCount: 3, minWus: 0.9 },
    })
    expect(configured.ok()).toBe(true)
    await page.addInitScript(id => localStorage.setItem("cartlens.streamId", id), streamId)
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
    await page.getByRole("button", { name: "Cấu hình luồng", exact: true }).click()
    await page.getByRole("radio", { name: algorithm, exact: true }).check()
    await page.getByRole("button", { name: "Cấu hình DSe", exact: true }).click()
    await expect(page.getByRole("radio", { name: algorithm, exact: true })).toBeChecked()
    // Load must apply the current selection even before the configuration is saved.
    const before = await (await request.get(`${api}/streams/${streamId}/overview`)).json()
    expect(before.configuration.algorithm).toBe(previousAlgorithm)
    await page.getByRole("button", { name: "Nạp DSe", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Danh sách (6 giao dịch)", exact: true })).toBeVisible()
    await expect(page.getByRole("radio", { name: algorithm, exact: true })).toBeChecked()

    const loaded = await (await request.get(`${api}/streams/${streamId}/overview`)).json()
    expect(loaded).toMatchObject({
      transactionCount: 6,
      configuration: { algorithm: apiAlgorithm, config: { paneSize: 2, windowPaneCount: 2, minWus: 0.5 } },
      latestRun: { algorithm: apiAlgorithm, windowId: 2 },
    })
    const history = await (await request.get(`${api}/streams/${streamId}/results`)).json()
    expect(history).toHaveLength(2)
    expect(history.every((run: { algorithm: string }) => run.algorithm === apiAlgorithm)).toBe(true)
    const comparisonResponse = await request.post(`${api}/streams/${streamId}/comparisons`, {
      data: loaded.configuration.config,
    })
    expect(comparisonResponse.ok()).toBe(true)
    const comparison = await comparisonResponse.json()
    expect(comparison).toMatchObject({ equivalent: true, oracleVerified: true })
    expect(loaded.latestRun.patterns).toEqual(comparison.oracle.patterns)

    await page.getByRole("button", { name: "Kết quả", exact: true }).click()
    await expect(page.getByTestId("stream-live-status").getByText(algorithm, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("button", { name: "Stream mới", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
    await page.getByRole("button", { name: "Cấu hình luồng", exact: true }).click()
    await expect(page.getByRole("radio", { name: algorithm, exact: true })).toBeChecked()
    await page.getByRole("button", { name: "Nạp DSe", exact: true }).click()
    await page.getByRole("button", { name: "Thay bằng DSe", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByRole("radio", { name: algorithm, exact: true })).toBeChecked()
    const replaced = await (await request.get(`${api}/streams/${streamId}/overview`)).json()
    expect(replaced.transactionCount).toBe(6)
    expect(replaced.latestRun.algorithm).toBe(apiAlgorithm)
    expect(replaced.latestRun.patterns).toEqual(comparison.oracle.patterns)
  })
}
