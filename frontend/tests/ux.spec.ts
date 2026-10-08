import { test, expect } from "@playwright/test"

test("transaction drafts, item focus, validation, search, details and reset confirmation", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Stream mới", exact: true }),
  ).toBeEnabled()
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(3)
  await expect(
    page.getByRole("button", { name: "So sánh", exact: true }),
  ).toHaveCount(0)
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
  await page.getByRole("button", { name: "Kết quả", exact: true }).click()
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
  await page.getByRole("button", { name: "Giao dịch", exact: true }).click()
  await page
    .getByRole("button", { name: "Cấu hình luồng", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Cấu hình Chainstore", exact: true })
    .click()
  await expect(page.getByLabel("Kích thước pane")).toHaveValue("1000")
  await page.getByLabel("Số pane trong window").fill("101")
  await expect(page.getByRole("alert")).toContainText("cửa sổ tối đa 100.000")
  await expect(
    page.getByRole("button", { name: "Bắt đầu Chainstore", exact: true }),
  ).toBeDisabled()
  await page
    .getByRole("button", { name: "Hoàn tác thay đổi", exact: true })
    .click()
  await expect(page.getByLabel("Kích thước pane")).toHaveValue("2")
  await expect(page.getByLabel("Số pane trong window")).toHaveValue("2")
  await page
    .getByRole("button", { name: "Cấu hình Chainstore", exact: true })
    .click()
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
