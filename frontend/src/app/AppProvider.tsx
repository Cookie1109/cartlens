import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ApiError } from "../services/apiClient"
import { cartLensApi } from "../services/cartLensApi"
import type { ComparisonResult, MiningConfig, MiningRun, Overview, Page, RequestStatus, Transaction, TransactionInput, UiAlgorithm } from "../types/api"

const DEFAULT_CONFIG: MiningConfig = { paneSize: 2, windowPaneCount: 2, minWus: 0.5 }
const DEMO: TransactionInput[] = [
  { id: "t1", items: [["A",1,.2],["C",2,.2],["D",2,.4],["E",1,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "t2", items: [["B",2,.4],["C",1,.2],["D",2,.4],["E",2,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "t3", items: [["A",2,.2],["C",1,.2],["E",1,.5]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "t4", items: [["A",1,.5],["C",3,.4],["D",2,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "t5", items: [["B",1,.3],["C",1,.4],["D",1,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
  { id: "t6", items: [["A",2,.5],["C",2,.4],["D",3,.6],["E",1,.6]].map(([itemId,quantity,weight]) => ({ itemId: String(itemId), name: String(itemId), quantity: Number(quantity), weight: Number(weight) })) },
]

const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: "Dữ liệu chưa hợp lệ.",
  STREAM_NOT_FOUND: "Phiên dữ liệu không còn tồn tại. Hãy tải lại ứng dụng.",
  DUPLICATE_TRANSACTION_ID: "Mã giao dịch đã tồn tại.",
  WINDOW_NOT_READY: "Cửa sổ chưa đủ số pane để khai phá.",
  RESULT_NOT_FOUND: "Chưa có kết quả cho thuật toán này.",
  COMPARISON_MISMATCH: "Kết quả giữa các miner chưa tương đương.",
  MINING_FAILED: "Backend không thể hoàn thành lần khai phá.",
  INVALID_RESPONSE: "Backend trả về dữ liệu không đúng contract.",
}

function errorMessage(value: unknown) {
  if (!(value instanceof ApiError)) return "Không thể kết nối tới CartLens backend."
  const base = errorMessages[value.code] ?? value.message
  const details = value.fieldErrors.map(field => `${field.field}: ${field.message}`).join("; ")
  return details ? `${base} ${details}` : base
}

interface AppState {
  page: Page; setPage: (page: Page) => void; streamId: string | null; transactions: Transaction[]
  overview: Overview | null
  config: MiningConfig; setConfig: (config: MiningConfig) => void; algorithm: UiAlgorithm; setAlgorithm: (algorithm: UiAlgorithm) => void
  run: MiningRun | null; comparison: ComparisonResult | null; status: RequestStatus; error: string | null
  addTransaction: (input: TransactionInput) => Promise<void>; reset: () => Promise<void>; runMining: () => Promise<void>
  compare: () => Promise<void>; loadDemo: () => Promise<void>; refresh: () => Promise<void>
}

const Context = createContext<AppState | null>(null)

export default function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>("overview")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [algorithm, setAlgorithm] = useState<UiAlgorithm>("FWUDS-DWT")
  const [run, setRun] = useState<MiningRun | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [status, setStatus] = useState<RequestStatus>("loading")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!streamId) return
    const [nextTransactions, nextOverview] = await Promise.all([cartLensApi.transactions(streamId), cartLensApi.overview(streamId)])
    setTransactions(nextTransactions)
    setOverview(nextOverview)
  }, [streamId])

  useEffect(() => { void (async () => {
    try {
      setStatus("loading")
      const created = await cartLensApi.createStream(); setStreamId(created.streamId); setOverview(await cartLensApi.overview(created.streamId)); setStatus("idle")
    } catch (value) { setError(errorMessage(value)); setStatus("error") }
  })() }, [])

  const act = async (action: () => Promise<void>) => { try { setStatus("loading"); setError(null); await action(); setStatus("success") } catch (value) { setError(errorMessage(value)); setStatus("error"); throw value } }
  const addTransaction = (input: TransactionInput) => act(async () => { if (!streamId) return; await cartLensApi.addTransaction(streamId, input); await refresh() })
  const reset = () => act(async () => { if (!streamId) return; await cartLensApi.reset(streamId); setTransactions([]); setOverview(await cartLensApi.overview(streamId)); setRun(null); setComparison(null) })
  const runMining = () => act(async () => { if (!streamId) return; const result = await cartLensApi.run(streamId, algorithm, config); setRun(result); setOverview(await cartLensApi.overview(streamId)); setPage("results") })
  const compare = () => act(async () => { if (!streamId) return; setComparison(await cartLensApi.compare(streamId, config)) })
  const loadDemo = () => act(async () => { if (!streamId) return; await cartLensApi.reset(streamId); for (const tx of DEMO) await cartLensApi.addTransaction(streamId, tx); await refresh(); setRun(null); setComparison(null) })

  const value = useMemo(() => ({ page,setPage,streamId,transactions,overview,config,setConfig,algorithm,setAlgorithm,run,comparison,status,error,addTransaction,reset,runMining,compare,loadDemo,refresh }), [page,streamId,transactions,overview,config,algorithm,run,comparison,status,error,refresh])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useApp() { const value = useContext(Context); if (!value) throw new Error("AppProvider is missing"); return value }
