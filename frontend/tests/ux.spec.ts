import { test, expect } from "@playwright/test"

test("transaction drafts, item focus, validation, search, details and reset confirmation", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Stream mới", exact: true }),
  ).toBeEnabled()
  await expect(page.getByText("Khám phá CartLens với vài bước đơn giản")).toHaveCount(0)
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(6)
  await expect(
    page.getByRole("button", { name: "So sánh", exact: true }),
  ).toHaveCount(1)
  await expect(
    page.getByRole("button", { name: "Khai phá", exact: true }),
  ).toHaveCount(0)
  await expect(page.getByLabel("Kích thước pane")).toBeHidden()
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click()
  await page.getByLabel("Mã giao dịch", { exact: true }).fill("7")
  await page.getByLabel("Mã sản phẩm", { exact: true }).fill("A")
  await page.getByLabel("Tên sản phẩm", { exact: true }).fill("Cà phê")
  await page.getByLabel("Số lượng", { exact: true }).fill("2")
  await page.getByRole("button", { name: "FWUDS-DWT", exact: true }).click()
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click()
  await expect(page.getByLabel("Mã giao dịch", { exact: true })).toHaveValue(
    "7",
  )
  await expect(page.getByLabel("Tên sản phẩm", { exact: true })).toHaveValue(
    "Cà phê",
  )
  await page.getByRole("button", { name: "Thêm sản phẩm", exact: true }).click()
  await expect(
    page.getByLabel("Mã sản phẩm", { exact: true }).nth(1),
  ).toBeFocused()
  await page.getByLabel("Mã sản phẩm", { exact: true }).nth(1).fill("A")
  await page.getByLabel("Tên sản phẩm", { exact: true }).nth(1).fill("Cà phê")
  await page.getByRole("button", { name: "Lưu giao dịch", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Mã sản phẩm bị trùng")
  await page
    .getByRole("button", { name: "Xóa sản phẩm 2", exact: true })
    .click()
  await page.getByRole("button", { name: "Lưu giao dịch", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu giao dịch 7." }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Danh sách (1 giao dịch)", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Chi tiết giao dịch 7", exact: true })
    .click()
  await expect(
    page.getByRole("cell", { name: "A Cà phê", exact: true }),
  ).toBeVisible()
  await page.getByLabel("Tìm giao dịch trong trang").fill("cà phê")
  await expect(
    page.getByRole("button", { name: "Chi tiết giao dịch 7", exact: true }),
  ).toBeVisible()
  await page.getByLabel("Tìm giao dịch trong trang").fill("missing")
  await expect(
    page.getByText("Không có giao dịch khớp trên trang này.", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).click()
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click()
  await expect(page.getByLabel("Mã giao dịch", { exact: true })).toHaveValue("")
  await page.getByRole("button", { name: "Thu gọn", exact: true }).click()
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Hủy", exact: true }),
  ).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(
    page.getByRole("heading", { name: "Danh sách (1 giao dịch)", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Nạp DSe", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Thay dữ liệu bằng DSe?")
  await page.getByRole("button", { name: "Hủy", exact: true }).click()
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await page.getByRole("button", { name: "Xóa dữ liệu", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Danh sách (0 giao dịch)", exact: true }),
  ).toBeVisible()
})

test("transaction configuration, mining progress and undo work on mobile without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Stream mới", exact: true }),
  ).toBeEnabled()
  await page.getByRole("button", { name: "Mở menu", exact: true }).click()
  await expect(page.getByRole("navigation").getByRole("button", {name:"Tổng quan",exact:true})).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(page.getByRole("button", {name:"Đóng menu",exact:true})).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(page.getByRole("navigation").getByRole("button", {name:"So sánh",exact:true})).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("navigation")).toBeHidden()
  await expect(page.getByRole("button", { name: "Mở menu", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Mở menu", exact: true }).click()
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await page
    .getByRole("button", { name: "Chỉnh cấu hình", exact: true })
    .click()
  await page.getByLabel("Kích thước pane").fill("1000")
  await page.getByLabel("Số pane trong window").fill("4")
  await page.getByLabel("Ngưỡng minWus").fill("0.005")
  await expect(page.getByLabel("Kích thước pane")).toHaveValue("1000")
  await page.getByLabel("Số pane trong window").fill("101")
  await expect(page.getByRole("alert")).toContainText("cửa sổ tối đa 100.000")
  await expect(
    page.getByRole("button", { name: "Bắt đầu Retail", exact: true }),
  ).toBeDisabled()
  await page
    .getByRole("button", { name: "Hoàn tác thay đổi", exact: true })
    .click()
  await expect(page.getByLabel("Kích thước pane")).toHaveValue("2")
  await expect(page.getByLabel("Số pane trong window")).toHaveValue("2")
  await page.getByLabel("Kích thước pane").fill("1000")
  await page.getByLabel("Số pane trong window").fill("4")
  await page.getByLabel("Ngưỡng minWus").fill("0.005")
  await page.getByRole("button", { name: "Lưu cấu hình", exact: true }).click()
  await expect(
    page.getByText("Đã lưu cấu hình.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("progressbar", { name: "Tiến độ cửa sổ đầu tiên" }),
  ).toHaveAttribute("max", "4000")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: "../tmp/ux-configuration-mobile.png",
    fullPage: true,
  })
  await page.getByRole("button", { name: "Mở menu", exact: true }).click()
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click()
  await page.getByRole("button", { name: "Thêm sản phẩm", exact: true }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("pattern details preserve values, paging adapts to height, and comparison supports keyboard selection", async ({page}) => {
  await page.goto("/")
  await expect(page.getByRole("button", {name:"Stream mới",exact:true})).toBeEnabled()
  await page.getByRole("navigation").getByRole("button", {name:"Giao dịch",exact:true}).click()
  await page.getByRole("button", {name:"Nạp DSe",exact:true}).click()
  await expect(page.getByRole("heading", {name:"Danh sách (6 giao dịch)",exact:true})).toBeVisible()
  await page.getByRole("navigation").getByRole("button", {name:"FWUDS-CT",exact:true}).click()
  const table = page.getByTestId("pattern-table")
  const firstPattern = table.getByRole("button", {name:"Xem mẫu {A}",exact:true})
  await firstPattern.click()
  const details = page.getByRole("dialog", {name:"Chi tiết mẫu",exact:true})
  await expect(details.getByText("{A}",{exact:true})).toBeVisible()
  await expect(details).toContainText("FWUDS-CT · cửa sổ #2")
  await expect(details.locator("dd").last()).toHaveText("3")
  await expect(details.getByText("4",{exact:true})).toBeVisible()
  await expect(details.getByText("6",{exact:true})).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(details).toBeHidden()
  await expect(firstPattern).toBeFocused()
  await page.getByRole("button", {name:"Trang sau kết quả",exact:true}).click()
  await expect(firstPattern).toHaveCount(0)
  await page.setViewportSize({width:1280,height:600})
  await expect(firstPattern).toBeVisible()
  await expect(table).toHaveAttribute("aria-busy","false")
  await page.getByRole("navigation").getByRole("button", {name:"So sánh",exact:true}).click()
  const chart = page.getByRole("img", {name:"Thời gian thực thi: FWUDS-CT và FWUDS-DWT",exact:true})
  const windows = page.getByLabel("Cửa sổ đang xem",{exact:true})
  await expect(windows.locator("option")).toHaveCount(3)
  await chart.focus()
  await page.keyboard.press("Home")
  await expect(windows).toHaveValue("1")
  await page.keyboard.press("ArrowRight")
  await expect(windows).toHaveValue("2")
  await page.keyboard.press("ArrowLeft")
  await expect(windows).toHaveValue("1")
  await page.getByRole("button", {name:"Theo dõi mới nhất",exact:true}).click()
  await expect(windows).toHaveValue("latest")
  await page.getByLabel("Phép đo bộ nhớ",{exact:true}).selectOption("allocated")
  await expect(page.getByRole("img", {name:"Bộ nhớ cấp phát: FWUDS-CT và FWUDS-DWT",exact:true})).toBeVisible()
  await page.getByRole("checkbox",{name:"Trục log₂",exact:true}).check()
  const method = page.getByRole("button",{name:"Phương pháp đo",exact:true})
  await method.click()
  await expect(page.getByRole("dialog",{name:"Phương pháp đo",exact:true})).toContainText("không phải bộ nhớ đỉnh")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(method).toBeFocused()
})
