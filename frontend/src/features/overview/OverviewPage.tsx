import { Activity, ArrowRight, Boxes, GitBranch, Layers3, Plus, RefreshCw } from "lucide-react"
import { Button, Card, ErrorBanner, PageHeading, formatNumber } from "../../components/ui"
import { streamStatus } from "../../components/streamStatus"
import { useApp } from "../../app/AppProvider"

export default function OverviewPage() {
  const { overview, liveSnapshot, error, status, refresh, newStream, setPage, replay } = useApp()
  const config = overview?.configuration.config
  const phase = streamStatus(replay, !!overview?.miningError)
  const snapshot = liveSnapshot?.sessionId === overview?.configuration.sessionId ? liveSnapshot : null
  const latest = snapshot?.ct ?? overview?.latestRun
  const stats = [
    ["Giao dịch đã nhận", overview?.transactionCount ?? 0, Boxes],
    ["Pane hoàn tất", overview?.completedPaneCount ?? 0, Layers3],
    ["Cửa sổ mới nhất", latest ? `#${latest.windowId}` : "—", Activity],
  ] as const

  return <>
    <PageHeading title="Tổng quan" description="Dữ liệu, tiến độ và kết quả của hai thuật toán trong cùng một luồng." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => void refresh().catch(() => undefined)} disabled={status === "loading"}><RefreshCw size={15}/>Làm mới</Button><Button onClick={() => void newStream().catch(() => undefined)} disabled={status === "loading"}><Plus size={16}/>Stream mới</Button></div>}/>
    <ErrorBanner message={error ?? overview?.miningError ?? null}/>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-600">FWUDS-CT + FWUDS-DWT <span className="ml-1 text-slate-400">· chạy song song</span></span><span className={`rounded-full px-3 py-1.5 font-medium ring-1 ring-inset ${phase.color}`}>{phase.label}</span></div>
    <div className="grid gap-3 sm:grid-cols-3">{stats.map(([label,value,Icon]) => <Card key={label}><div className="flex items-center justify-between"><p className="text-sm text-slate-600">{label}</p><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon size={17}/></span></div><p className="mt-2 text-3xl font-semibold tracking-tight tnum">{typeof value === "number" ? formatNumber(value) : value}</p></Card>)}</div>
    <Card className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Luồng hiện tại</h2><p className="mt-1 text-xs text-slate-600">{config ? `${config.windowPaneCount} pane × ${formatNumber(config.paneSize)} giao dịch · minWUS ${config.minWus}` : "Đang tải cấu hình…"}</p></div><Button variant="secondary" onClick={() => setPage("transactions")}><Boxes size={15}/>Nạp dữ liệu</Button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[{label:"Pane đang nhận",value:overview?.metrics.bufferedTransactions ?? 0,max:config?.paneSize ?? 0,unit:"giao dịch"},{label:"Dữ liệu trong cửa sổ",value:Math.max(0,(overview?.metrics.retainedTransactions ?? 0)-(overview?.metrics.bufferedTransactions ?? 0)),max:(config?.paneSize ?? 0)*(config?.windowPaneCount ?? 0),unit:"giao dịch"}].map(item => <div key={item.label} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-600">{item.label}</span><span className="font-medium tnum">{formatNumber(item.value)} / {formatNumber(item.max)}</span></div><progress aria-label={item.label} className="mt-3 h-1.5 w-full accent-blue-600" max={item.max || 1} value={Math.min(item.value,item.max)}/></div>)}
      </div>
      {(overview?.transactionCount ?? 0) === 0 && <p className="mt-3 text-xs text-slate-600">Chưa có dữ liệu trong luồng. Chọn Retail, Accidents hoặc DSe tại tab Giao dịch.</p>}
    </Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["ct","dwt"] as const).map(algorithm => {
      const result = snapshot?.[algorithm]
      const Icon = algorithm === "ct" ? Layers3 : GitBranch
      const name = algorithm === "ct" ? "FWUDS-CT" : "FWUDS-DWT"
      return <button key={algorithm} onClick={() => setPage(algorithm)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30 sm:p-5">
        <div className="flex items-center gap-2"><Icon size={17} className={algorithm === "ct" ? "text-blue-600" : "text-teal-600"}/><h2 className="font-semibold">{name}</h2><ArrowRight size={16} className="ml-auto text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600"/></div>
        <p className="mt-3 text-2xl font-semibold tnum">{result ? formatNumber(result.patternCount) : "—"} <span className="text-sm font-normal text-slate-600">mẫu đạt minWUS</span></p>
        <p className="mt-1 text-xs text-slate-600">{result ? `Cửa sổ #${result.windowId} · ${formatNumber(result.windowTransactionCount)} giao dịch` : "Kết quả xuất hiện khi đủ cửa sổ đầu tiên."}</p>
      </button>
    })}</div>
    <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Số liệu xử lý</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{[["Xử lý và lưu kết quả",`${formatNumber(overview?.metrics.processingTimeMs ?? 0,2)} ms`],["Lưu giao dịch",`${formatNumber(overview?.metrics.archiveTimeMs ?? 0,2)} ms`],["Heap JVM lấy mẫu",`${formatNumber((overview?.metrics.peakHeapBytes ?? 0)/1048576,2)} MiB`]].map(([label,value]) => <div key={label}><p className="text-xs text-slate-600">{label}</p><p className="mt-1 font-medium tnum">{value}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Heap gồm toàn bộ backend. Xem số đo riêng của CT và DWT tại tab So sánh.</p></details>
  </>
}
