import { BarChart3, LayoutDashboard, Menu, Settings2, ShoppingBasket, X } from "lucide-react"
import { useState } from "react"
import { useApp } from "./AppProvider"
import type { Page } from "../types/api"
import OverviewPage from "../features/overview/OverviewPage"
import TransactionsPage from "../features/transactions/TransactionsPage"
import ConfigurationPage from "../features/transactions/ConfigurationPage"
import ResultsPage from "../features/results/ResultsPage"

const pages: { id: Page; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Tổng quan", description: "Bắt đầu và theo dõi luồng", icon: LayoutDashboard },
  { id: "transactions", label: "Giao dịch", description: "Nhập và theo dõi dữ liệu", icon: ShoppingBasket },
  { id: "configuration", label: "Cấu hình luồng", description: "Thiết lập thuật toán và luồng", icon: Settings2 },
  { id: "results", label: "Kết quả", description: "Xem các mẫu đã tìm thấy", icon: BarChart3 },
]

const views: Record<Page, () => React.JSX.Element> = { overview: OverviewPage, transactions: TransactionsPage, configuration: ConfigurationPage, results: ResultsPage }

export default function AppShell() {
  const { page, setPage, streamId, status } = useApp()
  const [open, setOpen] = useState(false)
  const View = views[page]
  const navigate = (next: Page) => { setPage(next); setOpen(false) }
  return <div className="min-h-full bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Đóng menu" : "Mở menu"}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
        <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white"><ShoppingBasket size={19}/></span><span>CartLens<span className="ml-2 hidden text-xs font-normal tracking-normal text-slate-500 sm:inline">Phân tích luồng giao dịch</span></span></div>
        <div aria-label={`Trạng thái hệ thống: ${status === "error" ? "Có lỗi" : status === "loading" ? "Đang cập nhật" : "Đã kết nối"}`} className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><span aria-hidden="true" className={`size-2 rounded-full ${status === "error" ? "bg-red-500" : status === "loading" ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`}/><span>{status === "error" ? "Có lỗi" : status === "loading" ? "Đang cập nhật" : "Đã kết nối"}</span><span className="hidden text-slate-400 lg:inline">·</span><span className="hidden lg:inline">{streamId ? `Luồng ${streamId.slice(0, 8)}` : "Đang khởi tạo"}</span></div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl">
      <aside className={`${open ? "block" : "hidden"} fixed inset-x-0 top-16 z-20 border-b border-slate-200 bg-white p-3 md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r`}>
        <div className="mb-3 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Không gian làm việc</div>
        <nav className="space-y-1" aria-label="Điều hướng chính">{pages.map(({ id,label,description,icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-label={label} aria-current={page === id ? "page" : undefined} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${page === id ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon className="shrink-0" size={18}/><span><span className="block text-sm font-semibold">{label}</span><span className={`mt-0.5 block text-xs ${page === id ? "text-blue-600/75" : "text-slate-400"}`}>{description}</span></span></button>)}</nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-5xl"><View /></div></main>
    </div>
  </div>
}
