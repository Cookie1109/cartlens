import { useApp } from "../../app/AppProvider"
import { Card, ErrorBanner, PageHeading, formatNumber } from "../../components/ui"
import { toUiAlgorithm } from "../../services/cartLensApi"
import ReplayPanel from "../transactions/ReplayPanel"

export default function MiningPage() {
  const { overview,error } = useApp()
  const active = overview?.configuration
  const missing = active ? Math.max(0,active.config.paneSize * active.config.windowPaneCount - overview.transactionCount) : 0
  return <>
    <PageHeading title="Khai phá" description="Chọn cấu hình, bắt đầu stream; mỗi pane tự cập nhật và khai phá."/>
    <ErrorBanner message={error ?? overview?.miningError ?? null}/>
    <ReplayPanel/>
    {active && <Card className="mb-5">
      <h2 className="font-semibold">Khai phá tự động</h2>
      <p className="mt-2 text-sm text-slate-600">Thuật toán đang áp dụng: <strong>{toUiAlgorithm(active.algorithm)}</strong> · {formatNumber(active.config.paneSize)} giao dịch/pane · {active.config.windowPaneCount} pane/window · minWus {active.config.minWus}.</p>
      <p className="mt-2 text-sm text-slate-600">{!overview.latestRun ? `Đang chờ đủ cửa sổ đầu tiên: còn ${formatNumber(missing)} giao dịch.` : `Window mới nhất: #${overview.latestRun.windowId}. Pane mới hoàn tất sẽ tự tạo kết quả tiếp theo.`}</p>
      <p className="mt-2 text-xs text-slate-500">Pane đang nhận: {formatNumber(overview.metrics.bufferedTransactions)}/{formatNumber(active.config.paneSize)} giao dịch. Kết quả tự cập nhật mỗi giây khi theo dõi window mới nhất.</p>
    </Card>}
  </>
}
