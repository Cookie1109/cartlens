import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { Modal, formatNumber } from "../../components/ui"
import useLiveAudit from "./useLiveAudit"
import type { MiningAudit, UiAlgorithm } from "../../types/api"
import WindowTransactions from "./WindowTransactions"
import DetailPopover from "../../components/DetailPopover"
import CalculationHint from "../../components/CalculationHint"
import type { AuditSample } from "../../types/api"

export interface AuditTarget { streamId: string; sessionId: string; windowId: number; algorithm: UiAlgorithm }
const operationNames = { CT_SINGLETON: "Lọc CTset 1-item", CT_INTERSECTION: "Giao CTset", DWT_SINGLETON: "Lọc item / WUNList", DWT_INTERSECTION: "Giao WUNList" }
const n = (value: number, digits = 4) => formatNumber(value, digits)
const pageSize = 5
type Filter = "all" | "kept" | "pruned"
const mathNumber = (value: number) => <span className="inline-block max-w-full break-all">{n(value, 12)}</span>

function windowCalculation(data: MiningAudit) {
  return <><span className="mb-2 block font-semibold text-slate-900">Tổng TWU của cửa sổ W{data.windowId}</span><span className="block">Tổng mới = tổng trước − TWU pane cũ + TWU pane mới.</span><span className="my-2 block rounded-lg bg-slate-50 p-2 font-mono">{mathNumber(data.previousSumTwu)} − {mathNumber(data.expiredTwu)} + {mathNumber(data.incomingTwu)} = {mathNumber(data.sumTwu)}</span>{data.initialWindow && <span className="block">Trong lần dựng cửa sổ này, tổng trước là TWU của các pane đã tích lũy.</span>}<span className="mt-2 block text-slate-500">TWU của pane là tổng TWU các giao dịch thuộc pane đó.</span></>
}

function sampleCalculation(sample: AuditSample, data: MiningAudit) {
  const items = `{${sample.items.join(", ")}${sample.itemsTruncated ? ", …" : ""}}`
  if (sample.wus === null || sample.numerator === null) return <><span className="mb-2 block font-semibold text-slate-900">Vì sao cắt sớm mẫu {items}?</span><span className="block">Cận trên là trọng số lớn nhất phép giao còn có thể đạt. Khi cận này không đủ ngưỡng, thuật toán dừng giao.</span>{sample.pruningBound !== null && <span className="my-2 block rounded-lg bg-slate-50 p-2 font-mono">Cận trên {n(sample.pruningBound, 12)} &lt; minWUS × ΣTWU = {n(data.config.minWus, 12)} × {n(data.sumTwu, 12)}</span>}<span className="block">Chưa tính hết giao nên không có WUS chính xác cho ứng viên này.</span></>
  return <><span className="mb-2 block font-semibold text-slate-900">Cách tính WUS của {items}</span><span className="block">1. Cộng TWU của các giao dịch chứa đủ item trong mẫu: <b>{n(sample.numerator, 12)}</b>{sample.support !== null ? ` (${sample.support} giao dịch)` : ""}.</span><span className="mt-2 block">2. Chia cho tổng TWU của cửa sổ W{data.windowId}:</span><span className="my-2 block rounded-lg bg-slate-50 p-2 font-mono">WUS = {mathNumber(sample.numerator)} / {mathNumber(data.sumTwu)} = {mathNumber(sample.wus)}</span><span className="block">3. So với minWUS: {n(sample.wus, 12)} {sample.accepted ? "≥" : "<"} {n(data.config.minWus, 12)} → <b>{sample.accepted ? "Giữ mẫu" : "Cắt nhánh"}</b>.</span>{sample.operation.startsWith("CT_") ? <span className="mt-2 block text-slate-500">CTset dùng các lcTid chứa mẫu{sample.evidence.length ? `: [${sample.evidence.join(", ")}${sample.outputSize > sample.evidence.length ? ", …" : ""}]` : ""} để cộng TWU.</span> : <span className="mt-2 block text-slate-500">DWT cộng weight của các WUN-code khớp để có tử số {n(sample.numerator, 12)}.</span>}<span className="mt-2 block border-t border-slate-100 pt-2 text-[11px] text-slate-500">Số hiển thị được làm tròn; kết luận lấy từ lần chạy thuật toán.</span></>
}

