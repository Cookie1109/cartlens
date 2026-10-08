import { useEffect, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, EmptyState, ErrorBanner, PageHeading, formatNumber, formatTransactionId } from "../../components/ui"
import StreamStatusCard from "./StreamStatusCard"
import type { PatternResult } from "../../types/api"
import { cartLensApi, toUiAlgorithm } from "../../services/cartLensApi"
export default function ResultsPage() {
  const { run,error,overview,streamId,status,history,historyAfter,loadHistory,selectRun } = useApp()
  const [patternPage,setPatternPage] = useState(0)
  useEffect(() => setPatternPage(0), [run?.runId,run?.windowId])
  const [shown,setShown] = useState<PatternResult[]>([])
  const [pageError,setPageError] = useState<string | null>(null)
  useEffect(() => {
    let disposed=false
    setShown([]); setPageError(null)
    if (streamId && run) void cartLensApi.window(streamId,run.runId,run.windowId,patternPage*100)
      .then(result => { if (!disposed) setShown(result.patterns) })
      .catch(error => { if (!disposed) setPageError(error instanceof Error ? error.message : "Không đọc được pattern.") })
    return () => { disposed=true }
  },[streamId,run?.runId,run?.windowId,patternPage])
  return <><PageHeading title="Kết quả" description="Theo dõi window mới nhất hoặc mở kết quả từng window đã lưu." action={streamId && overview?.configuration && <a className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href={cartLensApi.exportUrl(streamId, overview.configuration.sessionId)}>Xuất CSV toàn phiên</a>}/><ErrorBanner message={pageError ?? error ?? overview?.miningError ?? null}/>
    <StreamStatusCard/>
    <Card className="mb-5"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => selectRun(null)}>Theo dõi mới nhất</Button><Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(0).catch(() => undefined)}>Lịch sử window</Button>{historyAfter > 0 && <Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(Math.max(0,historyAfter - 20)).catch(() => undefined)}>20 window trước</Button>}{history.length === 20 && <Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(history[history.length - 1].windowId).catch(() => undefined)}>20 window tiếp</Button>}</div>{history.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{history.map(item => <button key={item.windowId} className={`rounded-lg border px-3 py-2 text-xs ${run?.windowId === item.windowId ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200"}`} onClick={() => selectRun(item)}>#{item.windowId} · {item.patternCount} patterns</button>)}</div>}</Card>
    {!run ? <Card><EmptyState title="Đang chờ cửa sổ đầu tiên" description="Cấu hình đã sẵn sàng. Nạp giao dịch hoặc chạy Chainstore để tạo đủ pane."/></Card> : <><p className="mb-3 text-sm font-semibold text-slate-700">Kết quả window đang xem</p><div className="mb-5 grid gap-4 sm:grid-cols-4">{[["Thuật toán",toUiAlgorithm(run.algorithm)],["Window",`#${run.windowId}`],["Patterns",run.patternCount],["Cập nhật + mining",`${formatNumber(run.executionTimeMs)} ms`]].map(([label,value]) => <Card key={String(label)}><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tnum">{value}</p></Card>)}</div>
    <Card><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Trang pattern {patternPage + 1} · tối đa 100 dòng/trang</span><div className="flex gap-2"><Button variant="secondary" disabled={patternPage === 0} onClick={() => setPatternPage(p => p - 1)}>Trước</Button><Button variant="secondary" disabled={(patternPage + 1) * 100 >= run.patternCount} onClick={() => setPatternPage(p => p + 1)}>Sau</Button></div></div>{run.patternCount === 0 ? <EmptyState title="Không có FWUP" description="Không pattern nào đạt ngưỡng minWus hiện tại."/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Pattern</th><th className="pb-3 text-right">WUS</th><th className="pb-3 text-right">Support</th><th className="pb-3 pl-6">Transactions</th></tr></thead><tbody>{shown.map(pattern => <tr key={JSON.stringify(pattern.items)} className="border-b border-slate-100 last:border-0"><td className="py-3 font-mono text-blue-700">{`{${pattern.items.join(", ")}}`}</td><td className="py-3 text-right font-medium tnum">{formatNumber(pattern.wus)}</td><td className="py-3 text-right tnum">{pattern.support}</td><td className="max-w-64 py-3 pl-6 font-mono text-xs text-slate-500"><details><summary className="cursor-pointer">{pattern.transactionIds.length} giao dịch</summary><p className="mt-2 max-h-40 overflow-auto break-words">{pattern.transactionIds.map(formatTransactionId).join(", ")}</p></details></td></tr>)}</tbody></table></div>}</Card></>}
  </>
}
