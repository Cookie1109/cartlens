import { useApp } from "../../app/AppProvider"
import { Card, formatNumber } from "../../components/ui"
import { toUiAlgorithm } from "../../services/cartLensApi"

const states: Record<string, { label: string; color: string }> = {
  RUNNING: { label: "Đang chạy", color: "bg-emerald-500" },
  PAUSING: { label: "Đang tạm dừng", color: "bg-amber-500" },
  PAUSED: { label: "Đã tạm dừng", color: "bg-amber-500" },
  STOPPING: { label: "Đang dừng", color: "bg-amber-500" },
  STOPPED: { label: "Đã dừng", color: "bg-slate-400" },
  COMPLETED: { label: "Hoàn tất", color: "bg-blue-500" },
  FAILED: { label: "Có lỗi", color: "bg-red-500" },
  RECOVERED: { label: "Chờ tiếp tục", color: "bg-amber-500" },
}

export default function StreamStatusCard() {
  const { overview,replay } = useApp()
  const active = overview?.configuration
  const latest = overview?.latestRun
  const paneSize = active?.config.paneSize ?? 0
  const capacity = active?.config.windowPaneCount ?? 0
  const buffered = overview?.metrics.bufferedTransactions ?? 0
  const windowPanes = paneSize > 0 ? Math.min(capacity,Math.max(0,Math.floor(((overview?.metrics.retainedTransactions ?? 0) - buffered) / paneSize))) : 0
  const phase = overview?.miningError ? states.FAILED : replay ? states[replay.state] : { label: overview ? "Chờ giao dịch" : "Đang tải", color: "bg-slate-400" }
  const paneText = paneSize > 0 ? `${formatNumber(buffered)} / ${formatNumber(paneSize)}` : "—"
  const windowText = capacity > 0 ? `${formatNumber(windowPanes)} / ${formatNumber(capacity)} pane` : "—"
  return <Card className="mb-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Theo dõi luồng</h2><span className="text-xs text-slate-500">Cập nhật mỗi giây</span></div>
    <dl data-testid="stream-live-status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="text-xs text-slate-500">Trạng thái luồng</dt><dd className="mt-2 flex items-center gap-2 font-semibold text-slate-900"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${phase.color}`}/>{phase.label}</dd></div>
      <div><dt className="text-xs text-slate-500">Thuật toán khai phá</dt><dd className="mt-2 font-semibold text-slate-900">{active ? toUiAlgorithm(active.algorithm) : "—"}</dd></div>
      <div><dt className="text-xs text-slate-500">Pane hiện tại</dt><dd className="mt-2 font-semibold text-slate-900 tnum">{paneText}<span className="ml-1 text-xs font-normal text-slate-500">giao dịch</span></dd><div role="progressbar" aria-label="Giao dịch trong pane hiện tại" aria-valuemin={0} aria-valuemax={paneSize || 1} aria-valuenow={buffered} aria-valuetext={`${paneText} giao dịch`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${paneSize > 0 ? Math.min(100,buffered / paneSize * 100) : 0}%` }}/></div></div>
      <div><dt className="text-xs text-slate-500">Cửa sổ</dt><dd className="mt-2 font-semibold text-slate-900 tnum">{windowText}</dd><div role="progressbar" aria-label="Pane hoàn tất trong cửa sổ" aria-valuemin={0} aria-valuemax={capacity || 1} aria-valuenow={windowPanes} aria-valuetext={windowText} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${capacity > 0 ? windowPanes / capacity * 100 : 0}%` }}/></div></div>
      <div><dt className="text-xs text-slate-500">Lần khai phá gần nhất</dt><dd className="mt-2 font-semibold text-slate-900 tnum">{latest ? `${formatNumber(latest.executionTimeMs)} ms` : "Chưa khai phá"}</dd><p className="mt-1 text-xs text-slate-500">Thời gian cập nhật + mining</p></div>
      <div><dt className="text-xs text-slate-500">FWUP tìm được</dt><dd className="mt-2 font-semibold text-slate-900 tnum">{latest ? formatNumber(latest.patternCount) : "—"}</dd><p className="mt-1 text-xs text-slate-500">{latest ? `Window mới nhất #${latest.windowId}` : "Chờ đủ cửa sổ đầu tiên"}</p></div>
    </dl>
    <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Đã hoàn tất {formatNumber(overview?.completedPaneCount ?? 0)} pane · Đã nhận {formatNumber(overview?.transactionCount ?? 0)} giao dịch{capacity > 0 && windowPanes < capacity ? ` · Còn ${formatNumber(capacity - windowPanes)} pane để đủ cửa sổ` : ""}.</p>
  </Card>
}
