import { useEffect, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, EmptyState, ErrorBanner, PageHeading, formatNumber, formatTransactionId } from "../../components/ui"
import StreamStatusCard from "./StreamStatusCard"
import type { PatternResult } from "../../types/api"
import { cartLensApi, toUiAlgorithm } from "../../services/cartLensApi"
export default function ResultsPage() {
  const { run,error,overview,streamId,status,history,historyAfter,loadHistory,selectRun,setPage } = useApp()
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
  return <><PageHeading title="Kết quả" description="Xem các nhóm sản phẩm được tìm thấy trong từng cửa sổ dữ liệu." action={streamId && overview?.configuration && <a className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={cartLensApi.exportUrl(streamId, overview.configuration.sessionId)}>Xuất CSV toàn phiên</a>}/><ErrorBanner message={pageError ?? error ?? overview?.miningError ?? null}/>
    <StreamStatusCard/>
    <details className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-blue-900">Cách đọc kết quả</summary>
      <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <p><strong className="text-slate-800">Pattern</strong><br/>Nhóm sản phẩm thường xuất hiện cùng nhau.</p>
        <p><strong className="text-slate-800">WUS</strong><br/>Mức độ hữu ích của nhóm sản phẩm; giá trị cao hơn nghĩa là hữu ích hơn theo dữ liệu.</p>
        <p><strong className="text-slate-800">Support</strong><br/>Số giao dịch có chứa nhóm sản phẩm này.</p>
      </div>
      <p className="mt-3 text-xs text-slate-500">Mỗi window là một phần dữ liệu được khai phá riêng. Chọn một window bên dưới để xem lại kết quả đã lưu.</p>
    </details>
    <Card className="mb-5"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => selectRun(null)}>Theo dõi mới nhất</Button><Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(0).catch(() => undefined)}>Tải lịch sử cửa sổ</Button>{historyAfter > 0 && <Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(Math.max(0,historyAfter - 20)).catch(() => undefined)}>20 cửa sổ trước</Button>}{history.length === 20 && <Button variant="secondary" disabled={status === "loading"} onClick={() => void loadHistory(history[history.length - 1].windowId).catch(() => undefined)}>20 cửa sổ tiếp</Button>}</div>{history.length > 0 && <><p className="mt-3 text-xs text-slate-500">Chọn một cửa sổ để xem lại các mẫu đã lưu.</p><div className="mt-2 flex flex-wrap gap-2">{history.map(item => <button key={item.windowId} className={`min-h-9 rounded-lg border px-3 py-2 text-xs ${run?.windowId === item.windowId ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => selectRun(item)}>#{item.windowId} · {item.patternCount} mẫu</button>)}</div></>}</Card>
    {!run ? <Card><EmptyState title="Chưa có kết quả để hiển thị" description="Nạp dữ liệu mẫu, thêm giao dịch hoặc chạy Chainstore. Khi đủ dữ liệu, CartLens sẽ tự khai phá và hiển thị kết quả ở đây."/><div className="mt-4 flex justify-center"><Button onClick={() => setPage("transactions")}>Đi tới Giao dịch</Button></div></Card> : <><p className="mb-3 text-sm font-semibold text-slate-700">Kết quả cửa sổ đang xem</p><div className="mb-5 grid gap-4 sm:grid-cols-4">{[["Thuật toán",toUiAlgorithm(run.algorithm)],["Cửa sổ",`#${run.windowId}`],["Số mẫu",run.patternCount],["Thời gian khai phá",`${formatNumber(run.executionTimeMs)} ms`]].map(([label,value]) => <Card key={String(label)}><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tnum">{value}</p></Card>)}</div>
    <Card><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Trang {patternPage + 1} · tối đa 100 mẫu mỗi trang</span><div className="flex gap-2"><Button variant="secondary" disabled={patternPage === 0} onClick={() => setPatternPage(p => p - 1)}>Trước</Button><Button variant="secondary" disabled={(patternPage + 1) * 100 >= run.patternCount} onClick={() => setPatternPage(p => p + 1)}>Sau</Button></div></div>{run.patternCount === 0 ? <EmptyState title="Không có mẫu đạt ngưỡng" description="Thử hạ ngưỡng MinWUS trong Cấu hình luồng hoặc nạp thêm giao dịch."/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Nhóm sản phẩm</th><th className="pb-3 text-right">WUS</th><th className="pb-3 text-right">Giao dịch khớp</th><th className="pb-3 pl-6">Mã giao dịch</th></tr></thead><tbody>{shown.map(pattern => <tr key={JSON.stringify(pattern.items)} className="border-b border-slate-100 last:border-0"><td className="py-3 font-mono text-blue-700">{`{${pattern.items.join(", ")}}`}</td><td className="py-3 text-right font-medium tnum">{formatNumber(pattern.wus)}</td><td className="py-3 text-right tnum">{pattern.support}</td><td className="max-w-64 py-3 pl-6 font-mono text-xs text-slate-500"><details><summary className="cursor-pointer">{pattern.transactionIds.length} giao dịch</summary><p className="mt-2 max-h-40 overflow-auto break-words">{pattern.transactionIds.map(formatTransactionId).join(", ")}</p></details></td></tr>)}</tbody></table></div>}</Card></>}
  </>
}
