import { useEffect, useRef, useState } from "react"
import { cartLensApi } from "../../services/cartLensApi"
import type { MiningAudit } from "../../types/api"
import type { AuditTarget } from "./AuditLogModal"

// Coalesce window notifications; never queue one HTTP request per mined pane.
export default function useLiveAudit(target: AuditTarget) {
  const latestTarget = useRef(target)
  latestTarget.current = target
  const wake = useRef<() => void>(() => {})
  const [data, setData] = useState<MiningAudit | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let busy = false
    let lastStarted = -Infinity
    let loadedWindow = 0
    let failedWindow = 0
    setData(null); setError(null)
    const pump = () => {
      if (controller.signal.aborted || document.hidden || busy || timer) return
      const hint = latestTarget.current.windowId
      if (loadedWindow >= hint || failedWindow === hint) return
      const delay = Math.max(0, 1000 - (performance.now() - lastStarted))
      timer = setTimeout(() => {
        timer = undefined
        if (controller.signal.aborted || document.hidden) return
        busy = true
        lastStarted = performance.now()
        const requestedWindow = latestTarget.current.windowId
        void cartLensApi.latestAudit(target.streamId, target.sessionId, requestedWindow, target.algorithm, controller.signal).then(value => {
          if (controller.signal.aborted) return
          loadedWindow = value.windowId
          // A slow response must never bring retired window details back.
          if (value.windowId >= latestTarget.current.windowId) { setData(value); setError(null) }
        }).catch(reason => {
          if (!controller.signal.aborted) {
            failedWindow = requestedWindow
            setError(reason instanceof Error ? reason.message : "Không tải được audit log.")
          }
        }).finally(() => { busy = false; pump() })
      }, delay)
    }
    wake.current = () => { failedWindow = 0; setError(null); pump() }
    const visible = () => { if (!document.hidden) wake.current() }
    document.addEventListener("visibilitychange", visible)
    pump()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", visible)
      wake.current = () => {}
    }
  }, [target.streamId, target.sessionId, target.algorithm])
  useEffect(() => { wake.current() }, [target.windowId])
  return { data: data && data.windowId >= target.windowId ? data : null, config: data?.config, error, retry: () => wake.current() }
}
