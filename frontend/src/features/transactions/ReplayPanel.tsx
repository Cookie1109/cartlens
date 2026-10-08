import { useState } from "react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, formatNumber, inputClass } from "../../components/ui"
import { toApiAlgorithm, toUiAlgorithm } from "../../services/cartLensApi"
import type { ApplyMode, ReplayOptions } from "../../types/api"
const labels: Record<string,string> = { RUNNING: "Đang chạy", PAUSING: "Đang chờ hết batch", PAUSED: "Đã tạm dừng", STOPPING: "Đang dừng", STOPPED: "Đã dừng", COMPLETED: "Hoàn tất", FAILED: "Có lỗi", RECOVERED: "Chờ tiếp tục sau khôi phục" }
export default function ReplayPanel() {
  const { source,replay,replayActive,startReplay,controlReplay,overview,config,setConfig,algorithm,setAlgorithm,status,replayOptions: options,setReplayOptions: setOptions,applyReplayConfiguration,saveConfiguration } = useApp()
  const [mode,setMode] = useState<ApplyMode>("CONTINUE")
  const busy = status === "loading"
  const locked = busy || !!replay && ["RUNNING","PAUSING","STOPPING"].includes(replay.state)
  const snapshot = replay?.request
  const draft = { algorithm: toApiAlgorithm(algorithm), ...config, ...options }
  const dirty = !!snapshot && Object.entries(draft).some(([key,value]) => snapshot[key as keyof typeof snapshot] !== value)
  const weightsChanged = !!snapshot && (snapshot.weightMode !== options.weightMode || options.weightMode === "SYNTHETIC_BATCH" && (snapshot.seed !== options.seed || snapshot.weightBatchSize !== options.weightBatchSize))
  const canContinue = !!replay && ["PAUSED","STOPPED","RECOVERED"].includes(replay.state)
  const applyMode: ApplyMode = weightsChanged || !canContinue ? "RESTART" : mode
  const valid = config.paneSize >= 1 && config.windowPaneCount >= 1 && config.paneSize * config.windowPaneCount <= 100000 && config.minWus >= 0 && config.minWus <= 1
  const numeric = (key: keyof ReplayOptions, value: string) => setOptions({ ...options, [key]: Number(value) })
  const field = (key: keyof typeof config, value: string) => setConfig({ ...config, [key]: Number(value) })
  const control = (action: "pause" | "resume" | "stop") => void controlReplay(action).catch(() => undefined)
  return <Card className="mb-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Luồng Chainstore</h2><p className="mt-1 text-sm text-slate-500">Mỗi pane hoàn tất tự cập nhật và khai phá cửa sổ bằng cấu hình phiên chạy.</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${replayActive ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{replay ? labels[replay.state] : "Chưa chạy"}</span></div>
    {source?.available ? <p className="mt-3 text-xs text-slate-500">{formatNumber(source.itemCount)} sản phẩm · {formatNumber(source.transactionFileBytes / 1024 / 1024,2)} MiB</p> : <p className="mt-3 text-sm text-red-700">{source?.error ?? "Đang kiểm tra nguồn dữ liệu…"}</p>}
    {snapshot && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900" data-testid="run-configuration"><p className="font-semibold">Run configuration · phiên bản {replay?.configurationVersion ?? 1}</p><p className="mt-1">{toUiAlgorithm(snapshot.algorithm)} · pane {snapshot.paneSize} · window {snapshot.windowPaneCount} pane · MinWUS {snapshot.minWus} · {snapshot.weightMode === "PROVIDED_UTILITY" ? "Utility gốc" : `Trọng số mô phỏng, batch ${snapshot.weightBatchSize}, seed ${snapshot.seed}`}</p><p className="mt-1 text-xs">{snapshot.transactionsPerSecond} giao dịch/giây (0: tối đa) · giới hạn {snapshot.maxTransactions || "cuối file"}</p></div>}
    <form onSubmit={event => { event.preventDefault(); if (!valid || locked || replay?.restartPending && !dirty) return; void (replay ? applyReplayConfiguration(applyMode) : startReplay(options)).catch(() => undefined) }}>
      <fieldset disabled={locked} className="mt-4"><legend className="text-sm font-semibold">{replay ? "Cấu hình cho bước tiếp theo" : "Cấu hình trước khi bắt đầu"}</legend>
        <div className="mt-3 flex flex-wrap gap-4">{(["FWUDS-CT","FWUDS-DWT"] as const).map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="algorithm" checked={algorithm === value} onChange={() => setAlgorithm(value)}/>{value}</label>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Kích thước pane<input className={`${inputClass} mt-1`} type="number" min="1" max="100000" step="1" required value={config.paneSize} onChange={e => field("paneSize",e.target.value)}/></label>
          <label className="text-sm font-medium">Số pane trong window<input className={`${inputClass} mt-1`} type="number" min="1" max="100000" step="1" required value={config.windowPaneCount} onChange={e => field("windowPaneCount",e.target.value)}/></label>
          <label className="text-sm font-medium">Ngưỡng minWus<input className={`${inputClass} mt-1`} type="number" min="0" max="1" step="any" required value={config.minWus} onChange={e => field("minWus",e.target.value)}/><span className="mt-1 block text-xs font-normal text-slate-500">0.005 = 0.5%. Window tối đa 100.000 giao dịch.</span></label>
          <label className="text-sm font-medium">Trọng số<select aria-label="Trọng số" className={`${inputClass} mt-1`} value={options.weightMode} onChange={e => setOptions({ ...options,weightMode: e.target.value as ReplayOptions["weightMode"] })}><option value="PROVIDED_UTILITY">Giữ utility gốc</option><option value="SYNTHETIC_BATCH">Mô phỏng trọng số thay đổi theo batch</option></select></label>
          <label className="text-sm font-medium">Tốc độ giao dịch/giây<input className={`${inputClass} mt-1`} type="number" min="0" max="100000" step="1" required value={options.transactionsPerSecond} onChange={e => numeric("transactionsPerSecond",e.target.value)}/><span className="mt-1 block text-xs font-normal text-slate-500">0: chạy theo tốc độ xử lý thực tế.</span></label>
          <label className="text-sm font-medium">Số giao dịch muốn đọc<input className={`${inputClass} mt-1`} type="number" min="0" step="1" required value={options.maxTransactions} onChange={e => numeric("maxTransactions",e.target.value)}/><span className="mt-1 block text-xs font-normal text-slate-500">0: đọc đến cuối file.</span></label>
          {options.weightMode === "SYNTHETIC_BATCH" && <><label className="text-sm font-medium">Giao dịch mỗi batch<input className={`${inputClass} mt-1`} type="number" min="1" step="1" required value={options.weightBatchSize} onChange={e => numeric("weightBatchSize",e.target.value)}/></label><label className="text-sm font-medium">Seed tái hiện<input className={`${inputClass} mt-1`} type="number" step="1" required value={options.seed} onChange={e => numeric("seed",e.target.value)}/></label></>}
        </div>
      </fieldset>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{options.weightMode === "PROVIDED_UTILITY" ? "Quantity=1, weight=utility giữ nguyên TWU của file. Total Investment dùng làm metadata; không suy diễn số lượng mua gốc." : "Quantity=1, trọng số 1–10 tái hiện theo seed/batch. Đây là dữ liệu mô phỏng; batch có thể khác ranh giới pane."}</p>
      {!valid && <p role="alert" className="mt-2 text-sm text-red-700">Pane/window phải dương, tổng window không quá 100.000 giao dịch và MinWUS trong [0,1].</p>}
      {replay && !locked && (!replay.restartPending || dirty) && <div className="mt-4"><label className="text-sm font-medium">Sau khi áp dụng<select aria-label="Sau khi áp dụng" className={`${inputClass} mt-1`} value={applyMode} disabled={weightsChanged || !canContinue} onChange={e => setMode(e.target.value as ApplyMode)}><option value="CONTINUE">Tiếp tục từ checkpoint hiện tại</option><option value="RESTART">Restart từ đầu trong stream mới</option></select></label><p className="mt-2 text-xs text-slate-500">{applyMode === "RESTART" ? "Tạo stream mới từ giao dịch 1 và giữ lịch sử stream cũ. Áp dụng xong, bấm Restart để chạy." : "Tạo phiên mining mới từ cửa sổ hiện tại và pane đang nhận; giữ lịch sử phiên cũ. Áp dụng xong, bấm Tiếp tục."}</p>{weightsChanged && <p className="mt-2 text-sm text-amber-800">Đổi quy tắc trọng số cần Restart để tránh trộn trọng số giữa các phiên.</p>}</div>}
      {replay?.restartPending && !dirty && <p className="mt-3 text-sm text-blue-800">Stream mới đã sẵn sàng từ giao dịch 1. Bấm Restart để bắt đầu với cấu hình đã áp dụng.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!replay && <><Button type="submit" disabled={busy || !valid || !source?.available || (overview?.transactionCount ?? 0) > 0}>Bắt đầu Chainstore</Button><Button type="button" variant="secondary" disabled={busy || !valid} onClick={() => void saveConfiguration().catch(() => undefined)}>Lưu cấu hình</Button></>}
        <Button type="button" variant="secondary" disabled={locked} onClick={() => { setConfig({ paneSize: 1000,windowPaneCount: 4,minWus: 0.005 }); setAlgorithm("FWUDS-DWT") }}>Cấu hình Chainstore</Button>
        {replay?.state === "RUNNING" && <Button type="button" variant="secondary" onClick={() => control("pause")} disabled={busy}>Tạm dừng</Button>}
        {replay && !locked && (!replay.restartPending || dirty) && <Button type="submit" disabled={busy || !valid || !source?.available || applyMode === "CONTINUE" && !dirty}>Áp dụng</Button>}
        {canContinue && <Button type="button" variant="secondary" onClick={() => control("resume")} disabled={busy || dirty || applyMode === "RESTART" && !replay?.restartPending}>{replay?.restartPending ? "Restart" : "Tiếp tục"}</Button>}
        {replayActive && <Button type="button" variant="danger" onClick={() => control("stop")} disabled={busy || replay?.state === "STOPPING"}>Dừng</Button>}
      </div>
      <p className="mt-3 text-xs text-slate-500">{locked ? "Cấu hình đã khóa. Tạm dừng trước khi chỉnh sửa." : dirty ? "Có thay đổi chưa áp dụng. Bấm Áp dụng trước khi tiếp tục." : replay ? "Cấu hình phiên đã lưu; mỗi pane sẽ tự tạo kết quả." : "Bắt đầu sẽ khóa cấu hình này cho phiên chạy. Replay mới cần stream rỗng."}</p>
    </form>
    {replay && <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Đã nạp</p><p className="mt-1 font-semibold tnum">{formatNumber(replay.processedTransactions)}</p></div><div><p className="text-xs text-slate-500">Thời gian phiên</p><p className="mt-1 font-semibold tnum">{formatNumber(replay.elapsedMs / 1000,2)} giây</p></div><div><p className="text-xs text-slate-500">Đang giữ trong cửa sổ/buffer</p><p className="mt-1 font-semibold tnum">{formatNumber(overview?.metrics.retainedTransactions ?? 0)}</p></div></div>}
    {replay?.error && <p role="alert" className={`mt-3 text-sm ${replay.state === "FAILED" ? "text-red-700" : "text-slate-600"}`}>{replay.error}</p>}
  </Card>
}
