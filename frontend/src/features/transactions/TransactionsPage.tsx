import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { useApp } from "../../app/AppProvider"
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeading,
  formatNumber,
  formatTransactionId,
  inputClass,
} from "../../components/ui"
import type { UiAlgorithm } from "../../types/api"
import ReplayPanel from "./ReplayPanel"
import TransactionForm from "./TransactionForm"

export default function TransactionsPage() {
  const {
    transactions,
    reset,
    loadDemo,
    error,
    status,
    overview,
    replayActive,
    transactionAfter,
    loadTransactionPage,
    streamId,
    setPage,
    algorithm,
  } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<"reset" | "demo" | null>(
    null,
  )
  const dialogRef = useRef<HTMLDialogElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const busy = status === "loading"
  const count = overview?.transactionCount ?? transactions.length
  const pageCount = Math.max(1, Math.ceil(count / 100))
  const currentPage = Math.floor(transactionAfter / 100) + 1
  const query = search.trim().toLocaleLowerCase("vi-VN")
  const rows = transactions.filter((tx) =>
    `${formatTransactionId(tx.id)} ${tx.items.map((item) => `${item.itemId} ${item.name}`).join(" ")}`
      .toLocaleLowerCase("vi-VN")
      .includes(query),
  )
  useEffect(() => {
    setShowForm(false)
    setSearch("")
    setExpandedId(null)
    setNotice(null)
    setConfirmation(null)
  }, [streamId])
  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = 0
  }, [transactionAfter, query])
  const [selectedDemoAlgo, setSelectedDemoAlgo] = useState<UiAlgorithm>(algorithm)
  useEffect(() => {
    setSelectedDemoAlgo(algorithm)
  }, [algorithm, confirmation])
  useEffect(() => {
    if (confirmation) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [confirmation])
  const execute = async (action: "reset" | "demo", demoAlgo?: UiAlgorithm) => {
    try {
      const chosenAlgo = demoAlgo ?? selectedDemoAlgo
      await (action === "demo" ? loadDemo(chosenAlgo) : reset())
      setConfirmation(null)
      setSearch("")
      setExpandedId(null)
      setNotice(
        action === "demo"
          ? `Đã nạp dữ liệu DSe với thuật toán ${chosenAlgo} và cấu hình mẫu.`
          : "Đã xóa dữ liệu của stream hiện tại.",
      )
    } catch {
      setConfirmation(null)
    }
  }
  return (
    <>
      <PageHeading
        title="Giao dịch"
        description="Nhập dữ liệu, kiểm tra sản phẩm và theo dõi giao dịch trong stream."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!overview?.latestRun}
              onClick={() => setPage("results")}
            >
              <BarChart3 size={16} />
              Xem kết quả
            </Button>
            <Button
              onClick={() => {
                setShowForm(true)
                setNotice(null)
              }}
              disabled={busy || replayActive}
            >
              <Plus size={16} />
              Thêm giao dịch
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error ?? overview?.miningError ?? null} />
      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="rounded p-1 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label="Đóng thông báo"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <ReplayPanel />
      {showForm && (
        <TransactionForm
          key={streamId}
          onClose={() => setShowForm(false)}
          onSaved={(id) => {
            setShowForm(false)
            setNotice(`Đã lưu giao dịch ${id}.`)
            setSearch("")
          }}
        />
      )}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              Danh sách ({formatNumber(count)} giao dịch)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Dữ liệu tự cập nhật khi luồng đang chạy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                count ? setConfirmation("demo") : void execute("demo", algorithm)
              }
              disabled={busy || replayActive}
            >
              <Sparkles size={16} />
              Nạp DSe
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmation("reset")}
              disabled={!count || busy || replayActive}
            >
              <RotateCcw size={16} />
              Reset
            </Button>
          </div>
        </div>
        {count > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
              />
              <input
                type="search"
                aria-label="Tìm giao dịch trong trang"
                placeholder="Tìm mã giao dịch, sản phẩm…"
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="text-xs text-slate-500">
              {query
                ? `${rows.length}/${transactions.length} giao dịch khớp trên trang này`
                : "Tìm kiếm trong trang đang xem"}
            </span>
          </div>
        )}
        <div className="mt-4">
          {transactions.length === 0 ? (
            <EmptyState
              title="Chưa có giao dịch"
              description="Thêm giao dịch thủ công, nạp DSe để thử nhanh hoặc mở Cấu hình luồng để chạy Chainstore."
            />
          ) : rows.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">
                Không có giao dịch khớp trên trang này.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => setSearch("")}
              >
                Xóa tìm kiếm
              </Button>
            </div>
          ) : (
            <div
              ref={tableRef}
              tabIndex={0}
              role="region"
              aria-label="Bảng giao dịch"
              className="max-h-[560px] overflow-auto overscroll-contain rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Giao dịch trên trang {currentPage}. Mở từng giao dịch để xem
                  số lượng và trọng số sản phẩm.
                </caption>
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4">Mã giao dịch</th>
                    <th className="pb-3 pr-4">Sản phẩm</th>
                    <th className="pb-3 text-right">
                      <abbr
                        title="Trung bình tổng trọng số × số lượng của các sản phẩm"
                        className="cursor-help no-underline"
                      >
                        TWU
                      </abbr>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tx) => (
                    <Fragment key={tx.id}>
                      <tr className="border-b border-slate-100">
                        <td className="py-3 pr-4 align-top">
                          <button
                            className="flex min-h-9 items-center gap-2 rounded px-1 font-mono font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"
                            aria-label={`Chi tiết giao dịch ${formatTransactionId(tx.id)}`}
                            aria-expanded={expandedId === tx.id}
                            aria-controls={`transaction-${tx.id}`}
                            onClick={() =>
                              setExpandedId(expandedId === tx.id ? null : tx.id)
                            }
                          >
                            <span>{formatTransactionId(tx.id)}</span>
                            <ChevronDown
                              size={14}
                              className={`shrink-0 transition ${
                                expandedId === tx.id ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1.5">
                            {tx.items.slice(0, 6).map((item) => (
                              <span
                                key={item.itemId}
                                className="max-w-40 truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                                title={item.name}
                              >
                                {item.itemId} × {item.quantity}
                              </span>
                            ))}
                            {tx.items.length > 6 && (
                              <span className="py-1 text-xs text-slate-500">
                                +{tx.items.length - 6} sản phẩm
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right align-top tnum">
                          {formatNumber(tx.twu, 4)}
                        </td>
                      </tr>
                      {expandedId === tx.id && (
                        <tr
                          id={`transaction-${tx.id}`}
                          className="border-b border-slate-100 bg-slate-50"
                        >
                          <td colSpan={3} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-80 text-xs">
                                <caption className="mb-3 text-left font-medium text-slate-600">
                                  Chi tiết giao dịch{" "}
                                  {formatTransactionId(tx.id)}
                                </caption>
                                <thead className="text-slate-500">
                                  <tr>
                                    <th className="pb-2 pr-3">Sản phẩm</th>
                                    <th className="pb-2 pr-3 text-right">
                                      Số lượng
                                    </th>
                                    <th className="pb-2 text-right">
                                      Trọng số
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tx.items.map((item) => (
                                    <tr key={item.itemId}>
                                      <td className="py-1.5 pr-3">
                                        <span className="font-mono">
                                          {item.itemId}
                                        </span>
                                        {item.name !== item.itemId && (
                                          <span className="ml-2 text-slate-500">
                                            {" "}
                                            {item.name}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right tnum">
                                        {formatNumber(item.quantity)}
                                      </td>
                                      <td className="py-1.5 text-right tnum">
                                        {formatNumber(item.weight)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            {transactions.length
              ? `${formatNumber(transactionAfter + 1)}–${formatNumber(transactionAfter + transactions.length)} / ${formatNumber(count)} giao dịch`
              : "0 giao dịch"}{" "}
            · Trang {currentPage}/{formatNumber(pageCount)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              aria-label="Trang trước"
              disabled={busy || transactionAfter === 0}
              onClick={() => {
                setExpandedId(null)
                void loadTransactionPage(
                  Math.max(0, transactionAfter - 100),
                ).catch(() => undefined)
              }}
            >
              <ChevronLeft size={16} />
              Trước
            </Button>
            <Button
              variant="secondary"
              aria-label="Trang sau"
              disabled={busy || transactionAfter + transactions.length >= count}
              onClick={() => {
                setExpandedId(null)
                void loadTransactionPage(transactionAfter + 100).catch(
                  () => undefined,
                )
              }}
            >
              Sau
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
      <dialog
        ref={dialogRef}
        aria-labelledby="replace-data-title"
        aria-describedby="replace-data-description"
        onCancel={(event) => {
          if (busy) event.preventDefault()
          else setConfirmation(null)
        }}
        onClose={() => setConfirmation(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-950/40"
      >
        <h2 id="replace-data-title" className="text-lg font-semibold">
          {confirmation === "demo"
            ? "Thay dữ liệu bằng DSe?"
            : "Xóa dữ liệu stream?"}
        </h2>
        <p
          id="replace-data-description"
          className="mt-3 text-sm leading-relaxed text-slate-600"
        >
          {confirmation === "demo"
            ? `Thao tác sẽ xóa ${formatNumber(count)} giao dịch và lịch sử khai phá của stream hiện tại, rồi nạp 6 giao dịch DSe cùng cấu hình mẫu (pane=2, window=2 pane, minWus=0.5).`
            : `Thao tác sẽ xóa ${formatNumber(count)} giao dịch và lịch sử khai phá của stream hiện tại. Không thể hoàn tác.`}
        </p>
        {confirmation === "demo" && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-700">
              Thuật toán khai phá DSe:
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["FWUDS-CT", "FWUDS-DWT"] as const).map((algo) => (
                <label
                  key={algo}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors ${
                    selectedDemoAlgo === algo
                      ? "border-blue-500 bg-blue-50/60 font-medium text-blue-950 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="selectedDemoAlgo"
                    value={algo}
                    checked={selectedDemoAlgo === algo}
                    onChange={() => setSelectedDemoAlgo(algo)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="font-semibold">{algo}</div>
                    <div className="text-[11px] text-slate-500">
                      {algo === "FWUDS-CT"
                        ? "Cấu trúc CTset"
                        : "Cây DSWUN"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            autoFocus
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={busy || replayActive}
            onClick={() => confirmation && void execute(confirmation, selectedDemoAlgo)}
          >
            {busy
              ? "Đang xử lý…"
              : confirmation === "demo"
                ? "Thay bằng DSe"
                : "Xóa dữ liệu"}
          </Button>
        </div>
      </dialog>
    </>
  )
}
