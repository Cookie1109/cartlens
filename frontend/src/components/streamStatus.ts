import type { ReplayStatus } from "../types/api"

export const replayLabels: Record<ReplayStatus["state"], string> = {
  RUNNING: "Đang chạy", PAUSING: "Đang chờ hết batch", PAUSED: "Đã tạm dừng",
  STOPPING: "Đang dừng", STOPPED: "Đã dừng", COMPLETED: "Hoàn tất",
  FAILED: "Có lỗi", RECOVERED: "Chờ tiếp tục sau khôi phục",
}

export function streamStatus(replay: ReplayStatus | null, failed = false) {
  const state = failed ? "FAILED" : replay?.state
  const color = state === "FAILED" ? "bg-red-50 text-red-700 ring-red-100"
    : state === "RUNNING" ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : state === "COMPLETED" ? "bg-blue-50 text-blue-700 ring-blue-100"
    : state && ["PAUSED", "PAUSING", "STOPPING", "RECOVERED"].includes(state) ? "bg-amber-50 text-amber-800 ring-amber-100"
    : "bg-slate-100 text-slate-600 ring-slate-200"
  return { label: state ? replayLabels[state] : "Chờ giao dịch", color }
}