function AuditLogModal({ target, onClose }: { target: AuditTarget; onClose: () => void }) {
  const [windowOpen, setWindowOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [transactionPage, setTransactionPage] = useState(0)
  const [methodOpen, setMethodOpen] = useState(false)
  const { data, config, error, retry } = useLiveAudit(target)
  useEffect(() => { setMethodOpen(false) }, [target.windowId])
  const activeTarget = { ...target, windowId: data?.windowId ?? target.windowId }
  const first = config ? (activeTarget.windowId - 1) * config.paneSize + 1 : null
  const lastPane = config ? activeTarget.windowId + config.windowPaneCount - 1 : null
  const last = config && lastPane !== null ? lastPane * config.paneSize : null
  const paneRange = lastPane === activeTarget.windowId ? `P${formatNumber(activeTarget.windowId)}` : `P${formatNumber(activeTarget.windowId)}–P${formatNumber(lastPane ?? activeTarget.windowId)}`
  const tabId = useId()
  const logTab = useRef<HTMLButtonElement>(null)
  const dataTab = useRef<HTMLButtonElement>(null)
  const selectTab = (next: boolean) => { setWindowOpen(next); (next ? dataTab : logTab).current?.focus() }
  const tabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    selectTab(event.key === "Home" ? false : event.key === "End" ? true : !windowOpen)
  }
  return <Modal open title={`Audit log · ${target.algorithm}`} onClose={onClose} size="wide" scrollBody bodyLayout="fixed">
    <section aria-label={`Cửa sổ trượt W${activeTarget.windowId}`} data-testid="audit-window" data-window-id={activeTarget.windowId} className="mb-3 shrink-0 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Cửa sổ trượt #{activeTarget.windowId}</p>
        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`size-1.5 rounded-full ${error ? "bg-amber-500" : "bg-emerald-500"}`}/>Theo dõi cửa sổ mới nhất</span>
      </div>
      {first !== null && last !== null ? <p className="mt-1 text-xs leading-relaxed text-slate-600">Giao dịch thứ {formatNumber(first)}–{formatNumber(last)} · Pane {paneRange}</p> : <div aria-hidden="true" className="mt-2 h-4 w-2/3 rounded bg-blue-100/50"/>}
    </section>
    <div role="tablist" aria-label="Nội dung audit" className="mb-3 flex shrink-0 gap-5 border-b border-slate-200 text-sm">
      <button ref={logTab} id={`${tabId}-log-tab`} type="button" role="tab" aria-selected={!windowOpen} aria-controls={`${tabId}-log-panel`} tabIndex={!windowOpen ? 0 : -1} onKeyDown={tabKeyDown} onClick={() => setWindowOpen(false)} className={`min-h-11 border-b-2 px-1 font-medium ${!windowOpen ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Log khai phá</button>
      <button ref={dataTab} id={`${tabId}-data-tab`} type="button" role="tab" aria-selected={windowOpen} aria-controls={`${tabId}-data-panel`} tabIndex={windowOpen ? 0 : -1} onKeyDown={tabKeyDown} onClick={() => setWindowOpen(true)} className={`min-h-11 border-b-2 px-1 font-medium ${windowOpen ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Dữ liệu cửa sổ</button>
    </div>
    <div id={`${tabId}-log-panel`} role="tabpanel" aria-labelledby={`${tabId}-log-tab`} hidden={windowOpen} className={windowOpen ? "hidden" : "audit-log-panel flex min-h-0 flex-1 flex-col overflow-hidden"}>
      {!windowOpen && <>
        <AuditLogContent target={activeTarget} data={data} error={error} retry={retry} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} page={page} setPage={setPage} methodOpen={methodOpen} setMethodOpen={setMethodOpen}/>
      </>}
    </div>
    <div id={`${tabId}-data-panel`} role="tabpanel" aria-labelledby={`${tabId}-data-tab`} hidden={!windowOpen} className={!windowOpen ? "hidden" : "flex min-h-0 flex-1 flex-col overflow-hidden"}>
      {windowOpen && (error ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button className="mt-2 rounded border border-red-200 px-3 py-1" onClick={retry}>Thử lại</button></div> : config && first !== null && last !== null ? <WindowTransactions streamId={target.streamId} windowId={activeTarget.windowId} first={first} last={last} paneSize={config.paneSize} page={transactionPage} setPage={setTransactionPage} ready={!!data}/> : <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải dữ liệu cửa sổ…</p>)}
    </div>
  </Modal>
}
export default memo(AuditLogModal)

