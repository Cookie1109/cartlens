import { request } from "./apiClient"
import type { ApiAlgorithm, ComparisonResult, MiningConfig, MiningRun, Overview, Transaction, TransactionInput, UiAlgorithm } from "../types/api"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const isArray = (value: unknown): value is unknown[] => Array.isArray(value)
const hasString = (key: string) => (value: unknown): value is Record<string, unknown> => isRecord(value) && typeof value[key] === "string"
const isMiningRun = (value: unknown): value is MiningRun => isRecord(value) && typeof value.runId === "string" && Array.isArray(value.patterns)
const isOverview = (value: unknown): value is Overview => isRecord(value) && typeof value.streamId === "string" && typeof value.transactionCount === "number"
const isComparison = (value: unknown): value is ComparisonResult => isRecord(value) && typeof value.equivalent === "boolean" && isMiningRun(value.oracle) && isMiningRun(value.fwudsCt) && isMiningRun(value.fwudsDwt)

export const toApiAlgorithm = (algorithm: UiAlgorithm): ApiAlgorithm => algorithm === "FWUDS-CT" ? "FWUDS_CT" : "FWUDS_DWT"
export const toUiAlgorithm = (algorithm: ApiAlgorithm): UiAlgorithm | "Oracle" => algorithm === "FWUDS_CT" ? "FWUDS-CT" : algorithm === "FWUDS_DWT" ? "FWUDS-DWT" : "Oracle"

export const cartLensApi = {
  createStream: () => request<{ streamId: string }>("/streams", { method: "POST" }, hasString("streamId")),
  overview: (streamId: string) => request<Overview>(`/streams/${streamId}/overview`, undefined, isOverview),
  transactions: (streamId: string) => request<Transaction[]>(`/streams/${streamId}/transactions`, undefined, isArray),
  addTransaction: (streamId: string, input: TransactionInput) => request<Transaction>(`/streams/${streamId}/transactions`, { method: "POST", body: JSON.stringify(input) }, value => isRecord(value) && typeof value.id === "string" && Array.isArray(value.items)),
  reset: (streamId: string) => request<void>(`/streams/${streamId}/transactions`, { method: "DELETE" }),
  run: (streamId: string, algorithm: UiAlgorithm, config: MiningConfig) => request<MiningRun>(`/streams/${streamId}/runs`, { method: "POST", body: JSON.stringify({ algorithm: toApiAlgorithm(algorithm), ...config }) }, isMiningRun),
  latest: (streamId: string, algorithm?: UiAlgorithm) => request<MiningRun>(`/streams/${streamId}/results/latest${algorithm ? `?algorithm=${toApiAlgorithm(algorithm)}` : ""}`, undefined, isMiningRun),
  compare: (streamId: string, config: MiningConfig) => request<ComparisonResult>(`/streams/${streamId}/comparisons`, { method: "POST", body: JSON.stringify(config) }, isComparison),
}
