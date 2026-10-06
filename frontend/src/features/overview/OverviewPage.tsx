import { Activity, Boxes, Layers3, PlayCircle } from "lucide-react"
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui"
import { useApp } from "../../app/AppProvider"

export default function OverviewPage() {
  const { overview, transactions, run, setPage, error, status, refresh } = useApp()
  const latest = overview?.latestRun ?? run
  const stats = [
    ["Giao dịch", overview?.transactionCount ?? transactions.length, Boxes],
    ["Pane hoàn tất", overview?.completedPaneCount ?? "—", Layers3],
    ["FWUP gần nhất", latest?.patterns.length ?? "—", Activity],
  ] as const
  return <><PageHeading title="Tổng quan" description="Theo dõi dữ liệu luồng và lần khai phá gần nhất từ backend." action={<Button variant="secondary" onClick={() => void refresh().catch(() => undefined)} disabled={status === "loading"}>Làm mới</Button>}/><ErrorBanner message={error}/>
    <div className="grid gap-4 sm:grid-cols-3">{stats.map(([label,value,Icon]) => <Card key={label}><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon className="text-blue-600" size={20}/></div><p className="mt-4 text-3xl font-bold tnum">{value}</p></Card>)}</div>
    <Card className="mt-5"><div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Luồng làm việc</h2><p className="mt-1 text-sm text-slate-500">Nạp giao dịch, cấu hình cửa sổ, chạy thuật toán rồi đối chiếu với Oracle.</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">{["1. Giao dịch","2. Khai phá","3. Kết quả","4. So sánh"].map(x => <span className="rounded-full bg-slate-100 px-3 py-1.5" key={x}>{x}</span>)}</div></div><Button onClick={() => setPage(transactions.length ? "mining" : "transactions")}><PlayCircle size={17}/>{transactions.length ? "Cấu hình khai phá" : "Thêm dữ liệu"}</Button></div></Card>
  </>
}
