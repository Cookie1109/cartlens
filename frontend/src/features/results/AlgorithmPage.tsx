import { ChevronLeft, ChevronRight, Download, GitBranch, Layers, ScrollText } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { cartLensApi } from "../../services/cartLensApi"
import { Modal, formatNumber, formatTransactionId } from "../../components/ui"
import { streamStatus } from "../../components/streamStatus"
import type { PatternResult, Structure } from "../../types/api"
import StreamStatusCard from "./StreamStatusCard"
import DwtStructure from "./DwtStructure"
import PatternList from "./PatternList"
import AuditLogModal, { type AuditTarget } from "./AuditLogModal"

function CtStructure({ structure: preview, windowSize, minWus, streamId, sessionId, windowId }: {
  structure: Structure; windowSize: number; minWus: number; streamId: string; sessionId: string; windowId: number
}) {
  const [full, setFull] = useState<Structure | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(0)
  const needsFull = preview.ctsets.length < preview.totalEntries
  useEffect(() => {
    if (!needsFull) return
    let disposed = false
    setError(false)
    void cartLensApi.ctStructure(streamId, sessionId, windowId).then(value => { if (!disposed) setFull(value) }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true }
  }, [streamId, sessionId, windowId, needsFull, retry])
  const structure = needsFull && full ? full : preview
  const pageCount = Math.max(1, Math.ceil(structure.ctsets.length / 10))
  const currentPage = Math.min(page, pageCount - 1)
  const offset = currentPage * 10
  const rows = structure.ctsets.slice(offset, offset + 10)
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">Vòng lcTid: <b className="text-blue-700">{structure.currentLcTid}</b> / {windowSize} · ΣTWU = {formatNumber(structure.sumTwu, 2)}</span>
      {structure.ctsets.length > 10 && <div className="flex items-center gap-2 text-slate-500" aria-label="Phân trang CTset">
        <button aria-label="Trang trước CTset" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/></button>
        <span data-testid="ct-page">{currentPage + 1}/{pageCount}</span>
        <button aria-label="Trang sau CTset" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16}/></button>
      </div>}
    </div>
    <div className="grid gap-1.5" data-testid="ct-structure">
      {rows.map(row => <div key={row.item} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-2 py-1">
        <span className="w-14 shrink-0 truncate font-mono text-xs font-bold text-blue-800" title={row.item}>{row.item}</span>
        <span className="hidden text-xs text-slate-400 sm:inline">→</span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label={`CTset ${row.item}`}>
          {row.tids.slice(0, 8).map(tid => <span key={tid} className={`grid size-6 shrink-0 place-items-center rounded-md border text-[10px] font-semibold ${tid === structure.currentLcTid ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}>{tid}</span>)}
          {row.support > 8 && <span className="shrink-0 text-[10px] text-slate-500">+{row.support - 8}</span>}
          <span className="ml-auto text-blue-400">↻</span>
        </div>
        <div className="shrink-0 text-right text-[10px]"><p className="font-semibold">WUS {formatNumber(row.wus, 4)}</p><p className="text-slate-500">{formatNumber(row.support)} TID</p></div>
      </div>)}
    </div>
    {structure.intersection && <p className="truncate rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-600" title={`Giao CTset của ${structure.intersection.items.join(", ")}: ${structure.intersection.support} TID; WUS ${structure.intersection.wus}`}>
      CTset({structure.intersection.items.join(" ∩ ")}) = [{structure.intersection.tids.join(",")}{structure.intersection.support > 8 ? ",…" : ""}] · WUS {formatNumber(structure.intersection.wus, 4)} · <b className={structure.intersection.wus >= minWus ? "text-emerald-700" : "text-amber-700"}>{structure.intersection.wus >= minWus ? "Giữ mẫu" : "Cắt nhánh"}</b>
    </p>}
    <p className="text-[10px] text-slate-500">{rows.length ? formatNumber(offset + 1) : 0}–{formatNumber(offset + rows.length)} / {formatNumber(structure.totalEntries)} CTset · tối đa 10 dòng/trang · lcTid giữ thứ tự vòng.</p>
    {needsFull && !full && <div className="text-xs text-slate-500" role="status">{error ? <span className="text-red-700">Không tải được CTset đầy đủ. <button className="rounded border border-red-200 px-2 py-1" onClick={() => setRetry(value => value + 1)}>Thử lại</button></span> : "Đang tải toàn bộ CTset…"}</div>}
  </div>
}

export default function AlgorithmPage({ algorithm }: { algorithm: "ct" | "dwt" }) {
  const { liveSnapshot, overview, streamId, error, replay } = useApp()
  const [selectedPattern, setSelectedPattern] = useState<{ pattern: PatternResult; windowId: number } | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const auditButton = useRef<HTMLButtonElement>(null)
  const closeAudit = useCallback(() => {
    setAuditOpen(false)
    requestAnimationFrame(() => auditButton.current?.focus())
  }, [])
  const snapshot = liveSnapshot?.sessionId === overview?.configuration.sessionId ? liveSnapshot : null
  const run = snapshot?.[algorithm] ?? null
  const structure = snapshot?.[algorithm === "ct" ? "ctStructure" : "dwtStructure"] ?? null
  const point = liveSnapshot?.points.find(p => p.windowId === run?.windowId)
  const title = algorithm === "ct" ? "FWUDS-CT" : "FWUDS-DWT"
  const currentAudit = useMemo<AuditTarget | null>(() => run && snapshot && streamId ? { streamId, sessionId: snapshot.sessionId, windowId: run.windowId, algorithm: title } : null, [streamId, snapshot?.sessionId, run?.windowId, title])
  const config = run?.config ?? overview?.configuration.config
  const phase = streamStatus(replay, !!error || !!overview?.miningError)
  useEffect(() => { setSelectedPattern(null) }, [run?.runId, run?.windowId, algorithm])
  useEffect(() => { setAuditOpen(false) }, [algorithm, streamId, snapshot?.sessionId])
  return <div className="algorithm-page flex flex-col gap-3" data-testid={`algorithm-${algorithm}`}>
    <div className="flex shrink-0 items-center justify-between gap-2">
      <div><h1 className="text-xl font-bold tracking-tight">{title}</h1><p className="text-xs text-slate-500">{algorithm === "ct" ? "Circular Tidset · Algorithm 1–3" : "DSWUN-tree / WUNList · Algorithm 4–6"}</p></div>
      <div className="flex shrink-0 items-center gap-2"><button ref={auditButton} type="button" disabled={!currentAudit} onClick={() => setAuditOpen(true)} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ScrollText size={15}/>Audit log</button><span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium ring-1 ring-inset ${phase.color}`}>{phase.label}</span></div>
    </div>
    {(error || overview?.miningError) && <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700"><p role="alert">{error || overview?.miningError}</p></div>}
    <div className="grid shrink-0 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-[1fr_1fr_2fr]">
      <div><p className="text-slate-500">Mẫu đạt minWUS {config?.minWus}</p><p className="mt-1 text-lg font-bold text-blue-700" data-testid="pattern-count">{formatNumber(run?.patternCount ?? 0)}</p></div>
      <div><p className="text-slate-500">Giao dịch đã xử lý</p><p className="mt-1 text-lg font-bold" data-testid="processed-count">{formatNumber(overview?.metrics.processedTransactions ?? 0)}</p></div>
      <StreamStatusCard/>
    </div>
    <section className={`structure-panel flex shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 ${algorithm === "dwt" ? "h-[460px] sm:h-[560px]" : ""}`}>
      <div className="flex shrink-0 items-center justify-between text-sm"><h2 className="flex items-center gap-2 font-semibold">{algorithm === "ct" ? <Layers size={16}/> : <GitBranch size={16}/>} {algorithm === "ct" ? "Cấu trúc CTset" : "Cây DSWUN"}</h2><span className="text-[11px] text-slate-500">{formatNumber(algorithm === "ct" ? point?.ctUpdateMs ?? 0 : point?.dwtUpdateMs ?? 0, 3)} ms cập nhật</span></div>
      <div key={run?.windowId} className="pane-flow flex shrink-0 items-center gap-1.5 text-[10px]" aria-label="Quy trình cập nhật cửa sổ">
        {(algorithm === "ct" ? ["Loại pane cũ", "Thêm pane mới", "Giao CTset", "Lọc WUS ≥ minWUS"] : ["Insert pane mới", "TAILLIST loại pane cũ", "pre/post → WUNList", "Giao list & lọc WUS"]).map((step, i) => <span key={step} className="flex min-w-0 items-center gap-1.5"><span className={`rounded px-2 py-1 ${i === 3 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{step}</span>{i < 3 && <span className="text-slate-400">→</span>}</span>)}
      </div>
      {auditOpen ? null : structure && (algorithm === "ct" ? structure.ctsets.length > 0 : structure.nodes.length > 0) ? algorithm === "ct" ? <CtStructure key={`${snapshot?.sessionId}:${run?.windowId ?? 0}`} streamId={streamId!} sessionId={snapshot!.sessionId} windowId={run?.windowId ?? 0} structure={structure} minWus={config?.minWus ?? 0} windowSize={(config?.paneSize ?? 0) * (config?.windowPaneCount ?? 0)}/> : <DwtStructure key={`${snapshot?.sessionId}:${run?.windowId ?? 0}`} structure={structure} streamId={streamId!} sessionId={snapshot!.sessionId} windowId={run?.windowId ?? 0}/> : <div className="grid min-h-0 flex-1 place-content-center text-center text-sm text-slate-500"><p>Đang chờ {algorithm === "ct" ? "pane" : "cửa sổ"} hoàn chỉnh đầu tiên</p><p className="mt-1 text-xs">{overview?.metrics.retainedTransactions ?? 0} / {(config?.paneSize ?? 0) * (config?.windowPaneCount ?? 0)} giao dịch · buffer {overview?.metrics.bufferedTransactions ?? 0}/{config?.paneSize ?? 0}</p></div>}
    </section>
    <section className="result-panel flex flex-col rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2"><h2 className="text-sm font-semibold">Kết quả khai phá <span className="font-normal text-slate-500">({formatNumber(run?.patternCount ?? 0)} mẫu)</span>{run && <span className="ml-2 text-xs font-normal text-slate-500">#{run.windowId}</span>}</h2>{run && streamId && <a aria-label={`Tải CSV toàn phiên ${title}`} className="flex items-center gap-1 rounded p-1 text-xs text-blue-700 hover:bg-blue-50" href={cartLensApi.exportUrl(streamId, run.runId)}><Download size={13}/><span className="hidden sm:inline">CSV toàn phiên</span></a>}</div>
      {auditOpen ? null : run?.patternCount && streamId ? <PatternList key={`${run.runId}:${run.windowId}`} streamId={streamId} run={run} onSelect={pattern => setSelectedPattern({ pattern, windowId: run.windowId })}/> : <div className="grid min-h-0 flex-1 place-content-center text-center text-xs text-slate-500">{run ? "Không có mẫu đạt ngưỡng minWUS trong cửa sổ này." : "Kết quả tự xuất hiện khi đủ cửa sổ."}</div>}
      <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500"><span>{point ? point.equivalent ? "✓ CT và DWT cho cùng kết quả" : "⚠ CT và DWT có sai khác" : "Hai thuật toán cùng nhận một luồng"} · {formatNumber(algorithm === "ct" ? point?.ctMiningMs ?? 0 : point?.dwtMiningMs ?? 0, 3)} ms khai phá</span></div>
    </section>
    <Modal open={selectedPattern !== null} title="Chi tiết mẫu" onClose={() => setSelectedPattern(null)}>
      {selectedPattern && <><p className="mb-3 text-xs text-slate-600">{title} · cửa sổ #{selectedPattern.windowId}</p><p className="break-words rounded-xl bg-blue-50 p-3 font-mono text-sm font-semibold text-blue-800">{`{${selectedPattern.pattern.items.join(", ")}}`}</p><dl className="my-4 grid grid-cols-2 gap-3"><div><dt className="text-xs text-slate-600">WUS</dt><dd className="mt-1 font-semibold tnum">{formatNumber(selectedPattern.pattern.wus,10)}</dd></div><div><dt className="text-xs text-slate-600">Giao dịch chứa mẫu</dt><dd className="mt-1 font-semibold tnum">{formatNumber(selectedPattern.pattern.support)}</dd></div></dl><h3 className="mb-2 text-sm font-medium">Mã giao dịch</h3><div className="flex flex-wrap gap-1.5">{selectedPattern.pattern.transactionIds.slice(0,50).map(id => <span key={id} className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{formatTransactionId(id)}</span>)}</div>{selectedPattern.pattern.transactionIds.length > 50 && <p className="mt-3 text-xs text-slate-600">Hiển thị 50/{formatNumber(selectedPattern.pattern.transactionIds.length)} giao dịch. CSV toàn phiên chứa danh sách đầy đủ.</p>}</>}
    </Modal>
    {auditOpen && currentAudit && <AuditLogModal target={currentAudit} onClose={closeAudit}/>}
  </div>
}
