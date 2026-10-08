export type Page = "overview" | "transactions" | "results"
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
  windowTransactionCount: number; patterns: PatternResult[]; executionTimeMs: number; patternCount: number
}
export interface Metrics { processedTransactions: number; retainedTransactions: number; bufferedTransactions: number; processingTimeMs: number; archiveTimeMs: number; peakHeapBytes: number }
export interface Overview {
  streamId: string; transactionCount: number; completedPaneCount: number | null; latestRun: MiningRun | null
  configuration: { sessionId: string; algorithm: ApiAlgorithm; config: MiningConfig }; metrics: Metrics; miningError: string | null
}
export type WeightMode = "PROVIDED_UTILITY" | "SYNTHETIC_BATCH"
export interface ReplayOptions { transactionsPerSecond: number; maxTransactions: number }
export interface RunConfiguration extends MiningConfig, ReplayOptions { algorithm: ApiAlgorithm; weightMode: WeightMode; weightBatchSize: number; seed: number }
export type ApplyMode = "CONTINUE" | "RESTART"
export interface AppliedReplay { streamId: string; replay: ReplayStatus; restarted: boolean }
export interface ReplayStatus { request: RunConfiguration; runId: string; configurationVersion: number; restartPending: boolean; state: "RUNNING" | "PAUSING" | "PAUSED" | "STOPPING" | "STOPPED" | "COMPLETED" | "FAILED" | "RECOVERED"; processedTransactions: number; sourceLine: number; elapsedMs: number; error: string | null }
export interface DatasetSource { available: boolean; transactionFileBytes: number; itemCount: number; error: string | null }
export interface ApiErrorBody { code: string; message: string; fieldErrors: { field: string; message: string }[] }
