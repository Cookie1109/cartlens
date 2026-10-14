import { ChevronLeft, ChevronRight, Download, GitBranch, Layers } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { cartLensApi } from "../../services/cartLensApi"
import { Modal, formatNumber, formatTransactionId } from "../../components/ui"
import { streamStatus } from "../../components/streamStatus"
import type { MiningRun, PatternResult, Structure, TreeNode } from "../../types/api"
import StreamStatusCard from "./StreamStatusCard"

function Pager({ page, count, onChange, label }: { page: number; count: number; onChange: (page: number) => void; label: string }) {
  return <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
    <button aria-label={`Trang trước ${label}`} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16}/></button>
    <span>{page + 1}/{Math.max(1, count)}</span>
    <button aria-label={`Trang sau ${label}`} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={page + 1 >= count} onClick={() => onChange(page + 1)}><ChevronRight size={16}/></button>
  </div>
}

function CtStructure({ structure, windowSize, minWus }: { structure: Structure; windowSize: number; minWus: number }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(4)
  const gridRef = useRef<HTMLDivElement>(null)
  const rows = structure.ctsets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  useEffect(() => { setPage(0) }, [structure.totalEntries, rowsPerPage])
  useEffect(() => {
    const grid = gridRef.current; if (!grid) return
    const observer = new ResizeObserver(entries => setRowsPerPage(Math.max(1, Math.min(4, Math.floor(entries[0].contentRect.height / 34)))))
    observer.observe(grid); return () => observer.disconnect()
  }, [])
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">Vòng lcTid: <b className="text-blue-700">{structure.currentLcTid}</b> / {windowSize} · ΣTWU = {formatNumber(structure.sumTwu, 2)}</span>
      <Pager page={page} count={Math.ceil(structure.ctsets.length / rowsPerPage)} onChange={setPage} label="CTset"/>
    </div>
    <div ref={gridRef} className="grid min-h-0 flex-1 gap-1.5" style={{gridTemplateRows: `repeat(${rowsPerPage}, minmax(0, 1fr))`}} data-testid="ct-structure">
      {rows.map(row => <div key={row.item} className="flex min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-2 py-1">
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
    <p className="text-[10px] text-slate-500">{Math.min(structure.ctsets.length, page * rowsPerPage + 1)}–{Math.min(structure.ctsets.length, page * rowsPerPage + rowsPerPage)} / {formatNumber(structure.totalEntries)} CTset · lcTid giữ thứ tự vòng. {structure.totalEntries > 32 && "Xem trước 32 item đầu."}</p>
  </div>
}

function DwtStructure({ structure }: { structure: Structure }) {
  const [focus, setFocus] = useState(0)
  const [canvas, setCanvas] = useState({ width: 760, height: 188 })
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setCanvas({ width, height })
    })
    observer.observe(svg); return () => observer.disconnect()
  }, [])
  const compact = canvas.height < 86
  const branchLimit = compact ? 1 : canvas.width < 480 ? 2 : canvas.width < 700 ? 3 : 4
  const childLimit = canvas.width < 600 ? 2 : 3
  const maxDepth = canvas.height >= 148 ? 2 : 1
  const root = structure.nodes.find(node => node.id === focus) ?? structure.nodes[0]
  const children = (node: TreeNode) => structure.nodes.filter(n => n.parentId === node.id)
  const visible: { node: TreeNode; depth: number; x: number; y: number; parent?: { x: number; y: number } }[] = []
  if (root) {
    const visit = (node: TreeNode, depth: number, from: number, to: number, parent?: { x: number; y: number }) => {
      const position = compact
        ? { x: canvas.width * (depth === 0 ? 0.3 : 0.7), y: canvas.height / 2 }
        : { x: (from + to) / 2, y: 22 + depth * (canvas.height - 44) / maxDepth }
      visible.push({ node, depth, ...position, parent })
      if (depth >= maxDepth) return
      const rows = children(node).slice(0, depth === 0 ? branchLimit : childLimit)
      rows.forEach((child, i) => visit(child, depth + 1, from + (to - from) * i / rows.length, from + (to - from) * (i + 1) / rows.length, position))
    }
    visit(root, 0, 40, canvas.width - 40)
  }
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
      <span>{formatNumber(structure.totalEntries)} nút · TAILLIST: {formatNumber(structure.tailCount)} giao dịch</span>
      <div className="flex min-w-0 items-center gap-1"><select aria-label="Chọn nút cây" className="max-w-24 rounded border border-slate-200 bg-white p-1 text-[10px]" value={root?.id ?? 0} onChange={e=>setFocus(Number(e.target.value))}>{structure.nodes.map(n=><option key={n.id} value={n.id}>{n.item} [{n.pre},{n.post}]</option>)}</select><button className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40" disabled={root?.parentId === null || root?.parentId === undefined} onClick={() => setFocus(root?.parentId ?? 0)}>Lên nút cha</button></div>
    </div>
    <svg ref={svgRef} viewBox={`0 0 ${canvas.width} ${canvas.height}`} preserveAspectRatio="none" className="min-h-0 w-full flex-1" role="img" aria-label="Cây DSWUN đang chạy" data-testid="dwt-structure">
      {visible.filter(n => n.parent).map(n => <path key={`edge-${n.node.id}`} d={compact ? `M${n.parent!.x + 34},${n.parent!.y} H${n.x - 34}` : `M${n.parent!.x},${n.parent!.y + 19} V${n.y - 25} H${n.x} V${n.y - 19}`} fill="none" stroke="#a7c7d5" strokeWidth="1.5"/>)}
      {visible.map(({ node, depth, x, y }) => <g key={node.id} role="button" tabIndex={0} aria-label={`Nút ${node.item}, pre ${node.pre}, post ${node.post}, ${node.count} giao dịch`} aria-pressed={node.id === root?.id} onClick={() => setFocus(node.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocus(node.id) } }} className="tree-node cursor-pointer">
        <title>{node.item}: TWU {formatNumber(node.weight, 2)}, pre={node.pre}, post={node.post}, {node.count} giao dịch, {node.childCount} nhánh</title>
        <rect x={x-34} y={y-19} width="68" height="38" rx="8" fill={node.id === root?.id ? "#0f766e" : "#f0fdfa"} stroke="#5eead4"/>
        <text x={x} y={y-3} textAnchor="middle" fontSize="12" fontWeight="600" fill={node.id === root?.id ? "white" : "#115e59"}>{node.item.slice(0, 8)}</text>
        <text x={x} y={y+10} textAnchor="middle" fontSize="9" fill={node.id === root?.id ? "#ccfbf1" : "#475569"}>{node.pre},{node.post}{node.item === "root" ? "" : ` · n=${node.count}`}</text>
        {node.childCount > (depth >= maxDepth ? 0 : children(node).slice(0, depth === 0 ? branchLimit : childLimit).length) && <text x={x+37} y={y-12} fontSize="10" fill="#0f766e">+{node.childCount - (depth >= maxDepth ? 0 : children(node).slice(0, depth === 0 ? branchLimit : childLimit).length)}</text>}
      </g>)}
    </svg>
    <div className="flex min-w-0 items-center gap-1 overflow-hidden text-[10px] text-slate-500"><b className="shrink-0 text-teal-700">TAIL →</b>{structure.tails.slice(0, 4).map(tail => <span key={tail.transactionId} className="truncate rounded bg-teal-50 px-1.5 py-1" title={`TWU ${tail.twu}; tail node ${tail.nodeId}`}>{formatTransactionId(tail.transactionId)} → #{tail.nodeId}</span>)}</div>
    {root && root.item !== "root" && <p className="mt-1 truncate text-[10px] text-teal-700" title={`Các WUN-code của item ${root.item} trong phần cây xem trước`}>WUNList({root.item}) xem trước: {structure.nodes.filter(n=>n.item===root.item).slice(0,3).map(n=>`⟨${n.pre},${n.post},${formatNumber(n.weight,2)}⟩`).join(" ")}</p>}
    <p className="mt-1 text-[10px] text-slate-500">Bấm nút để xem nhánh · nhãn pre,post dùng tạo WUNList · xem trước {structure.nodes.length}/{formatNumber(structure.totalEntries)} nút.</p>
  </div>
}

export default function AlgorithmPage({ algorithm }: { algorithm: "ct" | "dwt" }) {
  const { liveSnapshot, overview, streamId, error, replay } = useApp()
  const [patternPage, setPatternPage] = useState(0)
  const [patternRun, setPatternRun] = useState<MiningRun | null>(null)
  const [patternError, setPatternError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [selectedPattern, setSelectedPattern] = useState<{ pattern: PatternResult; windowId: number } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(4)
  const snapshot = liveSnapshot?.sessionId === overview?.configuration.sessionId ? liveSnapshot : null
  const run = snapshot?.[algorithm] ?? null
  const structure = snapshot?.[algorithm === "ct" ? "ctStructure" : "dwtStructure"] ?? null
  const point = liveSnapshot?.points.find(p => p.windowId === run?.windowId)
  const title = algorithm === "ct" ? "FWUDS-CT" : "FWUDS-DWT"
  const config = run?.config ?? overview?.configuration.config
  const phase = streamStatus(replay, !!error || !!overview?.miningError)
  useEffect(() => { setPatternPage(0); setPatternRun(null); setSelectedPattern(null) }, [run?.runId, algorithm])
  useEffect(() => { setPatternPage(0) }, [run?.windowId, pageSize])
  useEffect(() => {
    const node = resultRef.current; if (!node) return
    const observer = new ResizeObserver(entries => setPageSize(Math.max(1, Math.min(8, Math.floor((entries[0].contentRect.height - 28) / 30)))))
    observer.observe(node); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!streamId || !run) { setPatternRun(null); return }
    let disposed = false
    setPatternError(null); setPatternRun(null)
    void cartLensApi.window(streamId, run.runId, run.windowId, patternPage * pageSize, pageSize).then(value => { if (!disposed) setPatternRun(value) }).catch(() => { if (!disposed) setPatternError("Không tải được trang kết quả.") })
    return () => { disposed = true }
  }, [streamId, run?.runId, run?.windowId, patternPage, pageSize, retry])
  const current = patternRun?.runId === run?.runId && patternRun?.windowId === run?.windowId ? patternRun : null
  return <div className="algorithm-page flex h-full min-h-0 flex-col gap-3" data-testid={`algorithm-${algorithm}`}>
    <div className="flex shrink-0 items-center justify-between gap-2">
      <div><h1 className="text-xl font-bold tracking-tight">{title}</h1><p className="text-xs text-slate-500">{algorithm === "ct" ? "Circular Tidset · Algorithm 1–3" : "DSWUN-tree / WUNList · Algorithm 4–6"}</p></div>
      <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium ring-1 ring-inset ${phase.color}`}>{phase.label}</span>
    </div>
    {(error || overview?.miningError || patternError) && <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700"><p role="alert">{error || overview?.miningError || patternError}</p>{patternError && <button className="shrink-0 rounded border border-red-200 px-2 py-1" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</div>}
    <div className="grid shrink-0 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-[1fr_1fr_2fr]">
      <div><p className="text-slate-500">Mẫu đạt minWUS {config?.minWus}</p><p className="mt-1 text-lg font-bold text-blue-700" data-testid="pattern-count">{formatNumber(run?.patternCount ?? 0)}</p></div>
      <div><p className="text-slate-500">Giao dịch đã xử lý</p><p className="mt-1 text-lg font-bold" data-testid="processed-count">{formatNumber(overview?.metrics.processedTransactions ?? 0)}</p></div>
      <StreamStatusCard/>
    </div>
    <section className={`structure-panel flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 ${algorithm === "dwt" ? "flex-[1.5]" : "flex-[1.2]"}`}>
      <div className="flex shrink-0 items-center justify-between text-sm"><h2 className="flex items-center gap-2 font-semibold">{algorithm === "ct" ? <Layers size={16}/> : <GitBranch size={16}/>} {algorithm === "ct" ? "Cấu trúc CTset" : "Cây DSWUN"}</h2><span className="text-[11px] text-slate-500">{formatNumber(algorithm === "ct" ? point?.ctUpdateMs ?? 0 : point?.dwtUpdateMs ?? 0, 3)} ms cập nhật</span></div>
      <div key={run?.windowId} className="pane-flow flex shrink-0 items-center gap-1.5 text-[10px]" aria-label="Quy trình cập nhật cửa sổ">
        {(algorithm === "ct" ? ["Loại pane cũ", "Thêm pane mới", "Giao CTset", "Lọc WUS ≥ minWUS"] : ["Insert pane mới", "TAILLIST loại pane cũ", "pre/post → WUNList", "Giao list & lọc WUS"]).map((step, i) => <span key={step} className="flex min-w-0 items-center gap-1.5"><span className={`rounded px-2 py-1 ${i === 3 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{step}</span>{i < 3 && <span className="text-slate-400">→</span>}</span>)}
      </div>
      {structure && (algorithm === "ct" ? structure.ctsets.length > 0 : structure.nodes.length > 0) ? algorithm === "ct" ? <CtStructure structure={structure} minWus={config?.minWus ?? 0} windowSize={(config?.paneSize ?? 0) * (config?.windowPaneCount ?? 0)}/> : <DwtStructure key={run?.windowId} structure={structure}/> : <div className="grid min-h-0 flex-1 place-content-center text-center text-sm text-slate-500"><p>Đang chờ {algorithm === "ct" ? "pane" : "cửa sổ"} hoàn chỉnh đầu tiên</p><p className="mt-1 text-xs">{overview?.metrics.retainedTransactions ?? 0} / {(config?.paneSize ?? 0) * (config?.windowPaneCount ?? 0)} giao dịch · buffer {overview?.metrics.bufferedTransactions ?? 0}/{config?.paneSize ?? 0}</p></div>}
    </section>
    <section className="result-panel flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2"><h2 className="text-sm font-semibold">Kết quả khai phá <span className="font-normal text-slate-500">({formatNumber(run?.patternCount ?? 0)} mẫu)</span>{run && <span className="ml-2 text-xs font-normal text-slate-500">#{run.windowId}</span>}</h2>{run && streamId && <a aria-label={`Tải CSV toàn phiên ${title}`} className="flex items-center gap-1 rounded p-1 text-xs text-blue-700 hover:bg-blue-50" href={cartLensApi.exportUrl(streamId, run.runId)}><Download size={13}/><span className="hidden sm:inline">CSV toàn phiên</span></a>}</div>
      <div ref={resultRef} className="min-h-0 flex-1 overflow-hidden">
        {run?.patternCount ? <table className="w-full table-fixed text-left text-xs" data-testid="pattern-table" aria-busy={!current && !patternError}><thead className="h-7 border-b border-slate-100 text-slate-500"><tr><th className="w-[55%] font-medium">Mẫu · bấm để xem chi tiết</th><th className="font-medium">WUS</th><th className="text-right font-medium"><abbr title="Số giao dịch chứa mẫu" className="no-underline">Support</abbr></th></tr></thead><tbody>{current?.patterns.map(p => <tr key={p.items.join("|")} className="h-[30px] border-b border-slate-50 hover:bg-blue-50/40"><td className="pr-2 font-mono font-semibold text-slate-700"><button className="pattern-action truncate rounded px-1 text-blue-700" aria-label={`Xem mẫu {${p.items.join(", ")}}`} title={`{${p.items.join(", ")}}`} onClick={() => setSelectedPattern({pattern:p,windowId:run.windowId})}>{`{${p.items.join(", ")}}`}</button></td><td className="text-blue-700">{formatNumber(p.wus, 6)}</td><td className="text-right tabular-nums">{formatNumber(p.support)}</td></tr>)}{!current && <tr className="h-[30px]"><td colSpan={3} className="text-slate-500">{patternError ? "Chưa tải được dữ liệu." : "Đang tải mẫu…"}</td></tr>}</tbody></table> : <div className="grid h-full place-content-center text-center text-xs text-slate-500">{run ? "Không có mẫu đạt ngưỡng minWUS trong cửa sổ này." : "Kết quả tự xuất hiện khi đủ cửa sổ."}</div>}
      </div>
      <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500"><span>{point ? point.equivalent ? "✓ CT và DWT cho cùng kết quả" : "⚠ CT và DWT có sai khác" : "Hai thuật toán cùng nhận một luồng"} · {formatNumber(algorithm === "ct" ? point?.ctMiningMs ?? 0 : point?.dwtMiningMs ?? 0, 3)} ms khai phá</span><Pager page={patternPage} count={Math.ceil((run?.patternCount ?? 0) / pageSize)} onChange={setPatternPage} label="kết quả"/></div>
    </section>
    <Modal open={selectedPattern !== null} title="Chi tiết mẫu" onClose={() => setSelectedPattern(null)}>
      {selectedPattern && <><p className="mb-3 text-xs text-slate-600">{title} · cửa sổ #{selectedPattern.windowId}</p><p className="break-words rounded-xl bg-blue-50 p-3 font-mono text-sm font-semibold text-blue-800">{`{${selectedPattern.pattern.items.join(", ")}}`}</p><dl className="my-4 grid grid-cols-2 gap-3"><div><dt className="text-xs text-slate-600">WUS</dt><dd className="mt-1 font-semibold tnum">{formatNumber(selectedPattern.pattern.wus,10)}</dd></div><div><dt className="text-xs text-slate-600">Giao dịch chứa mẫu</dt><dd className="mt-1 font-semibold tnum">{formatNumber(selectedPattern.pattern.support)}</dd></div></dl><h3 className="mb-2 text-sm font-medium">Mã giao dịch</h3><div className="flex flex-wrap gap-1.5">{selectedPattern.pattern.transactionIds.slice(0,50).map(id => <span key={id} className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{formatTransactionId(id)}</span>)}</div>{selectedPattern.pattern.transactionIds.length > 50 && <p className="mt-3 text-xs text-slate-600">Hiển thị 50/{formatNumber(selectedPattern.pattern.transactionIds.length)} giao dịch. CSV toàn phiên chứa danh sách đầy đủ.</p>}</>}
    </Modal>
  </div>
}
