import { X } from "lucide-react"
import { useId, useLayoutEffect, useRef, type ReactNode } from "react"

/** Show long explanations without changing the paginated modal's dimensions. */
export default function DetailPopover({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const popup = useRef<HTMLDivElement>(null)
  const disposing = useRef(false)
  const titleId = useId()
  useLayoutEffect(() => {
    const element = popup.current
    const previous = document.activeElement
    disposing.current = false
    element?.showPopover()
    element?.querySelector("button")?.focus({ preventScroll: true })
    return () => {
      disposing.current = true
      if (element?.matches(":popover-open")) element.hidePopover()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return <div ref={popup} popover="auto" role="dialog" aria-labelledby={titleId}
    onBeforeToggle={event => { if (event.newState === "closed" && !disposing.current) onClose() }}
    className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-3rem)] w-[calc(100%-3rem)] max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><h3 id={titleId} className="text-sm font-semibold">{title}</h3><button autoFocus type="button" aria-label="Đóng chi tiết" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16}/></button></div>
    <div className="max-h-[min(480px,calc(100dvh-8rem))] overflow-y-auto overscroll-contain p-4 text-xs">{children}</div>
  </div>
}
