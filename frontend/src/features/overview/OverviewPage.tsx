import { Activity, ArrowRight, Boxes, Layers3, Sparkles } from "lucide-react"
import { Button, Card, ErrorBanner, PageHeading, formatNumber } from "../../components/ui"
import { useApp } from "../../app/AppProvider"
export default function OverviewPage() {
  const { overview, run, error, status, refresh, newStream, setPage, loadDemo } = useApp()
  const latest = overview?.latestRun ?? run
  const transactionCount = overview?.transactionCount ?? 0
  const stats = [
    ["Giao dịch", transactionCount, Boxes, "Các bản ghi đã nhận vào luồng."],
    ["Pane hoàn tất", overview?.completedPaneCount ?? "—", Layers3, "Nhóm giao dịch đã đủ số lượng."],
    ["FWUP tìm thấy", latest?.patternCount ?? "—", Activity, "Mẫu hữu ích trong cửa sổ mới nhất."],
  ] as const

  return <>
    <PageHeading title="Tổng quan" description="Theo dõi dữ liệu và kết quả khai phá trong luồng hiện tại." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void refresh().catch(() => undefined)} disabled={status === "loading"}>Làm mới</Button><Button variant="secondary" onClick={() => void newStream().catch(() => undefined)} disabled={status === "loading"}>Stream mới</Button></div>} />
    <ErrorBanner message={error ?? overview?.miningError ?? null} />
    {transactionCount === 0 && <Card className="mb-5 overflow-hidden border-blue-100 bg-gradient-to-br from-white to-blue-50/70">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"><Sparkles size={14} />Bắt đầu tại đây</div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">Khám phá CartLens với vài bước đơn giản</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Nạp dữ liệu mẫu để xem cách hệ thống nhóm giao dịch và tìm các nhóm sản phẩm thường xuất hiện cùng nhau.</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <p><span className="mr-2 font-semibold text-blue-700">1.</span>Chọn dữ liệu mẫu hoặc nhập giao dịch</p>
            <p><span className="mr-2 font-semibold text-blue-700">2.</span>Chờ đủ dữ liệu để khai phá</p>
            <p><span className="mr-2 font-semibold text-blue-700">3.</span>Mở Kết quả để xem các mẫu</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-52">
          <Button onClick={() => void loadDemo().catch(() => undefined)} disabled={status === "loading"}><Sparkles size={16} />Nạp dữ liệu mẫu DSe</Button>
          <Button variant="secondary" onClick={() => setPage("transactions")}><ArrowRight size={16} />Tự nhập giao dịch</Button>
        </div>
      </div>
    </Card>}
    <div className="grid gap-4 sm:grid-cols-3">{stats.map(([label, value, Icon, description]) => <Card key={label}><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{label}</p><Icon className="text-blue-600" size={20} /></div><p className="mt-3 text-3xl font-bold text-slate-950 tnum">{typeof value === "number" ? formatNumber(value) : value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></Card>)}</div>
    <Card className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Tiến độ luồng</h2><p className="mt-1 text-sm text-slate-500">Một cửa sổ kết quả xuất hiện khi các pane đã nhận đủ giao dịch.</p></div><Button variant="secondary" onClick={() => setPage("results")}><Activity size={16} />Xem kết quả</Button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Giao dịch đang giữ</p><p className="mt-1 text-lg font-semibold tnum">{formatNumber(overview?.metrics.retainedTransactions ?? 0)}</p><p className="mt-1 text-xs text-slate-500">Dữ liệu đang nằm trong cửa sổ hiện tại.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Đang chờ đủ pane</p><p className="mt-1 text-lg font-semibold tnum">{formatNumber(overview?.metrics.bufferedTransactions ?? 0)}</p><p className="mt-1 text-xs text-slate-500">Giao dịch chờ để hoàn tất một pane.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Cửa sổ mới nhất</p><p className="mt-1 text-lg font-semibold tnum">{latest ? `#${latest.windowId}` : "Chưa có"}</p><p className="mt-1 text-xs text-slate-500">Kết quả được cập nhật tự động.</p></div>
      </div>
      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">Số liệu kỹ thuật</summary>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">{[["Xử lý + lưu kết quả", `${formatNumber(overview?.metrics.processingTimeMs ?? 0, 2)} ms`], ["Lưu giao dịch", `${formatNumber(overview?.metrics.archiveTimeMs ?? 0, 2)} ms`], ["Heap đỉnh lấy mẫu", `${formatNumber((overview?.metrics.peakHeapBytes ?? 0) / 1024 / 1024, 2)} MiB`]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold tnum">{value}</p></div>)}</div>
        <p className="mt-3 text-xs text-slate-500">Heap là số đo toàn JVM, gồm các stream và cache lưu trữ đang mở.</p>
      </details>
    </Card>
  </>
}
