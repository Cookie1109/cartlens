import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { formatNumber } from "../../components/ui"
import { cartLensApi } from "../../services/cartLensApi"
import type { Transaction, TransactionItem } from "../../types/api"
import DetailPopover from "../../components/DetailPopover"
import CalculationHint from "../../components/CalculationHint"

const pageSize = 10
const rowHeight = 65
const chunkSize = 20
const n = (value: number) => formatNumber(value, 6)

function transactionCalculation(tx: Transaction) {
  const terms = tx.items.slice(0, 6).map(item => `${formatNumber(item.quantity)} × ${formatNumber(item.weight, 12)}`)
  const sum = tx.items.reduce((value, item) => value + item.quantity * item.weight, 0)
  return <><span className="mb-2 block font-semibold text-slate-900">Cách tính TWU của {tx.id}</span><span className="block">1. Nhân số lượng với trọng số của từng item, rồi cộng lại.</span><span className="my-2 block break-all rounded-lg bg-slate-50 p-2 font-mono">{terms.join(" + ")}{tx.items.length > 6 ? " + …" : ""} = {formatNumber(sum, 12)}</span>{tx.items.length > 6 && <span className="block text-slate-500">Đang minh họa 6/{formatNumber(tx.items.length)} số hạng; tổng bao gồm tất cả item.</span>}<span className="mt-2 block">2. Chia tổng cho số item khác nhau trong giao dịch ({formatNumber(tx.items.length)}):</span><span className="my-2 block break-all rounded-lg bg-slate-50 p-2 font-mono">TWU = {formatNumber(sum, 12)} / {formatNumber(tx.items.length)} = {formatNumber(tx.twu, 12)}</span><span className="block text-slate-500">Chia cho số item, không chia cho tổng số lượng. Số hiển thị được làm tròn; TWU kết quả lấy từ backend.</span></>
}

