import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { ApiError } from "../services/apiClient"
import { cartLensApi, toUiAlgorithm } from "../services/cartLensApi"
import type { ApplyMode, Dataset, DatasetSource, LiveSnapshot, MiningConfig, MiningRun, Overview, Page, ReplayOptions, ReplayStatus, RequestStatus, Transaction, TransactionInput, UiAlgorithm } from "../types/api"
import dseData from "../../../backend/src/test/resources/paper/dse.json"

const DEFAULT_OPTIONS: ReplayOptions = { transactionsPerSecond: 1000, maxTransactions: 0 }
const DEFAULT_CONFIG: MiningConfig = {
  paneSize: Number(dseData.paneSize) || 2,
  windowPaneCount: Number(dseData.windowPaneCount) || 2,
  minWus: 0.5,
}

const DEMO: TransactionInput[] = (dseData.transactions || []).map((tx: any) => ({
  id: String(tx.id),
  items: (tx.items || []).map((item: any) => ({
    itemId: String(item.itemId),
    name: String(item.itemId),
    quantity: Number(item.quantity),
    weight: Number(item.weight),
  })),
}))

function errorMessage(value: unknown) {
  if (!(value instanceof ApiError)) return "Không thể kết nối tới CartLens backend."
  return [value.message, ...value.fieldErrors.map(f => `${f.field}: ${f.message}`)].join("; ")
}

interface AppState {
  page: Page; setPage: (page: Page) => void; streamId: string | null
  transactions: Transaction[]; transactionAfter: number; loadTransactionPage: (after: number) => Promise<void>
  overview: Overview | null; config: MiningConfig; setConfig: (c: MiningConfig) => void
  algorithm: UiAlgorithm; setAlgorithm: (a: UiAlgorithm) => void; run: MiningRun | null
  status: RequestStatus; error: string | null
  source: DatasetSource | null; replay: ReplayStatus | null; replayActive: boolean
  dataset: Dataset; setDataset: (value: Dataset) => void; liveSnapshot: LiveSnapshot | null
  history: MiningRun[]; historyAfter: number; loadHistory: (after: number) => Promise<void>; selectRun: (run: MiningRun | null) => void
  addTransaction: (input: TransactionInput) => Promise<void>; reset: () => Promise<void>
  saveConfiguration: () => Promise<void>; loadDemo: (algo?: UiAlgorithm) => Promise<void>; refresh: () => Promise<void>
  newStream: () => Promise<void>
  replayOptions: ReplayOptions; setReplayOptions: (options: ReplayOptions) => void; applyReplayConfiguration: (mode: ApplyMode) => Promise<void>
  startReplay: (options: ReplayOptions) => Promise<void>; controlReplay: (action: "pause" | "resume" | "stop") => Promise<void>
}

const Context = createContext<AppState | null>(null)

