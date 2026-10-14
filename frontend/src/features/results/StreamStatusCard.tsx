import { useApp } from "../../app/AppProvider"
import { formatNumber } from "../../components/ui"

export default function StreamStatusCard() {
  const { overview } = useApp()
  const config = overview?.configuration.config
  const paneSize = config?.paneSize ?? 0
  const capacity = config?.windowPaneCount ?? 0
  const buffered = overview?.metrics.bufferedTransactions ?? 0
  const windowPanes = paneSize > 0 ? Math.min(capacity, Math.max(0, Math.floor(((overview?.metrics.retainedTransactions ?? 0) - buffered) / paneSize))) : 0
  const paneText = paneSize > 0 ? `${formatNumber(buffered)} / ${formatNumber(paneSize)}` : "—"
  const windowText = capacity > 0 ? `${formatNumber(windowPanes)} / ${formatNumber(capacity)} pane` : "—"

  return <section className="col-span-2 min-w-0 sm:col-span-1" aria-label="Theo dõi luồng">
    <h2 className="mb-1 text-xs font-semibold text-slate-700">Theo dõi luồng</h2>
    <dl data-testid="stream-live-status" className="grid grid-cols-2 gap-3">
      <div>
        <dt className="text-[10px] text-slate-500">Pane đang nhận</dt>
        <dd className="font-semibold text-slate-900 tnum">{paneText}<span className="ml-1 text-[10px] font-normal text-slate-500">giao dịch</span></dd>
        <div role="progressbar" aria-label="Giao dịch trong pane hiện tại" aria-valuemin={0} aria-valuemax={paneSize || 1} aria-valuenow={buffered} aria-valuetext={`${paneText} giao dịch`} className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{width: `${paneSize > 0 ? Math.min(100, buffered / paneSize * 100) : 0}%`}}/>
        </div>
      </div>
      <div>
        <dt className="text-[10px] text-slate-500">Cửa sổ</dt>
        <dd className="font-semibold text-slate-900 tnum">{windowText}</dd>
        <div role="progressbar" aria-label="Pane hoàn tất trong cửa sổ" aria-valuemin={0} aria-valuemax={capacity || 1} aria-valuenow={windowPanes} aria-valuetext={windowText} className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{width: `${capacity > 0 ? windowPanes / capacity * 100 : 0}%`}}/>
        </div>
      </div>
    </dl>
  </section>
}