function ItemTable({ items }: { items: TransactionItem[] }) {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState("")
  const filtered = items.filter(item => `${item.itemId} ${item.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  return <div className="space-y-2">
    {items.length > pageSize && <input type="search" aria-label="Tìm item trong giao dịch" placeholder="Tìm item…" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs"/>}
    <table className="w-full table-fixed text-left text-xs" aria-label="Item trong giao dịch">
      <thead className="text-slate-500"><tr><th className="w-1/2 pb-2 font-medium">Item</th><th className="pb-2 text-right font-medium">Số lượng</th><th className="pb-2 text-right font-medium">Trọng số</th></tr></thead>
      <tbody>{filtered.slice(page * pageSize, (page + 1) * pageSize).map(item => <tr key={item.itemId} className="border-t border-slate-100"><td className="break-words py-2 pr-2 font-mono">{item.itemId}{item.name !== item.itemId && <span className="mt-0.5 block font-sans text-slate-500">{item.name}</span>}</td><td className="break-all py-2 text-right tnum">{formatNumber(item.quantity)}</td><td className="break-all py-2 pl-2 text-right tnum">{n(item.weight)}</td></tr>)}</tbody>
    </table>
    {pages > 1 && <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{formatNumber(items.length)} item</span><div className="flex items-center gap-2"><button aria-label="Trang trước item" disabled={page === 0} onClick={() => setPage(value => value - 1)} className="rounded border border-slate-200 p-1 disabled:opacity-30"><ChevronLeft size={14}/></button><span>{page + 1}/{pages}</span><button aria-label="Trang sau item" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)} className="rounded border border-slate-200 p-1 disabled:opacity-30"><ChevronRight size={14}/></button></div></div>}
  </div>
}

function TransactionPage({ streamId, windowId, after, limit, paneSize, selected, onSelect }: { streamId: string; windowId: number; after: number; limit: number; paneSize: number; selected: string | null; onSelect: (value: { tx: Transaction; ordinal: number } | null) => void }) {
  const [rows, setRows] = useState<Transaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setRows(null); setError(null)
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return
      try {
        const value = await cartLensApi.transactions(streamId, after, limit, controller.signal)
        if (controller.signal.aborted) return
        if (value.length !== limit) throw new Error("Dữ liệu cửa sổ đã thay đổi hoặc không còn đủ giao dịch.")
        setRows(value)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu cửa sổ.")
      }
    }, 50)
    return () => { clearTimeout(timer); controller.abort() }
  }, [streamId, after, limit, retry])
  if (error) return <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700"><p>{error}</p><button className="mt-2 rounded border border-red-200 px-2 py-1" onClick={() => setRetry(value => value + 1)}>Thử tải lại giao dịch</button></div>
  if (!rows) return <p role="status" className="py-5 text-center text-xs text-slate-500">Đang tải giao dịch của W{windowId}…</p>
  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    {rows.map((tx, index) => {
      const ordinal = after + index + 1
      const open = selected === tx.id
      const detailId = `window-transaction-${ordinal}`
      return <article key={tx.id} data-testid="window-transaction" data-transaction-id={tx.id} className="border-b border-slate-100 last:border-b-0">
        <div className="flex min-h-16 items-center gap-3 px-3">
          <button aria-label={`Chi tiết giao dịch ${tx.id} trong W${windowId}`} aria-expanded={open} aria-controls={open ? detailId : undefined} onClick={() => onSelect(open ? null : { tx, ordinal })} className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-3 text-left hover:text-blue-700"><ChevronDown size={14} className={`shrink-0 text-slate-400 ${open ? "rotate-180" : ""}`}/>
          <div className="min-w-0 flex-1"><p className="flex items-center gap-2"><span className="truncate font-mono text-xs font-semibold" title={tx.id}>{tx.id}</span><span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">P{formatNumber(Math.floor((ordinal - 1) / paneSize) + 1)}</span></p><p className="mt-1 truncate text-[11px] text-slate-500" title={tx.items.slice(0, 6).map(item => item.itemId).join(", ")}>{tx.items.slice(0, 6).map(item => item.itemId).join(", ")}{tx.items.length > 6 ? `, … (${formatNumber(tx.items.length)} item)` : ""}</p></div>
          </button>
          <div className="shrink-0 text-right"><p className="text-[10px] text-slate-400">TWU</p><p className="text-xs text-slate-700 tnum"><CalculationHint label={`Cách tính TWU giao dịch ${tx.id}`} explain={() => transactionCalculation(tx)}>{n(tx.twu)}</CalculationHint></p></div>
        </div>

      </article>
    })}
  </div>
}

// A pane can be very large. Keep one small transaction block mounted and fetched;
// scroll padding represents the other rows without retaining their item arrays.
function PaneTransactions({ streamId, windowId, after, count, paneSize }: { streamId: string; windowId: number; after: number; count: number; paneSize: number }) {
  const [start, setStart] = useState(0)
  const [selected, setSelected] = useState<{ tx: Transaction; ordinal: number } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const limit = Math.min(chunkSize, count - start)
  const scrollable = count > 5
  return <div ref={viewport} role="region" aria-label="Danh sách giao dịch trong pane" tabIndex={scrollable ? 0 : undefined} data-testid="audit-transactions-scroll" data-scrollable={scrollable}
    onScroll={event => {
      const element = event.currentTarget
      const firstVisible = Math.floor(element.scrollTop / rowHeight)
      const lastVisible = Math.min(count, Math.ceil((element.scrollTop + element.clientHeight) / rowHeight))
      if (firstVisible >= start && lastVisible <= start + limit) return
      const next = Math.min(Math.max(0, count - chunkSize), Math.floor(Math.max(0, firstVisible - 2) / 10) * 10)
      setStart(next)
    }}
    className={`min-h-0 ${scrollable ? "max-h-[325px] flex-1 overflow-y-auto overscroll-contain pr-1" : "shrink-0 overflow-visible"}`}>
    <div style={{ paddingTop: start * rowHeight, paddingBottom: Math.max(0, count - start - limit) * rowHeight }}>
      <div style={{ minHeight: limit * rowHeight }}>
        <TransactionPage key={start} streamId={streamId} windowId={windowId} after={after + start} limit={limit} paneSize={paneSize} selected={selected?.tx.id ?? null} onSelect={setSelected}/>
      </div>
    </div>
    {selected && <DetailPopover title={`Giao dịch ${selected.tx.id}`} onClose={() => setSelected(null)}><div id={`window-transaction-${selected.ordinal}`} data-testid="window-transaction-detail" className="space-y-3"><p className="text-[11px] text-slate-500">Giao dịch thứ {formatNumber(selected.ordinal)} · {formatNumber(selected.tx.items.length)} item</p><ItemTable items={selected.tx.items}/></div></DetailPopover>}
  </div>
}

export default function WindowTransactions({ streamId, windowId, first, last, paneSize, page: requestedPage, setPage, ready }: { streamId: string; windowId: number; first: number; last: number; paneSize: number; page: number; setPage: (page: number) => void; ready: boolean }) {
  const [jump, setJump] = useState("")
  const count = last - first + 1
  const pages = Math.ceil(count / paneSize)
  const page = Math.min(requestedPage, pages - 1)
  const after = first - 1 + page * paneSize
  const paneCount = Math.min(paneSize, last - after)
  const paneId = Math.floor(after / paneSize) + 1
  return <section id="audit-window-data" aria-label={`Dữ liệu cửa sổ W${windowId}`} data-testid="audit-window-data" className="flex min-h-0 flex-1 flex-col gap-3 overflow-clip">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <div><h3 className="font-semibold text-slate-800">Pane P{formatNumber(paneId)} <span className="font-normal text-slate-500">· {formatNumber(paneCount)} giao dịch</span></h3><p className="mt-1">Giao dịch thứ {formatNumber(after + 1)}–{formatNumber(after + paneCount)}</p></div>
      {pages > 1 && <form aria-label="Phân trang pane" className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); const value = Number(jump); if (Number.isInteger(value) && value >= 1 && value <= pages) setPage(value - 1) }}>
        <button type="button" aria-label="Pane trước" disabled={page === 0} onClick={() => setPage(page - 1)} className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronLeft size={15}/></button>
        <label htmlFor="window-page-jump" className="sr-only">Trang pane trong cửa sổ</label><input id="window-page-jump" aria-label="Trang pane trong cửa sổ" type="number" min={1} max={pages} required value={jump} onChange={event => setJump(event.target.value)} placeholder={`${page + 1}`} className="min-h-8 w-16 rounded-lg border border-slate-200 bg-white px-2"/><span>/ {formatNumber(pages)}</span>
        <button type="submit" className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-slate-700">Đi đến pane</button>
        <button type="button" aria-label="Pane sau" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronRight size={15}/></button>
      </form>}
    </div>
    {ready ? <PaneTransactions key={`${windowId}:${page}`} streamId={streamId} windowId={windowId} after={after} count={paneCount} paneSize={paneSize}/> : <p className="py-5 text-center text-xs text-slate-500">Đang chuyển dữ liệu sang W{windowId}…</p>}
  </section>
}
