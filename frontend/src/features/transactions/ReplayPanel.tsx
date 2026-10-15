import {
  Check,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Square,
} from "lucide-react"
import { useId, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, formatNumber, inputClass } from "../../components/ui"
import {
  toReplayConfiguration,
  toUiAlgorithm,
} from "../../services/cartLensApi"
import type { ApplyMode, ReplayOptions } from "../../types/api"
import { replayLabels as labels, streamStatus } from "../../components/streamStatus"

export default function ReplayPanel({ configurationOnly = false }: { configurationOnly?: boolean }) {
  const {
    source,
    dataset,
    setDataset,
    replay,
    replayActive,
    startReplay,
    controlReplay,
    overview,
    config,
    setConfig,
    algorithm,
    setAlgorithm,
    status,
    replayOptions: options,
    setReplayOptions: setOptions,
    applyReplayConfiguration,
    saveConfiguration,
    newStream,
    setPage,
  } = useApp()
  const [mode, setMode] = useState<ApplyMode>("CONTINUE")
  const [saved, setSaved] = useState(false)
  const formId = useId()
  const busy = status === "loading"
  const locked =
    busy ||
    (!!replay && ["RUNNING", "PAUSING", "STOPPING"].includes(replay.state))
  const snapshot = replay?.request
  const draft = toReplayConfiguration(algorithm, config, options, dataset)
  const editableDirty =
    !!snapshot &&
    Object.entries({ dataset: draft.dataset, ...config, ...options }).some(
      ([key, value]) => snapshot[(key as keyof typeof snapshot)] !== value,
    )
  const weightsChanged = !!snapshot && (snapshot.weightMode !== draft.weightMode || snapshot.dataset !== dataset)
  const dirty = editableDirty || weightsChanged
  const configurationDirty =
    !!overview &&
    (Object.entries(config).some(
        ([key, value]) =>
          overview.configuration.config[(key as keyof typeof config)] !== value,
      ))
  const canContinue =
    !!replay && ["PAUSED", "STOPPED", "RECOVERED"].includes(replay.state)
  const applyMode: ApplyMode = weightsChanged || !canContinue ? "RESTART" : mode
  const windowSize = config.paneSize * config.windowPaneCount
  const active = overview?.configuration
  const activeWindowSize = active
    ? active.config.paneSize * active.config.windowPaneCount
    : 0
  const retained = overview?.metrics.retainedTransactions ?? 0
  const latest = overview?.latestRun
  const miningFailed = !!overview?.miningError || replay?.state === "FAILED"
  const valid =
    Number.isInteger(config.paneSize) &&
    config.paneSize >= 1 &&
    Number.isInteger(config.windowPaneCount) &&
    config.windowPaneCount >= 1 &&
    windowSize <= 100000 &&
    Number.isFinite(config.minWus) &&
    config.minWus >= 0 &&
    config.minWus <= 1
  const optionsValid =
    Number.isInteger(options.transactionsPerSecond) &&
    options.transactionsPerSecond >= 0 &&
    options.transactionsPerSecond <= 100000 &&
    Number.isSafeInteger(options.maxTransactions) &&
    options.maxTransactions >= 0
  const numeric = (key: keyof ReplayOptions, value: string) => {
    setSaved(false)
    setOptions({ ...options, [key]: Number(value) })
  }
  const field = (key: keyof typeof config, value: string) => {
    setSaved(false)
    setConfig({ ...config, [key]: Number(value) })
  }
  const control = (action: "pause" | "resume" | "stop") =>
    void controlReplay(action).catch(() => undefined)
  const restore = () => {
    if (snapshot) {
      const {
        paneSize,
        windowPaneCount,
        minWus,
        transactionsPerSecond,
        maxTransactions,
      } = snapshot
      setConfig({ paneSize, windowPaneCount, minWus })
      setAlgorithm(toUiAlgorithm(snapshot.algorithm))
      setDataset(snapshot.dataset ?? "RETAIL")
      setOptions({
        transactionsPerSecond,
        maxTransactions,
      })
    } else if (overview) {
      setConfig(overview.configuration.config)
      setAlgorithm(toUiAlgorithm(overview.configuration.algorithm))
    }
    setSaved(false)
  }
  const stateColor = streamStatus(replay, !!overview?.miningError).color
  const editor = (
    <form
      id={formId}
      className="mt-5 border-t border-slate-100 pt-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          !valid ||
          !optionsValid ||
          locked ||
          (replay?.restartPending && !dirty)
        )
          return
        void (
          replay ? applyReplayConfiguration(applyMode) : startReplay(options)
        ).catch(() => undefined)
      }}
    >
      {active && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs">
          <p className="text-slate-600">
            Hai thuật toán đang áp dụng:{" "}
            <strong>FWUDS-CT + FWUDS-DWT</strong>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {active.config.windowPaneCount} pane ×{" "}
            {formatNumber(active.config.paneSize)} giao dịch · MinWUS{" "}
            {active.config.minWus}
          </p>
          {!latest && miningFailed && <p className="mt-3 text-xs text-red-700" role="status">Khai phá đã dừng do lỗi; chưa có kết quả cửa sổ đầu tiên. Kiểm tra thông báo lỗi và áp dụng cấu hình để chạy lại.</p>}
          {!latest && !miningFailed && (
            <div className="mt-3">
              <p className="text-xs text-slate-600">
                Chờ cửa sổ đầu tiên: còn{" "}
                {formatNumber(Math.max(0, activeWindowSize - retained))} giao
                dịch.
              </p>
              <progress
                aria-label="Tiến độ cửa sổ đầu tiên"
                className="mt-2 h-1.5 w-full accent-blue-600"
                max={activeWindowSize || 1}
                value={Math.min(retained, activeWindowSize)}
              />
            </div>
          )}
        </div>
      )}
      <fieldset disabled={locked}>
        <legend className="text-sm font-semibold">
          {replay ? "Điều chỉnh cấu hình" : "Cấu hình khai phá"}
          {(dirty || (!replay && configurationDirty)) && (
            <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              {replay ? "Chưa áp dụng" : "Chưa lưu"}
            </span>
          )}
        </legend>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Kích thước pane
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min="1"
              max="100000"
              step="1"
              required
              value={config.paneSize}
              onChange={(e) => field("paneSize", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Số giao dịch mỗi nhóm dữ liệu.
            </span>
          </label>
          <label className="text-sm font-medium">
            Số pane trong window
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min="1"
              max="100000"
              step="1"
              required
              value={config.windowPaneCount}
              onChange={(e) => field("windowPaneCount", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Số nhóm trong một cửa sổ.
            </span>
          </label>
          <label className="text-sm font-medium">
            Ngưỡng minWus
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min="0"
              max="1"
              step="any"
              required
              value={config.minWus}
              onChange={(e) => field("minWus", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              0.005 = 0,5% · 0.5 = 50%.
            </span>
          </label>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Một cửa sổ ={" "}
          <strong className="tnum">{formatNumber(windowSize)}</strong> giao
          dịch. Mỗi pane mới hoàn tất sẽ tự khai phá cửa sổ tiếp theo.
        </p>
        <h3 className="mt-6 text-sm font-semibold">Tốc độ và giới hạn nạp</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tốc độ giao dịch/giây
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min="0"
              max="100000"
              step="1"
              required
              value={options.transactionsPerSecond}
              onChange={(e) => numeric("transactionsPerSecond", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Nhập 0 để chạy ở tốc độ tối đa.
            </span>
          </label>
          <label className="text-sm font-medium">
            Số giao dịch muốn đọc
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min="0"
              step="1"
              required
              value={options.maxTransactions}
              onChange={(e) => numeric("maxTransactions", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Nhập 0 để đọc toàn bộ file.
            </span>
          </label>
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-500">
        {dataset === "RETAIL" ? "Retail" : "Accidents"} sử dụng utility gốc từ file metadata. Chọn bộ dữ liệu tại tab Giao dịch.
      </p>
      {!valid && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Pane và số pane phải là số nguyên dương; cửa sổ tối đa 100.000 giao
          dịch; MinWUS từ 0 đến 1.
        </p>
      )}
      {!optionsValid && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Tốc độ phải là số nguyên từ 0 đến 100.000; giới hạn giao dịch không
          âm.
        </p>
      )}
      {replay && !locked && (!replay.restartPending || dirty) && (
        <div
          className={`mt-4 rounded-xl border p-3 ${
            dirty
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <label className="text-sm font-medium">
            Sau khi áp dụng
            <select
              aria-label="Sau khi áp dụng"
              className={`${inputClass} mt-1`}
              value={applyMode}
              disabled={weightsChanged || !canContinue}
              onChange={(e) => setMode(e.target.value as ApplyMode)}
            >
              <option value="CONTINUE">Tiếp tục từ checkpoint hiện tại</option>
              <option value="RESTART">Restart từ đầu trong stream mới</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-600">
            {applyMode === "RESTART"
              ? "Tạo stream mới từ giao dịch 1, giữ lịch sử stream cũ. Sau khi áp dụng, bấm Restart để chạy."
              : "Giữ vị trí đã đọc và lịch sử phiên cũ. Sau khi áp dụng, bấm Tiếp tục để chạy."}
          </p>
          {weightsChanged && (
            <p className="mt-2 text-xs text-amber-900">
              Thay đổi nguồn dữ liệu hoặc quy tắc trọng số cần Restart trong stream mới.
            </p>
          )}
        </div>
      )}
      <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:sticky sm:bottom-3">
        {!replay && (
          <>
            <Button
              type="submit"
              variant="secondary"
              disabled={
                busy ||
                !valid ||
                !optionsValid ||
                !source?.available ||
                (overview?.transactionCount ?? 0) > 0
              }
            >
              <Play size={16} />
              Bắt đầu {dataset === "RETAIL" ? "Retail" : "Accidents"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !valid}
              onClick={() => {
                void saveConfiguration()
                  .then(() => setSaved(true))
                  .catch(() => undefined)
              }}
            >
              Lưu cấu hình
            </Button>
          </>
        )}
        {replay && !locked && (!replay.restartPending || dirty) && (
          <Button
            type="submit"
            disabled={
              busy ||
              !valid ||
              !optionsValid ||
              !source?.available ||
              (applyMode === "CONTINUE" && !dirty)
            }
          >
            <Check size={16} />
            Áp dụng
          </Button>
        )}
        {!locked && (editableDirty || (!replay && configurationDirty)) && (
          <Button type="button" variant="secondary" onClick={restore}>
            <RotateCcw size={16} />
            Hoàn tác thay đổi
          </Button>
        )}
        {saved && !configurationDirty && (
          <span role="status" className="text-sm text-emerald-700">
            Đã lưu cấu hình.
          </span>
        )}
      </div>
      {!replay && (overview?.transactionCount ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <p>
            Stream đã có dữ liệu. Lưu cấu hình để khai phá dữ liệu hiện tại,
            hoặc tạo stream mới để chạy dữ liệu.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void newStream().catch(() => undefined)}
          >
            Tạo stream mới
          </Button>
        </div>
      )}
    </form>
  )

  if (configurationOnly) {
    return (
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Thiết lập khai phá</h2>
            <p className="mt-1 text-sm text-slate-500">
              Điều chỉnh cửa sổ, minWUS và tốc độ nạp cho cả hai thuật toán.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${stateColor}`}>
            {replay ? labels[replay.state] : "Chưa chạy"}
          </span>
        </div>
        {replay && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                Đã nạp <strong>{formatNumber(replay.processedTransactions)}</strong>
                {snapshot?.maxTransactions
                  ? ` / ${formatNumber(snapshot.maxTransactions)}`
                  : " giao dịch"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {replay.state === "RUNNING" && (
                  <Button type="button" onClick={() => control("pause")} disabled={busy}>
                    <Pause size={16} />
                    Tạm dừng
                  </Button>
                )}
                {canContinue && (
                  <Button
                    type="button"
                    onClick={() => control("resume")}
                    disabled={busy || dirty || (applyMode === "RESTART" && !replay.restartPending)}
                  >
                    <Play size={16} />
                    {replay.restartPending ? "Restart" : "Tiếp tục"}
                  </Button>
                )}
                {replayActive && (
                  <Button type="button" variant="danger" onClick={() => control("stop")} disabled={busy || replay.state === "STOPPING"}>
                    <Square size={14} />
                    Dừng
                  </Button>
                )}
              </div>
            </div>
            {snapshot && snapshot.maxTransactions > 0 && (
              <progress
                className="mt-3 h-1.5 w-full accent-blue-600"
                aria-label="Tiến độ nạp dữ liệu"
                max={snapshot.maxTransactions}
                value={Math.min(replay.processedTransactions, snapshot.maxTransactions)}
              />
            )}
          </div>
        )}
        {snapshot && (
          <details className="mt-4 rounded-xl border border-slate-200 p-3 text-sm" data-testid="run-configuration">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              Cấu hình đang chạy · phiên bản {replay?.configurationVersion}
            </summary>
            <p className="mt-1 font-medium">
              FWUDS-CT + FWUDS-DWT · {formatNumber(snapshot.paneSize * snapshot.windowPaneCount)} giao dịch/cửa sổ · MinWUS {snapshot.minWus}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {snapshot.weightMode === "PROVIDED_UTILITY" ? "Utility gốc" : "Trọng số mô phỏng (phiên cũ)"}
            </p>
          </details>
        )}
        {editor}
        {replay?.error && (
          <p
            role="alert"
            className={`mt-3 text-sm ${replay.state === "FAILED" ? "text-red-700" : "text-slate-600"}`}
          >
            {replay.error}
          </p>
        )}
      </Card>
    )
  }

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Luồng Retail / Accidents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Chọn nguồn dữ liệu để chạy cả hai thuật toán.
          </p>
        </div>
        <span
          role="status"
          className={`rounded-full px-3 py-1 text-xs font-medium ${stateColor}`}
        >
          {replay ? labels[replay.state] : "Chưa chạy"}
        </span>
      </div>
      <label className="mt-4 block text-sm font-medium">
        Bộ dữ liệu để nạp
        <select aria-label="Bộ dữ liệu để nạp" className={`${inputClass} mt-1`} value={dataset} disabled={locked || (replayActive && replay?.state !== "PAUSED")} onChange={e=>setDataset(e.target.value as "RETAIL" | "ACCIDENTS")}>
          <option value="RETAIL">Retail · dữ liệu thưa</option>
          <option value="ACCIDENTS">Accidents · dữ liệu dày đặc</option>
        </select>
      </label>
      {source?.available ? (
        <p className="mt-2 text-xs text-slate-500">
          {formatNumber(source.itemCount)} item ·{" "}
          {formatNumber(source.transactionFileBytes / 1024 / 1024, 2)} MiB
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          {source?.error ?? "Đang kiểm tra nguồn dữ liệu…"}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">Cấu hình chung: {config.windowPaneCount} × {config.paneSize} giao dịch · minWUS {config.minWus}. Cả hai thuật toán nhận cùng nguồn.</p>
      {snapshot && (
        <details
          className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"
          data-testid="run-configuration"
        >
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Cấu hình đã áp dụng · phiên bản {replay.configurationVersion}
          </summary>
          <p className="mt-1 font-medium">
            FWUDS-CT + FWUDS-DWT ·{" "}
            {formatNumber(snapshot.paneSize * snapshot.windowPaneCount)} giao
            dịch/cửa sổ · MinWUS {snapshot.minWus}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {snapshot.transactionsPerSecond
              ? `${formatNumber(snapshot.transactionsPerSecond)} giao dịch/giây`
              : "Tốc độ tối đa"}{" "}
            ·{" "}
            {snapshot.maxTransactions
              ? `Giới hạn ${formatNumber(snapshot.maxTransactions)} giao dịch`
              : "Đọc toàn bộ file"}{" "}
            ·{" "}
            {snapshot.weightMode === "PROVIDED_UTILITY"
              ? "Utility gốc"
              : "Trọng số mô phỏng (phiên cũ)"}
          </p>
        </details>
      )}
      {replay && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">Đã nạp</p>
            <p className="mt-1 font-semibold tnum">
              {formatNumber(replay.processedTransactions)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Thời gian</p>
            <p className="mt-1 font-semibold tnum">
              {formatNumber(replay.elapsedMs / 1000, 1)} giây
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Trong cửa sổ/buffer</p>
            <p className="mt-1 font-semibold tnum">
              {formatNumber(overview?.metrics.retainedTransactions ?? 0)}
            </p>
          </div>
        </div>
      )}
      {replay && snapshot && snapshot.maxTransactions > 0 && (
        <progress
          className="mt-3 h-1.5 w-full accent-blue-600"
          aria-label="Tiến độ nạp dữ liệu"
          max={snapshot.maxTransactions}
          value={Math.min(
            replay.processedTransactions,
            snapshot.maxTransactions,
          )}
        />
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!replay && <Button type="button" disabled={busy || !source?.available || !valid || !optionsValid || (overview?.transactionCount ?? 0) > 0} onClick={()=>void startReplay(options).catch(()=>undefined)}><Play size={16}/>Nạp {dataset === "RETAIL" ? "Retail" : "Accidents"}</Button>}
        {replay?.state === "RUNNING" && (
          <Button
            type="button"
            onClick={() => control("pause")}
            disabled={busy}
          >
            <Pause size={16} />
            Tạm dừng
          </Button>
        )}
        {canContinue && (
          <Button
            type="button"
            onClick={() => control("resume")}
            disabled={
              busy ||
              dirty ||
              (applyMode === "RESTART" && !replay?.restartPending)
            }
          >
            <Play size={16} />
            {replay?.restartPending ? "Restart" : "Tiếp tục"}
          </Button>
        )}
        {replayActive && (
          <Button
            type="button"
            variant="danger"
            onClick={() => control("stop")}
            disabled={busy || replay?.state === "STOPPING"}
          >
            <Square size={14} />
            Dừng
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPage("configuration")}
        >
          <Settings2 size={16} />
          Chỉnh cấu hình
        </Button>
      </div>
      {((!replay && (overview?.transactionCount ?? 0) > 0) || (replay && ["COMPLETED","FAILED"].includes(replay.state))) && <div className="mt-3 border-t border-slate-100 pt-3"><p className="mb-2 text-xs leading-relaxed text-slate-600">Tạo luồng mới để nạp lại dữ liệu. Luồng hiện tại được giữ nguyên.</p><Button variant="secondary" disabled={busy} onClick={() => void newStream().catch(() => undefined)}>Tạo luồng mới</Button></div>}
      {((locked && replay) || dirty || replay?.restartPending) && (
        <p
          className={`mt-3 text-xs ${
            dirty ? "text-amber-800" : "text-slate-500"
          }`}
        >
          {dirty
            ? "Có thay đổi chưa áp dụng. Áp dụng hoặc hoàn tác trước khi tiếp tục."
            : replay?.restartPending
              ? "Stream mới đã sẵn sàng. Bấm Restart để bắt đầu từ giao dịch 1."
              : replay?.state === "PAUSING" || replay?.state === "STOPPING"
                ? "Đang hoàn tất batch hiện tại. Vui lòng chờ trước khi chỉnh sửa."
                : "Tạm dừng luồng để chỉnh sửa cấu hình."}
        </p>
      )}
      {replay?.error && (
        <p
          role="alert"
          className={`mt-3 text-sm ${
            replay.state === "FAILED" ? "text-red-700" : "text-slate-600"
          }`}
        >
          {replay.error}
        </p>
      )}
    </Card>
  )
}
