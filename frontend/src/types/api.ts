export type Page = "overview" | "transactions" | "mining" | "results" | "comparison"
export type UiAlgorithm = "FWUDS-CT" | "FWUDS-DWT"
export type ApiAlgorithm = "FWUDS_CT" | "FWUDS_DWT" | "ORACLE"
export type RequestStatus = "idle" | "loading" | "success" | "error"

export interface TransactionItem { itemId: string; name: string; quantity: number; weight: number }
export interface Transaction { id: string; items: TransactionItem[]; twu: number }
export interface TransactionInput { id: string; items: TransactionItem[] }
export interface MiningConfig { paneSize: number; windowPaneCount: number; minWus: number }
export interface PatternResult { items: string[]; wus: number; support: number; transactionIds: string[] }
export interface MiningRun {
  runId: string; streamId: string; algorithm: ApiAlgorithm; config: MiningConfig; windowId: number
  windowTransactionCount: number; patterns: PatternResult[]; executionTimeMs: number
}
export interface ComparisonResult {
  config: MiningConfig; oracle: MiningRun; fwudsCt: MiningRun; fwudsDwt: MiningRun
  equivalent: boolean; differences: string[]
}
export interface Overview { streamId: string; transactionCount: number; completedPaneCount: number | null; latestRun: MiningRun | null }
export interface ApiErrorBody { code: string; message: string; fieldErrors: { field: string; message: string }[] }
