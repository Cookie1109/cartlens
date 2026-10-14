import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { X } from "lucide-react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</section>
}

export function Button({ children, className = "", variant = "primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-500",
  }
  return <button type={type} className={`ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p></div>{action && <div className="page-actions shrink-0">{action}</div>}</div>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-8 text-center"><p className="font-semibold text-slate-700">{title}</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{description}</p></div>
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
    else if (!open && dialog?.open) dialog.close()
  }, [open])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} onClose={onClose} className="app-modal m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Đóng hộp thoại" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
    {children}
  </dialog>
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
}

export const inputClass = "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
export const formatNumber = (value: number, maximumFractionDigits = 8) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(value)
export const formatTransactionId = (id: string) => id.replace(/^(?:chainstore:|t)([0-9]+)$/, "$1")
