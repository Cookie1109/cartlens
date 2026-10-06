import { BarChart3, GitCompareArrows, LayoutDashboard, Menu, PackageSearch, ShoppingBasket, X } from "lucide-react"
import { useState } from "react"
import { useApp } from "./AppProvider"
import type { Page } from "../types/api"
import OverviewPage from "../features/overview/OverviewPage"
import TransactionsPage from "../features/transactions/TransactionsPage"
import MiningPage from "../features/mining/MiningPage"
import ResultsPage from "../features/results/ResultsPage"
import ComparisonPage from "../features/comparison/ComparisonPage"

const pages: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "transactions", label: "Giao dịch", icon: ShoppingBasket },
  { id: "mining", label: "Khai phá", icon: PackageSearch },
  { id: "results", label: "Kết quả", icon: BarChart3 },
  { id: "comparison", label: "So sánh", icon: GitCompareArrows },
]

const views: Record<Page, () => React.JSX.Element> = { overview: OverviewPage, transactions: TransactionsPage, mining: MiningPage, results: ResultsPage, comparison: ComparisonPage }

export default function AppShell() {
  const { page, setPage, streamId, status } = useApp()
  const [open, setOpen] = useState(false)
  const View = views[page]
  const navigate = (next: Page) => { setPage(next); setOpen(false) }
  return <div className="min-h-full bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-label="Mở menu">{open ? <X size={20}/> : <Menu size={20}/>}</button>
        <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white"><ShoppingBasket size={19}/></span>CartLens</div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500"><span className={`size-2 rounded-full ${status === "error" ? "bg-red-500" : status === "loading" ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`}/><span className="hidden sm:inline">{streamId ? `Stream ${streamId.slice(0, 8)}` : "Đang khởi tạo"}</span></div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl">
      <aside className={`${open ? "block" : "hidden"} fixed inset-x-0 top-16 z-20 border-b border-slate-200 bg-white p-3 md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r`}>
        <nav className="space-y-1" aria-label="Điều hướng chính">{pages.map(({ id,label,icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${page === id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon size={18}/>{label}</button>)}</nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><View /></main>
    </div>
  </div>
}