// Only window-specific rows remount; filters, navigation and input focus survive.
function AuditLogContent({ target, data, error, retry, filter, setFilter, query, setQuery, page: requestedPage, setPage, methodOpen, setMethodOpen }: {
  target: AuditTarget; data: MiningAudit | null; error: string | null; retry: () => void;
  filter: Filter; setFilter: (filter: Filter) => void; query: string; setQuery: (query: string) => void; page: number; setPage: (page: number) => void;
  methodOpen: boolean; setMethodOpen: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [visibleRows, setVisibleRows] = useState(pageSize)
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const observer = new ResizeObserver(() => setVisibleRows(Math.max(1, Math.min(pageSize, Math.floor((element.clientHeight - 2) / 49)))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { setExpanded(null) }, [filter, query, requestedPage, target.windowId])
  const ct = target.algorithm === "FWUDS-CT"
  const samples = data?.samples.map((sample, index) => ({ sample, index }))
    .filter(({ sample }) => (filter === "all" || (filter === "kept" ? sample.accepted : !sample.accepted)) && (!query.trim() || sample.items.some(item => item.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))) ?? []
  const pages = Math.max(1, Math.ceil(samples.length / visibleRows))
  const page = Math.min(requestedPage, pages - 1)
  const changePage = (next: number) => { setPage(next); setExpanded(null) }
  return <div className="audit-log flex min-h-0 flex-1 flex-col gap-2 overflow-clip text-sm" data-testid="audit-log">
      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-slate-500">
        <p>Ngưỡng WUS ≥ <b className="font-medium text-slate-700">{data ? n(data.config.minWus) : "…"}</b></p>
        <button type="button" disabled={!data} aria-expanded={methodOpen} data-testid="audit-method" onClick={() => setMethodOpen(!methodOpen)} className="flex min-h-8 items-center gap-1.5 rounded px-1 text-slate-600 hover:text-blue-700 disabled:opacity-40"><BookOpen size={14}/>Cách tính kết quả</button>
      </div>
      {data ? <>
        <div className="grid shrink-0 grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-3 text-center" aria-label="Tóm tắt kết quả audit">
          <div><p className="text-xs text-slate-500">Đã xét</p><p className="mt-1 text-2xl font-semibold tracking-tight tnum"><CalculationHint label="Cách tính số ứng viên đã xét" explain={() => <><span className="mb-2 block font-semibold">Đã xét = giữ lại + bị loại</span><span className="block font-mono">{formatNumber(data.evaluatedCandidates)} = {formatNumber(data.acceptedCandidates)} + {formatNumber(data.prunedCandidates)}</span><span className="mt-2 block">Bộ đếm gồm mọi ứng viên đã kiểm tra trong cửa sổ này, kể cả ứng viên không được lưu ví dụ chi tiết.</span></>}>{formatNumber(data.evaluatedCandidates)}</CalculationHint></p></div>
          <div><p className="text-xs text-slate-500">Giữ lại</p><p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700 tnum"><CalculationHint label="Cách tính số mẫu giữ lại" explain={() => <><span className="mb-2 block font-semibold">Có {formatNumber(data.acceptedCandidates)} ứng viên đạt ngưỡng</span><span className="block">Mỗi ứng viên được giữ khi WUS ≥ minWUS ({n(data.config.minWus, 12)}). Đây là số đếm quyết định giữ của thuật toán, không phải số ví dụ trên trang.</span></>}>{formatNumber(data.acceptedCandidates)}</CalculationHint></p></div>
          <div><p className="text-xs text-slate-500">Bị loại</p><p className="mt-1 text-2xl font-semibold tracking-tight text-slate-500 tnum"><CalculationHint label="Cách tính số ứng viên bị loại" explain={() => <><span className="mb-2 block font-semibold">Bị loại = đã xét − giữ lại</span><span className="block font-mono">{formatNumber(data.prunedCandidates)} = {formatNumber(data.evaluatedCandidates)} − {formatNumber(data.acceptedCandidates)}</span><span className="mt-2 block">Ứng viên có WUS dưới ngưỡng hoặc được cắt sớm bằng cận trên.</span></>}>{formatNumber(data.prunedCandidates)}</CalculationHint></p></div>
        </div>
      </> : <div className="h-[76px] shrink-0 rounded-xl bg-slate-50"/>}
      {methodOpen && data && <DetailPopover title="Cách tính kết quả" onClose={() => setMethodOpen(false)}>
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-xs leading-relaxed text-slate-600">
            <div><h3 className="mb-1 font-semibold text-slate-900">1. Cập nhật cửa sổ</h3><p>{data.config.paneSize} giao dịch/pane · {data.config.windowPaneCount} pane/cửa sổ.</p><p>{data.initialWindow ? "Dựng cửa sổ khi khởi tạo hoặc khôi phục phiên." : "Bỏ pane cũ, thêm pane mới và cập nhật tổng trọng số."}</p>{!data.initialWindow && target.windowId > 1 && <p className="mt-1">W{target.windowId - 1} → W{target.windowId} · Bỏ pane P{formatNumber(target.windowId - 1)} · Thêm pane P{formatNumber(target.windowId + data.config.windowPaneCount - 1)}</p>}<p className="mt-2 break-words rounded-lg bg-slate-50 p-2 font-mono">ΣTWU = {n(data.previousSumTwu, 6)} − {n(data.expiredTwu, 6)} + {n(data.incomingTwu, 6)} = {n(data.sumTwu, 6)}</p><p className="mt-1 text-slate-500">{data.initialWindow ? "Số đầu là tổng trọng số các pane đã tích lũy." : "Tổng trước − pane cũ + pane mới."}</p></div>
            <div><h3 className="mb-1 font-semibold text-slate-900">2. {ct ? "Giao CTset" : "Giao WUNList"}</h3><p>{ct ? `Lấy giao các CTset để tìm giao dịch chứa đủ item của mẫu. Các TID được xét theo thứ tự vòng; lcTid mới nhất là ${data.currentLcTid}.` : "Cây DSWUN được cập nhật bằng TAILLIST. Hai WUN-code khớp khi pre tổ tiên < pre hậu duệ và post tổ tiên > post hậu duệ; cộng trọng số của các mã khớp."}</p></div>
            <div><h3 className="mb-1 font-semibold text-slate-900">3. So với ngưỡng</h3><p>WUS = tổng TWU của giao dịch chứa mẫu / tổng TWU cửa sổ.</p><p>Giữ mẫu khi WUS ≥ {n(data.config.minWus)}. Các nhánh không đủ ngưỡng được loại.</p></div>
            <p className="border-t border-slate-100 pt-3 text-slate-500">TWU(t) = Σ(số lượng × trọng số) / số item. Số hiển thị được làm tròn; quyết định dùng độ chính xác DECIMAL128. Audit chỉ giữ ví dụ của cửa sổ mới nhất, tối đa {data.sampleLimit} ví dụ; kết quả khai phá vẫn đầy đủ.</p>
          </div>
      </DetailPopover>}
      <section aria-label="Ví dụ tính toán" className="flex min-h-0 flex-1 flex-col gap-2 overflow-clip">
        <div className="flex shrink-0 items-center justify-between gap-2"><h3 className="font-semibold">Ví dụ tính toán</h3><span className="text-xs text-slate-500">{samples.length} ví dụ phù hợp</span></div>
        <div className="audit-log-tools mb-0 flex shrink-0 flex-wrap items-center gap-2">
          <input aria-label="Tìm trong ví dụ audit" type="search" placeholder="Tìm item trong ví dụ đã ghi…" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"/>
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Lọc ví dụ audit">
            {([["all", "Tất cả"], ["kept", "Giữ lại"], ["pruned", "Bị loại"]] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0) }} className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
          </div>
        </div>

        <div ref={list} data-testid="audit-log-list" className="min-h-0 flex-1 overflow-clip">
          {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700"><p>{error}</p><button className="mt-2 rounded border border-red-200 px-3 py-1" onClick={retry}>Thử lại</button></div>}
          {!data && !error && <p role="status" className="py-6 text-center text-xs text-slate-500">Đang tải audit log · cập nhật W{target.windowId}…</p>}
          {data && <div className="overflow-clip rounded-xl border border-slate-200">
            {samples.slice(page * visibleRows, page * visibleRows + visibleRows).map(({ sample, index }) => {
              const open = expanded === index
              const items = `{${sample.items.join(", ")}${sample.itemsTruncated ? ", …" : ""}}`
              const detailId = `audit-sample-${ct ? "ct" : "dwt"}-${index}`
              return <article key={index} className="border-b border-slate-100 last:border-b-0" data-testid="audit-sample">
                <div className="flex h-12 items-center gap-2 px-3 sm:gap-3 sm:px-4">
                  <button aria-expanded={open} aria-controls={open ? detailId : undefined} aria-label={`Chi tiết mẫu ${items}`} onClick={() => setExpanded(open ? null : index)} className="flex h-12 min-w-0 flex-1 items-center gap-2 py-2 text-left hover:text-blue-700"><ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}/><span className="min-w-0 truncate font-mono text-xs font-medium sm:text-sm" title={items}>{items}</span></button>
                  <span className="shrink-0 text-xs text-slate-500 tnum"><CalculationHint label={`Cách tính WUS mẫu ${items}`} explain={() => sampleCalculation(sample, data)}>{sample.wus === null ? "Cắt sớm" : `WUS ${n(sample.wus)}`}</CalculationHint></span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium ${sample.accepted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{sample.accepted ? <Check size={12}/> : <X size={12}/>}<span>{sample.accepted ? "Giữ" : "Loại"}</span></span>
                </div>
                {open && <DetailPopover title={`Chi tiết mẫu ${items}`} onClose={() => setExpanded(null)}><div id={detailId} className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4 text-xs" data-testid="audit-sample-detail">
                  <p className="break-words font-medium text-slate-700">{items}</p>
                  <p className="text-slate-500">{operationNames[sample.operation]}{sample.support !== null && ` · ${sample.support} giao dịch chứa mẫu`}</p>
                  {sample.wus !== null && sample.numerator !== null ? <>
                    <div className="grid grid-cols-2 gap-3"><div><p className="text-slate-500">TWU của mẫu</p><p className="mt-1 break-all font-mono text-slate-800"><CalculationHint label={`Cách tính TWU mẫu ${items}`} explain={() => sampleCalculation(sample, data)}>{n(sample.numerator, 6)}</CalculationHint></p></div><div><p className="text-slate-500">TWU cửa sổ</p><p className="mt-1 break-all font-mono text-slate-800"><CalculationHint label={`Cách tính tổng TWU cửa sổ W${target.windowId}`} explain={() => windowCalculation(data)}>{n(data.sumTwu, 6)}</CalculationHint></p></div></div>
                    <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3"><p className="break-words font-mono text-slate-700">WUS = {n(sample.numerator, 6)} / {n(data.sumTwu, 6)} = {n(sample.wus, 6)}</p><p className={sample.accepted ? "text-emerald-700" : "text-slate-600"}>{sample.accepted ? "Đạt ngưỡng" : "Dưới ngưỡng"} {n(data.config.minWus)} → {sample.accepted ? "Giữ mẫu" : "Cắt nhánh"}</p></div>
                  </> : <p className="rounded-lg bg-white p-3 leading-relaxed text-slate-600">Cắt sớm vì cận trên trọng số {sample.pruningBound === null ? "không đạt ngưỡng" : `${n(sample.pruningBound, 6)} không đủ để đạt ngưỡng`}. Phép giao chưa tính hết nên chưa có WUS chính xác.</p>}
                  <details className="text-slate-500"><summary className="py-1 font-medium">Dữ liệu kỹ thuật</summary><div className="mt-2 space-y-2 leading-relaxed">
                    {sample.operation.endsWith("INTERSECTION") && <p>Kích thước đầu vào: {sample.leftSize} và {sample.rightSize}{sample.wus !== null ? ` → ${sample.outputSize} ${ct ? "lcTid" : "mã"}` : ""}.</p>}
                    {sample.evidence.length > 0 ? <p className="break-all rounded-lg bg-white p-2 font-mono text-[11px]">{ct ? "lcTid" : "WUN-code"}: {sample.evidence.join("; ")}{sample.outputSize > sample.evidence.length ? "; …" : ""}</p> : <p>{sample.pruningBound !== null ? `Cận trên: ${n(sample.pruningBound, 12)}; kiểm tra với biên bảo thủ DECIMAL128.` : "Không tạo danh sách mã cho ứng viên này."}</p>}
                    {sample.itemsTruncated && <p>Tên mẫu dài được rút gọn trong bản ghi.</p>}
                  </div></details>
                </div></DetailPopover>}
              </article>
            })}
            {samples.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">Không có ví dụ phù hợp.</p>}
          </div>}
        </div>
      </section>
          <div className="audit-log-footer flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
            <p>Chi tiết {data?.samples.length ?? 0}/{formatNumber(data?.evaluatedCandidates ?? 0)} ứng viên. Tối đa {data?.sampleLimit ?? 48} ví dụ/cửa sổ.</p>
            {pages > 1 && <div className="flex items-center gap-2" aria-label="Phân trang audit"><button aria-label="Trang trước audit" disabled={page === 0} className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30" onClick={() => changePage(page - 1)}><ChevronLeft size={15}/></button><span className="tnum">{page + 1}/{pages}</span><button aria-label="Trang sau audit" disabled={page + 1 >= pages} className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30" onClick={() => changePage(page + 1)}><ChevronRight size={15}/></button></div>}
          </div>
    </div>
}
