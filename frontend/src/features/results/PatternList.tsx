import { useEffect, useRef, useState } from "react"
import { formatNumber } from "../../components/ui"
import { cartLensApi } from "../../services/cartLensApi"
import type { MiningRun, PatternResult } from "../../types/api"

export default function PatternList({ streamId, run, onSelect }: {
  streamId: string; run: MiningRun; onSelect: (pattern: PatternResult) => void
}) {
  const [patterns, setPatterns] = useState<PatternResult[]>([])
  const [after, setAfter] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let disposed = false
    setLoading(true); setError(false)
    void cartLensApi.window(streamId, run.runId, run.windowId, after, 100).then(value => {
      if (disposed) return
      if (!value.patterns.length && after < run.patternCount) throw new Error("Missing results")
      setPatterns(previous => [...previous.slice(0, after), ...value.patterns])
    }).catch(() => { if (!disposed) setError(true) }).finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true }
  }, [streamId, run.runId, run.windowId, run.patternCount, after, retry])
  useEffect(() => {
    if (loading || error || !patterns.length || patterns.length >= run.patternCount) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setAfter(patterns.length)
    }, { root: null, rootMargin: "120px" })
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loading, error, patterns.length, run.patternCount])
  return <div className="w-full" role="region" aria-label="Danh sách kết quả khai phá" data-testid="pattern-list">
    <table className="w-full table-fixed text-left text-xs" data-testid="pattern-table" aria-busy={loading}>
      <thead className="sticky top-16 z-10 h-8 border-b border-slate-100 bg-white text-slate-500"><tr><th className="w-[55%] font-medium">Mẫu · bấm để xem chi tiết</th><th className="font-medium">WUS</th><th className="text-right font-medium"><abbr title="Số giao dịch chứa mẫu" className="no-underline">Support</abbr></th></tr></thead>
      <tbody>{patterns.map(p => <tr key={p.items.join("|")} className="h-[30px] border-b border-slate-50 hover:bg-blue-50/40"><td className="pr-2 font-mono font-semibold text-slate-700"><button className="pattern-action truncate rounded px-1 text-blue-700" aria-label={`Xem mẫu {${p.items.join(", ")}}`} title={`{${p.items.join(", ")}}`} onClick={() => onSelect(p)}>{`{${p.items.join(", ")}}`}</button></td><td className="text-blue-700">{formatNumber(p.wus, 6)}</td><td className="text-right tabular-nums">{formatNumber(p.support)}</td></tr>)}</tbody>
    </table>
    <div ref={sentinelRef} className="py-2 text-center text-[11px] text-slate-500" role="status">
      {error ? <span className="text-red-700">Không tải được kết quả. <button className="rounded border border-red-200 px-2 py-1" onClick={() => setRetry(value => value + 1)}>Thử lại</button></span> : loading ? "Đang tải mẫu…" : patterns.length < run.patternCount ? "Cuộn để xem thêm mẫu" : `Đã hiển thị đủ ${formatNumber(patterns.length)} mẫu`}
    </div>
  </div>
}
