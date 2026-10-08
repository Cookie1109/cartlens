import { Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useApp } from "../../app/AppProvider"
import { Button, Card, inputClass } from "../../components/ui"
import type { TransactionItem } from "../../types/api"

type DraftItem = TransactionItem & { key: string }
type TransactionDraft = {
  id: string
  items: DraftItem[]
}
const emptyItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  itemId: "",
  name: "",
  quantity: 1,
  weight: 0.5,
})
function readDraft(key: string): TransactionDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null")
    if (
      value &&
      typeof value.id === "string" &&
      Array.isArray(value.items) &&
      value.items.length &&
      value.items.every(
        (item: DraftItem) =>
          typeof item.key === "string" &&
          typeof item.itemId === "string" &&
          typeof item.name === "string" &&
          Number.isFinite(item.quantity) &&
          Number.isFinite(item.weight),
      )
    )
      return value
  } catch {
    /* A browser may disable session storage. */
  }
  return { id: "", items: [emptyItem()] }
}

export default function TransactionForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { streamId, addTransaction, status, replayActive } = useApp()
  const storageKey = `cartlens.transactionDraft.${streamId}`
  const [draft, setDraft] = useState(() => readDraft(storageKey))
  const [formError, setFormError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const focusNewItem = useRef(false)
  const locked = status === "loading" || replayActive
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {
      /* Keep the in-memory draft usable. */
    }
  }, [storageKey, draft])
  useEffect(() => {
    if (focusNewItem.current) {
      const inputs =
        formRef.current?.querySelectorAll<HTMLInputElement>("[data-item-id]")
      inputs?.item(inputs.length - 1)?.focus()
      focusNewItem.current = false
    }
  }, [draft.items.length])
  const setItem = (
    key: string,
    field: keyof TransactionItem,
    value: string,
  ) => {
    setFormError(null)
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]:
                field === "itemId" || field === "name" ? value : Number(value),
            }
          : item,
      ),
    }))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked) return
    const id = draft.id.trim()
    const items = draft.items.map(({ itemId, name, quantity, weight }) => ({
      itemId: itemId.trim(),
      name: name.trim(),
      quantity,
      weight,
    }))
    if (!id || items.some((item) => !item.itemId || !item.name)) {
      setFormError("Mã giao dịch, mã và tên sản phẩm không được để trống.")
      return
    }
    if (new Set(items.map((item) => item.itemId)).size !== items.length) {
      setFormError("Mã sản phẩm bị trùng. Gộp số lượng vào cùng một dòng.")
      return
    }
    try {
      await addTransaction({ id, items })
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* Storage may be disabled. */
      }
      onSaved(id)
    } catch {
      /* The provider displays the API error; preserve the draft. */
    }
  }
  return (
    <Card className="mb-5">
      <form ref={formRef} onSubmit={(event) => void submit(event)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Thêm giao dịch</h2>
            <p className="mt-1 text-xs text-slate-500">
              Bản nháp được giữ khi chuyển tab trong phiên trình duyệt này.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Thu gọn
          </Button>
        </div>
        {replayActive && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Dừng luồng Chainstore trước khi thêm giao dịch thủ công.
          </p>
        )}
        <fieldset disabled={locked}>
          <label className="mt-4 block max-w-sm text-sm font-medium">
            Mã giao dịch
            <input
              autoFocus
              className={`${inputClass} mt-1`}
              value={draft.id}
              onChange={(e) => {
                setFormError(null)
                setDraft({ ...draft, id: e.target.value })
              }}
              placeholder="Ví dụ: 7"
              inputMode="numeric"
              pattern="[0-9]+"
              required
            />
          </label>
          <div className="mt-4 space-y-3">
            {draft.items.map((item, index) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                key={item.key}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Sản phẩm {index + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Xóa sản phẩm ${index + 1}`}
                    className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
                    disabled={draft.items.length === 1}
                    onClick={() => {
                      setFormError(null)
                      setDraft((current) => ({
                        ...current,
                        items: current.items.filter(
                          (row) => row.key !== item.key,
                        ),
                      }))
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1.4fr_100px_100px]">
                  <label className="text-xs font-medium text-slate-600">
                    Mã sản phẩm
                    <input
                      data-item-id
                      className={`${inputClass} mt-1`}
                      value={item.itemId}
                      onChange={(e) =>
                        setItem(item.key, "itemId", e.target.value)
                      }
                      placeholder="Ví dụ: A"
                      required
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Tên sản phẩm
                    <input
                      className={`${inputClass} mt-1`}
                      value={item.name}
                      onChange={(e) =>
                        setItem(item.key, "name", e.target.value)
                      }
                      placeholder="Tên sản phẩm"
                      required
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Số lượng
                    <input
                      className={`${inputClass} mt-1`}
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        setItem(item.key, "quantity", e.target.value)
                      }
                      required
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Trọng số
                    <input
                      className={`${inputClass} mt-1`}
                      type="number"
                      min="0"
                      step="any"
                      value={item.weight}
                      onChange={(e) =>
                        setItem(item.key, "weight", e.target.value)
                      }
                      required
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="mt-3"
            type="button"
            variant="secondary"
            onClick={() => {
              focusNewItem.current = true
              setDraft((current) => ({
                ...current,
                items: [...current.items, emptyItem()],
              }))
            }}
          >
            <Plus size={16} />
            Thêm sản phẩm
          </Button>
        </fieldset>
        {formError && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {formError}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            {draft.items.length} sản phẩm
          </span>
          <Button type="submit" disabled={locked}>
            <Save size={16} />
            {status === "loading" ? "Đang lưu…" : "Lưu giao dịch"}
          </Button>
        </div>
      </form>
    </Card>
  )
}
