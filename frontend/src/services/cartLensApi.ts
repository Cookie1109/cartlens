import { request } from "./apiClient"
import type { AppliedReplay, ApplyMode, ComparisonResult, DatasetSource, MiningConfig, MiningRun, Overview, ReplayOptions, ReplayStatus, StreamSummary, Transaction, TransactionInput, UiAlgorithm } from "../types/api"
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
const isTransaction = (value: unknown): value is Transaction => isRecord(value) && typeof value.id === "string" && number(value.twu) && Array.isArray(value.items) && value.items.every(item => isRecord(item) && typeof item.itemId === "string" && typeof item.name === "string" && number(item.quantity) && number(item.weight))
const isMiningRun = (value: unknown): value is MiningRun => isRecord(value) && typeof value.runId === "string" && typeof value.streamId === "string" && number(value.windowId) && number(value.patternCount) && number(value.executionTimeMs) && isRecord(value.config) && number(value.config.paneSize) && number(value.config.windowPaneCount) && number(value.config.minWus) && Array.isArray(value.patterns) && value.patterns.every(p => isRecord(p) && Array.isArray(p.items) && p.items.every(i => typeof i === "string") && number(p.wus) && number(p.support) && Array.isArray(p.transactionIds) && p.transactionIds.every(i => typeof i === "string"))
const isOverview = (value: unknown): value is Overview => isRecord(value) && typeof value.streamId === "string" && number(value.transactionCount) && isRecord(value.metrics) && isRecord(value.configuration) && (value.latestRun === null || isMiningRun(value.latestRun))
const isComparison = (value: unknown): value is ComparisonResult => isRecord(value) && typeof value.equivalent === "boolean" && typeof value.oracleVerified === "boolean" && (value.oracle === null || isMiningRun(value.oracle)) && isMiningRun(value.fwudsCt) && isMiningRun(value.fwudsDwt)
const isStream = (value: unknown): value is StreamSummary => isRecord(value) && typeof value.streamId === "string" && number(value.transactionCount)
const arrayOf = <T,>(guard: (value: unknown) => value is T) => (value: unknown): value is T[] => Array.isArray(value) && value.every(guard)
export const toApiAlgorithm = (algorithm: UiAlgorithm) => algorithm === "FWUDS-CT" ? "FWUDS_CT" : "FWUDS_DWT"
export const toUiAlgorithm = (algorithm: string): UiAlgorithm => algorithm === "FWUDS_CT" ? "FWUDS-CT" : "FWUDS-DWT"
const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/$/, "")
export const cartLensApi = {
  createStream: () => request<{ streamId: string }>("/streams", { method: "POST" }, (value): value is { streamId: string } => isRecord(value) && typeof value.streamId === "string"),
  streams: () => request<StreamSummary[]>("/streams", undefined, arrayOf(isStream)),
  overview: (id: string) => request<Overview>(`/streams/${id}/overview`, undefined, isOverview),
  transactions: (id: string, after = 0) => request<Transaction[]>(`/streams/${id}/transactions?after=${after}&limit=100`, undefined, arrayOf(isTransaction)),
  addTransaction: (id: string, input: TransactionInput) => request<Transaction>(`/streams/${id}/transactions`, { method: "POST", body: JSON.stringify(input) }, isTransaction),
  reset: (id: string) => request<void>(`/streams/${id}/transactions`, { method: "DELETE" }),
  configure: (id: string, algorithm: UiAlgorithm, config: MiningConfig) => request<Overview>(`/streams/${id}/configuration`, { method: "POST", body: JSON.stringify({ algorithm: toApiAlgorithm(algorithm), ...config }) }, isOverview),
  results: (id: string, after = 0) => request<MiningRun[]>(`/streams/${id}/results?after=${after}&limit=20`, undefined, arrayOf(isMiningRun)),
  window: (id: string, session: string, window: number, after = 0) => request<MiningRun>(`/streams/${id}/results/window?sessionId=${encodeURIComponent(session)}&windowId=${window}&patternAfter=${after}&limit=100`, undefined, isMiningRun),
  compare: (id: string, config: MiningConfig) => request<ComparisonResult>(`/streams/${id}/comparisons`, { method: "POST", body: JSON.stringify(config) }, isComparison),
  source: () => request<DatasetSource>("/datasets/chainstore", undefined, (v): v is DatasetSource => isRecord(v) && typeof v.available === "boolean" && number(v.itemCount) && number(v.transactionFileBytes)),
  replay: (id: string) => request<ReplayStatus | null>(`/streams/${id}/replay`).then(v => v ?? null),
  startReplay: (id: string, algorithm: UiAlgorithm, config: MiningConfig, options: ReplayOptions) => request<ReplayStatus>(`/streams/${id}/replay`, { method: "POST", body: JSON.stringify({ algorithm: toApiAlgorithm(algorithm), ...config, ...options }) }),
  applyReplay: (id: string, algorithm: UiAlgorithm, config: MiningConfig, options: ReplayOptions, mode: ApplyMode) => request<AppliedReplay>(`/streams/${id}/replay/configuration`, { method: "POST", body: JSON.stringify({ configuration: { algorithm: toApiAlgorithm(algorithm), ...config, ...options }, mode }) }),
  controlReplay: (id: string, action: "pause" | "resume" | "stop") => request<ReplayStatus>(`/streams/${id}/replay/${action}`, { method: "POST" }),
  exportUrl: (id: string, sessionId: string) => `${base}/streams/${id}/results/export.csv?sessionId=${encodeURIComponent(sessionId)}`,
}
