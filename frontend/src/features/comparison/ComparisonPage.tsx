import { CheckCircle2, GitCompareArrows, XCircle } from "lucide-react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, EmptyState, ErrorBanner, PageHeading, formatNumber } from "../../components/ui"
import type { MiningRun } from "../../types/api"

const ResultCard = ({ label, run }: { label: string; run: MiningRun }) => <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{run.patterns.length}</p><p className="text-xs text-slate-500">patterns · {formatNumber(run.executionTimeMs)} ms</p></Card>

export default function ComparisonPage() {
  const { comparison,compare,status,error,transactions,config } = useApp()
  const ready = transactions.length >= config.paneSize * config.windowPaneCount
  return <><PageHeading title="So sánh" description="Chạy Oracle, FWUDS-CT và FWUDS-DWT trên cùng một immutable snapshot." action={<Button onClick={() => void compare().catch(() => undefined)} disabled={!ready || status === "loading"}><GitCompareArrows size={17}/>{status === "loading" ? "Đang đối chiếu…" : "Chạy đối chiếu"}</Button>}/><ErrorBanner message={error}/>{!comparison ? <Card><EmptyState title="Chưa có dữ liệu đối chiếu" description={ready ? "Bấm Chạy đối chiếu để kiểm chứng kết quả." : "Window chưa đủ giao dịch theo cấu hình hiện tại."}/></Card> : <>
    <div className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${comparison.equivalent ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{comparison.equivalent ? <CheckCircle2/> : <XCircle/>}<div><p className="font-semibold">{comparison.equivalent ? "Ba miner cho kết quả tương đương" : "Phát hiện sai khác"}</p><p className="text-sm opacity-80">{comparison.equivalent ? "Oracle xác nhận toàn bộ pattern và WUS." : comparison.differences.join(" · ")}</p></div></div>
    <div className="grid gap-4 sm:grid-cols-3"><ResultCard label="Oracle" run={comparison.oracle}/><ResultCard label="FWUDS-CT" run={comparison.fwudsCt}/><ResultCard label="FWUDS-DWT" run={comparison.fwudsDwt}/></div>
    <Card className="mt-5"><h2 className="mb-4 font-semibold">Pattern chung ({comparison.oracle.patterns.length})</h2><div className="flex flex-wrap gap-2">{comparison.oracle.patterns.map(pattern => <span key={pattern.items.join("|")} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs">{`{${pattern.items.join(", ")}}`} <strong className="ml-2 text-blue-700">{formatNumber(pattern.wus)}</strong></span>)}</div></Card>
  </>}</>
}
