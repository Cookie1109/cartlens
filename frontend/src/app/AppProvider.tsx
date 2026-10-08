import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { ApiError } from "../services/apiClient"
import { cartLensApi, toUiAlgorithm } from "../services/cartLensApi"
import type { ApplyMode, ComparisonResult, DatasetSource, MiningConfig, MiningRun, Overview, Page, ReplayOptions, ReplayStatus, RequestStatus, StreamSummary, Transaction, TransactionInput, UiAlgorithm } from "../types/api"
const DEFAULT_OPTIONS: ReplayOptions = { transactionsPerSecond: 1000, maxTransactions: 0, weightMode: "PROVIDED_UTILITY", weightBatchSize: 10000, seed: 42 }
const DEFAULT_CONFIG: MiningConfig = { paneSize: 2, windowPaneCount: 2, minWus: 0.5 }
const DEMO: TransactionInput[] = [
  { id: "1", items: [["A",1,.2],["C",2,.2],["D",2,.4],["E",1,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "2", items: [["B",2,.4],["C",1,.2],["D",2,.4],["E",2,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "3", items: [["A",2,.2],["C",1,.2],["E",1,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "4", items: [["A",1,.5],["C",3,.4],["D",2,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "5", items: [["B",1,.3],["C",1,.4],["D",1,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "6", items: [["A",2,.5],["C",2,.4],["D",3,.6],["E",1,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
]
function errorMessage(value: unknown) {
  if (!(value instanceof ApiError)) return "Không thể kết nối tới CartLens backend."
  return [value.message, ...value.fieldErrors.map(f => `${f.field}: ${f.message}`)].join("; ")
}
interface AppState {
  page: Page; setPage: (page: Page) => void; streamId: string | null; streams: StreamSummary[]
  transactions: Transaction[]; transactionAfter: number; loadTransactionPage: (after: number) => Promise<void>
  overview: Overview | null; config: MiningConfig; setConfig: (c: MiningConfig) => void
  algorithm: UiAlgorithm; setAlgorithm: (a: UiAlgorithm) => void; run: MiningRun | null
  comparison: ComparisonResult | null; status: RequestStatus; error: string | null
  source: DatasetSource | null; replay: ReplayStatus | null; replayActive: boolean
  history: MiningRun[]; historyAfter: number; loadHistory: (after: number) => Promise<void>; selectRun: (run: MiningRun | null) => void
  addTransaction: (input: TransactionInput) => Promise<void>; reset: () => Promise<void>
  saveConfiguration: () => Promise<void>; compare: () => Promise<void>; loadDemo: () => Promise<void>; refresh: () => Promise<void>
  newStream: () => Promise<void>; selectStream: (id: string) => Promise<void>
  replayOptions: ReplayOptions; setReplayOptions: (options: ReplayOptions) => void; applyReplayConfiguration: (mode: ApplyMode) => Promise<void>
  startReplay: (options: ReplayOptions) => Promise<void>; controlReplay: (action: "pause" | "resume" | "stop") => Promise<void>
}
const Context = createContext<AppState | null>(null)
export default function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>("overview")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [streams, setStreams] = useState<StreamSummary[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionAfter, setTransactionAfter] = useState(0)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [algorithm, setAlgorithm] = useState<UiAlgorithm>("FWUDS-DWT")
  const [run, setRun] = useState<MiningRun | null>(null)
  const [history, setHistory] = useState<MiningRun[]>([])
  const [historyAfter, setHistoryAfter] = useState(0)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [status, setStatus] = useState<RequestStatus>("loading")
  const [error, setError] = useState<string | null>(null)
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
    const [next, tx, job] = await Promise.all([cartLensApi.overview(streamId), cartLensApi.transactions(streamId, transactionAfter), cartLensApi.replay(streamId)])
    if (currentId.current !== streamId) return
    applyOverview(next); setTransactions(tx); setReplay(job)
  }, [streamId, transactionAfter, applyOverview])
  const act = async (action: () => Promise<void>) => {
    try { setStatus("loading"); setError(null); await action(); setStatus("success") }
    catch (value) { setError(errorMessage(value)); setStatus("error"); throw value }
  }
  const selectStream = (id: string) => act(async () => {
    const [next, tx, job] = await Promise.all([cartLensApi.overview(id), cartLensApi.transactions(id), cartLensApi.replay(id)])
    currentId.current = id; live.current = true; localStorage.setItem("cartlens.streamId", id)
    setStreamId(id); setTransactionAfter(0); setHistoryAfter(0); setHistory([]); setComparison(null)
    applyOverview(next); setTransactions(tx); setReplay(job)
    setConfig(next.configuration?.config ?? DEFAULT_CONFIG); setAlgorithm(toUiAlgorithm(next.configuration?.algorithm ?? "FWUDS_DWT"))
    setStreams(await cartLensApi.streams())
  })
  useEffect(() => {
    let disposed = false
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
      const [tx, job, dataset, list] = await Promise.all([cartLensApi.transactions(next.streamId), cartLensApi.replay(next.streamId), cartLensApi.source(), cartLensApi.streams()])
      if (disposed) return
      currentId.current = next.streamId; setStreamId(next.streamId); applyOverview(next); setTransactions(tx); setReplay(job); setSource(dataset); setStreams(list)
      setConfig(next.configuration?.config ?? DEFAULT_CONFIG); setAlgorithm(toUiAlgorithm(next.configuration?.algorithm ?? "FWUDS_DWT")); setStatus("idle")
    }).catch(value => { if (!disposed) { setError(errorMessage(value)); setStatus("error") } })
    return () => { disposed = true }
  }, [applyOverview])
  useEffect(() => {
    if (!streamId) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const [next, job] = await Promise.all([cartLensApi.overview(streamId), cartLensApi.replay(streamId)])
        if (!disposed && currentId.current === streamId) { applyOverview(next); setReplay(job) }
      } catch (value) { if (!disposed) setError(errorMessage(value)) }
      if (!disposed) timer = setTimeout(poll, 1000)
    }
    timer = setTimeout(poll, 1000)
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
    setConfig({ paneSize: r.paneSize, windowPaneCount: r.windowPaneCount, minWus: r.minWus })
    setAlgorithm(toUiAlgorithm(r.algorithm))
    setReplayOptions({ transactionsPerSecond: r.transactionsPerSecond, maxTransactions: r.maxTransactions, weightMode: r.weightMode, weightBatchSize: r.weightBatchSize, seed: r.seed })
  }, [streamId,replay?.runId,replay?.configurationVersion,!!replay?.request])
  const applyReplayConfiguration = (mode: ApplyMode) => act(async () => {
    if (!streamId) return
    const applied = await cartLensApi.applyReplay(streamId, algorithm, config, replayOptions, mode)
    if (currentId.current !== streamId) return
    if (applied.streamId !== streamId) { await selectStream(applied.streamId); return }
    live.current = true; setReplay(applied.replay); setHistory([]); setHistoryAfter(0); setComparison(null); await refresh()
  })
  const addTransaction = (input: TransactionInput) => act(async () => { if (!streamId) return; await cartLensApi.addTransaction(streamId, input); await refresh() })
  const reset = () => act(async () => { if (!streamId) return; await cartLensApi.reset(streamId); live.current = true; setComparison(null); setHistory([]); setReplay(null); setTransactionAfter(0); applyOverview(await cartLensApi.overview(streamId)); setTransactions(await cartLensApi.transactions(streamId)) })
  const saveConfiguration = () => act(async () => { if (!streamId) return; live.current = true; applyOverview(await cartLensApi.configure(streamId, algorithm, config)); setHistory([]); setHistoryAfter(0) })
  const compare = () => act(async () => { if (streamId) setComparison(await cartLensApi.compare(streamId, config)) })
  const loadDemo = () => act(async () => {
    if (!streamId) return
    await cartLensApi.reset(streamId); await cartLensApi.configure(streamId, "FWUDS-DWT", DEFAULT_CONFIG)
    for (const tx of DEMO) await cartLensApi.addTransaction(streamId, tx)
    setConfig(DEFAULT_CONFIG); setAlgorithm("FWUDS-DWT"); live.current = true; setComparison(null); setHistory([]); setTransactionAfter(0)
    applyOverview(await cartLensApi.overview(streamId)); setTransactions(await cartLensApi.transactions(streamId)); setReplay(null)
  })
  const newStream = () => act(async () => { const created = await cartLensApi.createStream(); await selectStream(created.streamId) })
  const loadTransactionPage = (after: number) => act(async () => { if (!streamId) return; const tx = await cartLensApi.transactions(streamId, after); setTransactionAfter(after); setTransactions(tx) })
  const loadHistory = (after: number) => act(async () => { if (!streamId) return; setHistory(await cartLensApi.results(streamId, after)); setHistoryAfter(after) })
  const selectRun = (selected: MiningRun | null) => { live.current = selected === null; setRun(selected ?? overview?.latestRun ?? null) }
  const startReplay = (options: ReplayOptions) => act(async () => { if (!streamId) return; live.current = true; setReplay(await cartLensApi.startReplay(streamId, algorithm, config, options)); setHistory([]); setHistoryAfter(0); await refresh() })
  const controlReplay = (action: "pause" | "resume" | "stop") => act(async () => { if (streamId) setReplay(await cartLensApi.controlReplay(streamId, action)) })
  return <Context.Provider value={{ page,setPage,streamId,streams,transactions,transactionAfter,loadTransactionPage,overview,config,setConfig,algorithm,setAlgorithm,run,history,historyAfter,loadHistory,selectRun,comparison,status,error,source,replay,replayActive,addTransaction,reset,saveConfiguration,compare,loadDemo,refresh,newStream,selectStream,startReplay,controlReplay,replayOptions,setReplayOptions,applyReplayConfiguration }}>{children}</Context.Provider>
}
export function useApp() { const value = useContext(Context); if (!value) throw new Error("AppProvider is missing"); return value }
