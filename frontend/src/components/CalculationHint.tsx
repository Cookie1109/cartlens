import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"

/** Native top-layer popover stays visible above dialogs and outside scroll clipping. */
export default function CalculationHint({ label, children, explain }: { label: string; children: ReactNode; explain: () => ReactNode }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLSpanElement>(null)
  const pinned = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const cancelHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = null }
  const close = () => { cancelHide(); pinned.current = false; setOpen(false) }
  const leave = () => {
    cancelHide()
    if (!pinned.current && document.activeElement !== trigger.current) hideTimer.current = setTimeout(() => setOpen(false), 150)
  }
  useLayoutEffect(() => {
    const element = popup.current
    const button = trigger.current
    if (!open || !element || !button) return
    element.showPopover()
    const place = () => {
      const box = button.getBoundingClientRect()
      const width = Math.min(360, window.innerWidth - 24)
      element.style.width = `${width}px`
      const height = element.getBoundingClientRect().height
      const below = box.bottom + 8
      element.style.left = `${Math.min(Math.max(12, box.left + box.width / 2 - width / 2), window.innerWidth - width - 12)}px`
      element.style.top = `${Math.max(12, Math.min(below + height <= window.innerHeight - 12 ? below : box.top - height - 8, window.innerHeight - height - 12))}px`
    }
    place()
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && element.contains(event.target)) return
      if (document.activeElement === button) place()
      else close()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", close)
    window.addEventListener("keydown", onEscape, true)
    return () => {
      cancelHide()
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", close)
      window.removeEventListener("keydown", onEscape, true)
      if (element.matches(":popover-open")) element.hidePopover()
    }
  }, [open])
  return <span className="inline-flex max-w-full align-baseline">
    <button ref={trigger} type="button" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open} popoverTarget={id}
      className="max-w-full cursor-help rounded-sm border-b border-dotted border-current text-inherit underline-offset-4 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      onPointerEnter={event => { if (event.pointerType !== "touch") { cancelHide(); setOpen(true) } }} onPointerLeave={leave}
      onFocus={() => { cancelHide(); setOpen(true) }} onBlur={close}
      onClick={event => { event.preventDefault(); cancelHide(); pinned.current = !pinned.current; setOpen(pinned.current) }}>{children}</button>
    {open && <span ref={popup} id={id} popover="auto" role="tooltip" aria-label={label}
      onPointerEnter={cancelHide} onPointerLeave={leave}
      onBeforeToggle={event => { if (event.newState === "closed" && event.currentTarget === popup.current) { pinned.current = false; setOpen(false) } }}
      className="fixed inset-auto z-50 m-0 max-h-[min(360px,calc(100dvh-24px))] overflow-y-auto whitespace-normal break-words rounded-xl border border-slate-200 bg-white p-4 text-left font-sans text-xs font-normal leading-relaxed text-slate-700 shadow-xl"
      style={{ width: "min(360px, calc(100vw - 24px))" }}>{explain()}</span>}
  </span>
}