export default function AppProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>("RETAIL")
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null)
  const [page, setPage] = useState<Page>("overview")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionAfter, setTransactionAfter] = useState(0)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [algorithm, setAlgorithm] = useState<UiAlgorithm>("FWUDS-DWT")
  const [run, setRun] = useState<MiningRun | null>(null)
  const [history, setHistory] = useState<MiningRun[]>([])
  const [historyAfter, setHistoryAfter] = useState(0)
  const [status, setStatus] = useState<RequestStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [source, setSource] = useState<DatasetSource | null>(null)
  const [replayOptions, setReplayOptions] = useState(DEFAULT_OPTIONS)
  const [replay, setReplay] = useState<ReplayStatus | null>(null)
  const live = useRef(true)
  const currentId = useRef<string | null>(null)
  const initial = useRef<Promise<Overview> | null>(null)
  const replayActive = !!replay && ["RUNNING","PAUSING","PAUSED","STOPPING"].includes(replay.state)

  const applyOverview = useCallback((value: Overview) => {
    setOverview(value); if (live.current) setRun(value.latestRun)
  }, [])

  const refresh = useCallback(async () => {
    if (!streamId) return
    const [next, tx, job, snapshot] = await Promise.all([cartLensApi.overview(streamId), cartLensApi.transactions(streamId, transactionAfter), cartLensApi.replay(streamId), cartLensApi.live(streamId)])
    if (currentId.current !== streamId) return
    applyOverview(next); setTransactions(tx); setReplay(job); setLiveSnapshot(snapshot); setConnectionError(null)
  }, [streamId, transactionAfter, applyOverview])

  const act = async (action: () => Promise<void>) => {
    try { setStatus("loading"); setError(null); await action(); setStatus("success") }
    catch (value) { setError(errorMessage(value)); setStatus("error"); throw value }
  }

  const selectStream = (id: string) => act(async () => {
    const [next, tx, job, snapshot] = await Promise.all([cartLensApi.overview(id), cartLensApi.transactions(id), cartLensApi.replay(id), cartLensApi.live(id)])
    currentId.current = id; live.current = true; localStorage.setItem("cartlens.streamId", id)
    setStreamId(id); setTransactionAfter(0); setHistoryAfter(0); setHistory([])
    applyOverview(next); setTransactions(tx); setReplay(job); setLiveSnapshot(snapshot); setConnectionError(null)
    setConfig(next.configuration?.config ?? DEFAULT_CONFIG); setAlgorithm(toUiAlgorithm(next.configuration?.algorithm ?? "FWUDS_DWT"))
  })

  useEffect(() => {
    let disposed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const initialize = () => {
      if (disposed || currentId.current) return
      if (!initial.current) initial.current = (async () => {
        const saved = localStorage.getItem("cartlens.streamId")
        if (saved) {
          try { return await cartLensApi.overview(saved) }
          catch (value) { if (!(value instanceof ApiError) || value.code !== "STREAM_NOT_FOUND") throw value }
        }
        const created = await cartLensApi.createStream()
        localStorage.setItem("cartlens.streamId", created.streamId)
        return cartLensApi.overview(created.streamId)
      })()
      void initial.current.then(async next => {
        const [tx, job, source, snapshot] = await Promise.all([cartLensApi.transactions(next.streamId), cartLensApi.replay(next.streamId), cartLensApi.source(), cartLensApi.live(next.streamId)])
        if (disposed || (currentId.current && currentId.current !== next.streamId)) return
        currentId.current = next.streamId; setStreamId(next.streamId); applyOverview(next); setTransactions(tx); setReplay(job); setSource(source); setLiveSnapshot(snapshot)
        setConfig(next.configuration?.config ?? DEFAULT_CONFIG); setAlgorithm(toUiAlgorithm(next.configuration?.algorithm ?? "FWUDS_DWT")); setConnectionError(null); setStatus("idle")
      }).catch(value => {
        if (!disposed && !currentId.current) {
          initial.current = null; setConnectionError(errorMessage(value)); setStatus("error")
          retry = setTimeout(initialize, 2000)
        }
      })
    }
    initialize()
    return () => { disposed = true; clearTimeout(retry) }
  }, [applyOverview])

  useEffect(() => {
    if (!streamId) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const [next, job, snapshot] = await Promise.all([cartLensApi.overview(streamId), cartLensApi.replay(streamId), cartLensApi.live(streamId)])
        if (!disposed && currentId.current === streamId) { applyOverview(next); setReplay(job); setLiveSnapshot(snapshot); setConnectionError(null) }
      } catch (value) { if (!disposed) setConnectionError(errorMessage(value)) }
      if (!disposed) timer = setTimeout(poll, 500)
    }
    timer = setTimeout(poll, 500)
    return () => { disposed = true; clearTimeout(timer) }
  }, [streamId, applyOverview])

  useEffect(() => {
    if (page !== "transactions" || !streamId || !overview) return
    const expected = Math.min(100, Math.max(0, overview.transactionCount - transactionAfter))
    if (transactions.length === expected) return
    let disposed = false
    void cartLensApi.transactions(streamId, transactionAfter)
      .then(rows => { if (!disposed && currentId.current === streamId) setTransactions(rows) })
      .catch(value => { if (!disposed) setError(errorMessage(value)) })
    return () => { disposed = true }
  }, [page,streamId,overview?.transactionCount,transactionAfter,transactions.length])

  // Sync persisted snapshots when selecting a run or applying a revision; polling preserves edits.
  useEffect(() => {
    if (!replay?.request) { setReplayOptions(DEFAULT_OPTIONS); return }
    const r = replay.request
    setDataset(r.dataset ?? "RETAIL")
    setConfig({ paneSize: r.paneSize, windowPaneCount: r.windowPaneCount, minWus: r.minWus })
    setAlgorithm(toUiAlgorithm(r.algorithm))
    setReplayOptions({ transactionsPerSecond: r.transactionsPerSecond, maxTransactions: r.maxTransactions })
  }, [streamId,replay?.runId,replay?.configurationVersion,!!replay?.request])

  const applyReplayConfiguration = (mode: ApplyMode) => act(async () => {
    if (!streamId) return
    const applied = await cartLensApi.applyReplay(streamId, algorithm, config, replayOptions, mode, dataset)
    if (currentId.current !== streamId) return
    if (applied.streamId !== streamId) { await selectStream(applied.streamId); return }
    live.current = true; setReplay(applied.replay); setHistory([]); setHistoryAfter(0); await refresh()
  })

  const addTransaction = (input: TransactionInput) => act(async () => { if (!streamId) return; await cartLensApi.addTransaction(streamId, input); await refresh() })
  const reset = () => act(async () => { if (!streamId) return; await cartLensApi.reset(streamId); live.current = true; setHistory([]); setReplay(null); setLiveSnapshot(null); setTransactionAfter(0); applyOverview(await cartLensApi.overview(streamId)); setTransactions(await cartLensApi.transactions(streamId)) })
  const saveConfiguration = () => act(async () => { if (!streamId) return; live.current = true; applyOverview(await cartLensApi.configure(streamId, algorithm, config)); setLiveSnapshot(await cartLensApi.live(streamId)); setHistory([]); setHistoryAfter(0) })

  const loadDemo = (algo?: UiAlgorithm) => act(async () => {
    if (!streamId) return
    const targetAlgorithm = algo ?? algorithm
    setReplay(null)
    await cartLensApi.reset(streamId); await cartLensApi.configure(streamId, targetAlgorithm, DEFAULT_CONFIG)
    setLiveSnapshot(null)
    for (const tx of DEMO) await cartLensApi.addTransaction(streamId, tx)
    setConfig(DEFAULT_CONFIG); setAlgorithm(targetAlgorithm); live.current = true; setHistory([]); setTransactionAfter(0)
    applyOverview(await cartLensApi.overview(streamId)); setTransactions(await cartLensApi.transactions(streamId)); setLiveSnapshot(await cartLensApi.live(streamId)); setReplay(null)
  })

  const newStream = () => act(async () => { const created = await cartLensApi.createStream(); await selectStream(created.streamId) })
  const loadTransactionPage = (after: number) => act(async () => { if (!streamId) return; const tx = await cartLensApi.transactions(streamId, after); setTransactionAfter(after); setTransactions(tx) })
  const loadHistory = (after: number) => act(async () => { if (!streamId) return; setHistory(await cartLensApi.results(streamId, after)); setHistoryAfter(after) })
  const selectRun = (selected: MiningRun | null) => { live.current = selected === null; setRun(selected ?? overview?.latestRun ?? null) }
  const startReplay = (options: ReplayOptions) => act(async () => { if (!streamId) return; live.current = true; setReplay(await cartLensApi.startReplay(streamId, algorithm, config, options, dataset)); setHistory([]); setHistoryAfter(0); await refresh() })
  const controlReplay = (action: "pause" | "resume" | "stop") => act(async () => { if (streamId) setReplay(await cartLensApi.controlReplay(streamId, action)) })

  useEffect(() => {
    let disposed = false; let retry: ReturnType<typeof setTimeout> | undefined
    setSource(null); setSourceError(null)
    const fetchSource = async () => {
      try {
        const value = await cartLensApi.source(dataset)
        if (!disposed) { setSource(value); setSourceError(null) }
      } catch (value) {
        if (!disposed) { setSourceError(errorMessage(value)); retry = setTimeout(fetchSource, 2000) }
      }
    }
    void fetchSource()
    return () => { disposed = true; clearTimeout(retry) }
  }, [dataset])

  return <Context.Provider value={{ page,setPage,streamId,transactions,transactionAfter,loadTransactionPage,overview,config,setConfig,algorithm,setAlgorithm,run,history,historyAfter,loadHistory,selectRun,status: connectionError ? "error" : status,error: error ?? connectionError ?? sourceError,source,replay,replayActive,addTransaction,reset,saveConfiguration,loadDemo,refresh,newStream,startReplay,controlReplay,replayOptions,setReplayOptions,applyReplayConfiguration,dataset,setDataset,liveSnapshot }}>{children}</Context.Provider>
}

export function useApp() { const value = useContext(Context); if (!value) throw new Error("AppProvider is missing"); return value }
