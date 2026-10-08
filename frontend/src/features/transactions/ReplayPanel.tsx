import {
  Check,
  ChevronDown,
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

const labels = {
  RUNNING: "Đang chạy",
  PAUSING: "Đang chờ hết batch",
  PAUSED: "Đã tạm dừng",
  STOPPING: "Đang dừng",
  STOPPED: "Đã dừng",
  COMPLETED: "Hoàn tất",
  FAILED: "Có lỗi",
  RECOVERED: "Chờ tiếp tục sau khôi phục",
}

export default function ReplayPanel() {
  const {
    source,
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
  } = useApp()
  const [mode, setMode] = useState<ApplyMode>("CONTINUE")
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const formId = useId()
  const busy = status === "loading"
  const locked =
    busy ||
    (!!replay && ["RUNNING", "PAUSING", "STOPPING"].includes(replay.state))
  const snapshot = replay?.request
  const draft = toReplayConfiguration(algorithm, config, options)
  const editableDirty =
    !!snapshot &&
    Object.entries({ algorithm: draft.algorithm, ...config, ...options }).some(
      ([key, value]) => snapshot[(key as keyof typeof snapshot)] !== value,
    )
  const weightsChanged = !!snapshot && snapshot.weightMode !== draft.weightMode
  const dirty = editableDirty || weightsChanged
  const configurationDirty =
    !!overview &&
    (overview.configuration.algorithm !== draft.algorithm ||
      Object.entries(config).some(
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
  const buffered = overview?.metrics.bufferedTransactions ?? 0
  const latest = overview?.latestRun
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
  const stateColor =
    replay?.state === "FAILED"
      ? "bg-red-50 text-red-700"
      : replay?.state === "RUNNING" || replay?.state === "COMPLETED"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-600"
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
        <div className="mb-5 rounded-xl bg-slate-50 p-3 text-sm">
          <h3 className="font-semibold">Khai phá tự động</h3>
          <p className="mt-2 text-slate-600">
            Thuật toán đang áp dụng:{" "}
            <strong>{toUiAlgorithm(active.algorithm)}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {active.config.windowPaneCount} pane ×{" "}
            {formatNumber(active.config.paneSize)} giao dịch · MinWUS{" "}
            {active.config.minWus}
          </p>
          {latest ? (
            <p className="mt-2 text-xs text-slate-600">
              Cửa sổ mới nhất #{latest.windowId} ·{" "}
              {formatNumber(latest.patternCount)} mẫu ·{" "}
              {formatNumber(latest.executionTimeMs, 2)} ms khai phá.
            </p>
          ) : (
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
          <p className="mt-3 text-xs text-slate-600">
            Pane đang nhận: {formatNumber(buffered)} /{" "}
            {formatNumber(active.config.paneSize)} giao dịch.
          </p>
          <progress
            aria-label="Tiến độ pane đang nhận"
            className="mt-2 h-1.5 w-full accent-blue-600"
            max={active.config.paneSize}
            value={buffered}
          />
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-slate-500">Điền nhanh:</span>
          <Button
            type="button"
            variant="secondary"
            disabled={locked}
            onClick={() => {
              setSaved(false)
              setConfig({ paneSize: 2, windowPaneCount: 2, minWus: 0.5 })
            }}
          >
            Cấu hình DSe
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={locked}
            onClick={() => {
              setSaved(false)
              setConfig({ paneSize: 1000, windowPaneCount: 4, minWus: 0.005 })
              setAlgorithm("FWUDS-DWT")
            }}
          >
            Cấu hình Chainstore
          </Button>
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Thuật toán</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["FWUDS-CT", "FWUDS-DWT"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  algorithm === value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200"
                }`}
              >
                <input
                  className="mt-1 accent-blue-600"
                  type="radio"
                  name={`algorithm-${formId}`}
                  aria-label={value}
                  checked={algorithm === value}
                  onChange={() => {
                    setSaved(false)
                    setAlgorithm(value)
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold">{value}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {value === "FWUDS-CT"
                      ? "Khai phá bằng cấu trúc CTset"
                      : "Khai phá bằng cây DSWUN"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
        <h3 className="mt-6 text-sm font-semibold">Nguồn Chainstore</h3>
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
        Chainstore sử dụng utility gốc từ dữ liệu.
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
              Phiên cũ dùng trọng số mô phỏng. Cần Restart trong stream mới để
              sử dụng utility gốc.
            </p>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {!replay && (
          <>
            <Button
              type="submit"
              disabled={
                busy ||
                !valid ||
                !optionsValid ||
                !source?.available ||
                (overview?.transactionCount ?? 0) > 0
              }
            >
              <Play size={16} />
              Bắt đầu Chainstore
            </Button>
            <Button
              type="button"
              variant="secondary"
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
            hoặc tạo stream mới để chạy Chainstore.
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

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Luồng Chainstore</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nhập dữ liệu liên tục. Mở cấu hình để thiết lập thuật toán và cửa
            sổ.
          </p>
        </div>
        <span
          role="status"
          className={`rounded-full px-3 py-1 text-xs font-medium ${stateColor}`}
        >
          {replay ? labels[replay.state] : "Chưa chạy"}
        </span>
      </div>
      {source?.available ? (
        <p className="mt-2 text-xs text-slate-500">
          {formatNumber(source.itemCount)} sản phẩm ·{" "}
          {formatNumber(source.transactionFileBytes / 1024 / 1024, 2)} MiB
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          {source?.error ?? "Đang kiểm tra nguồn dữ liệu…"}
        </p>
      )}
      {snapshot && (
        <div
          className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"
          data-testid="run-configuration"
        >
          <p className="text-xs text-slate-500">
            Cấu hình đã áp dụng · phiên bản {replay.configurationVersion}
          </p>
          <p className="mt-1 font-medium">
            {toUiAlgorithm(snapshot.algorithm)} ·{" "}
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
        </div>
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
          aria-label="Tiến độ nạp Chainstore"
          max={snapshot.maxTransactions}
          value={Math.min(
            replay.processedTransactions,
            snapshot.maxTransactions,
          )}
        />
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
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
          aria-expanded={expanded}
          aria-controls={`${formId}-editor`}
          onClick={() => setExpanded(!expanded)}
        >
          <Settings2 size={16} />
          Cấu hình luồng
          <ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
        </Button>
      </div>
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
      <div id={`${formId}-editor`} hidden={!expanded}>
        {editor}
      </div>
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
