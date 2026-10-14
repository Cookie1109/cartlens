import { BarChart3, GitBranch, Layers3, LayoutDashboard, Menu, Settings2, ShoppingBasket, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApp } from "./AppProvider"
import type { Page } from "../types/api"
import OverviewPage from "../features/overview/OverviewPage"
import TransactionsPage from "../features/transactions/TransactionsPage"
import ConfigurationPage from "../features/transactions/ConfigurationPage"
import AlgorithmPage from "../features/results/AlgorithmPage"
import ComparisonPage from "../features/results/ComparisonPage"

const pages: { id: Page; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Tổng quan", description: "Dữ liệu và tiến độ xử lý", icon: LayoutDashboard },
  { id: "transactions", label: "Giao dịch", description: "Nhập và theo dõi dữ liệu", icon: ShoppingBasket },
  { id: "configuration", label: "Cấu hình luồng", description: "Thiết lập cửa sổ và ngưỡng", icon: Settings2 },
  { id: "ct", label: "FWUDS-CT", description: "CTset và kết quả trực tiếp", icon: Layers3 },
  { id: "dwt", label: "FWUDS-DWT", description: "DSWUN-tree và kết quả", icon: GitBranch },
  { id: "comparison", label: "So sánh", description: "Thời gian và bộ nhớ", icon: BarChart3 },
]

const views: Record<Page, () => React.JSX.Element> = { overview: OverviewPage, transactions: TransactionsPage, configuration: ConfigurationPage, ct: () => <AlgorithmPage algorithm="ct"/>, dwt: () => <AlgorithmPage algorithm="dwt"/>, comparison: ComparisonPage }

export default function AppShell() {
  const { page, setPage, streamId, status } = useApp()
  const [open, setOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const activePage = pages.some(item => item.id === page) ? page : "dwt"
  const View = views[activePage]
  const navigate = (next: Page) => { setPage(next); setOpen(false); mainRef.current?.focus({preventScroll:true}) }
  useEffect(() => { window.scrollTo(0,0); mainRef.current?.focus({preventScroll:true}) }, [activePage])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    if (window.innerWidth < 768) document.body.style.overflow = "hidden"
    navRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); menuRef.current?.focus() }
      if (event.key === "Tab" && window.innerWidth < 768) {
        const buttons = Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); menuRef.current?.focus() }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); menuRef.current?.focus() }
        else if (document.activeElement === menuRef.current) { event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus() }
      }
    }
    const resize = () => { if (window.innerWidth >= 768) setOpen(false) }
    window.addEventListener("keydown", keydown); window.addEventListener("resize", resize)
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); window.removeEventListener("resize", resize) }
  }, [open])
  return <div className="app-shell min-h-full bg-slate-50">
    <a href="#main-content" className="sr-only z-50 rounded-lg bg-blue-600 px-4 py-2 text-white focus:fixed focus:left-4 focus:top-3 focus:not-sr-only">Đi tới nội dung</a>
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button ref={menuRef} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Đóng menu" : "Mở menu"}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
        <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white"><ShoppingBasket size={19}/></span><span>CartLens<span className="ml-2 hidden text-xs font-normal tracking-normal text-slate-500 sm:inline">Phân tích luồng giao dịch</span></span></div>
        <div aria-label={`Trạng thái hệ thống: ${status === "error" ? "Có lỗi" : status === "loading" ? "Đang cập nhật" : "Đã kết nối"}`} className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><span aria-hidden="true" className={`size-2 rounded-full ${status === "error" ? "bg-red-500" : status === "loading" ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`}/><span>{status === "error" ? "Có lỗi" : status === "loading" ? "Đang cập nhật" : "Đã kết nối"}</span><span className="hidden text-slate-400 lg:inline">·</span><span className="hidden lg:inline">{streamId ? `Luồng ${streamId.slice(0, 8)}` : "Đang khởi tạo"}</span></div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl">
      {open && <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-x-0 bottom-0 top-16 z-10 bg-slate-950/20 md:hidden"/>}
      <aside className={`${open ? "block" : "hidden"} fixed inset-x-0 top-16 z-20 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-slate-200 bg-white p-3 md:sticky md:top-16 md:block md:h-[calc(100dvh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r`}>
        <div className="mb-3 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Không gian làm việc</div>
        <nav ref={navRef} id="main-navigation" className="space-y-1" aria-label="Điều hướng chính">{pages.map(({ id,label,description,icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-label={label} aria-current={activePage === id ? "page" : undefined} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${activePage === id ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon className="shrink-0" size={18}/><span><span className="block text-sm font-semibold">{label}</span><span className={`mt-0.5 block text-xs ${activePage === id ? "text-blue-600/75" : "text-slate-500"}`}>{description}</span></span></button>)}</nav>
        <p className="mt-5 hidden border-t border-slate-100 px-3 pt-4 text-[11px] text-slate-500 md:block">Hai thuật toán · một luồng dữ liệu<br/><span className="mt-1 block">Cập nhật mỗi 500 ms</span></p>
      </aside>
      <main ref={mainRef} id="main-content" tabIndex={-1} inert={open} className={`min-w-0 flex-1 outline-none ${["ct","dwt","comparison"].includes(activePage) ? "h-[calc(100dvh-4rem)] overflow-hidden p-3 sm:p-4" : "p-4 sm:p-6"}`}><div className={`mx-auto max-w-5xl ${["ct","dwt","comparison"].includes(activePage) ? "h-full min-h-0" : ""}`}><View /></div></main>
    </div>
  </div>
}
