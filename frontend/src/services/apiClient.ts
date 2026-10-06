import type { ApiErrorBody } from "../types/api"

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly fieldErrors: ApiErrorBody["fieldErrors"] = []) {
    super(message)
  }
}

export type ResponseGuard<T> = (value: unknown) => value is T

export async function request<T>(path: string, init?: RequestInit, guard?: ResponseGuard<T>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: "NETWORK_ERROR", message: "Không thể đọc phản hồi từ máy chủ.", fieldErrors: [] })) as ApiErrorBody
    throw new ApiError(body.code, body.message, body.fieldErrors)
  }
  if (response.status === 204) return undefined as T
  const body: unknown = await response.json()
  if (guard && !guard(body)) throw new ApiError("INVALID_RESPONSE", "Phản hồi từ máy chủ không đúng định dạng.")
  return body as T
}
