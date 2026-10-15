import { Maximize, Minus, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatNumber, formatTransactionId } from "../../components/ui"
import { cartLensApi } from "../../services/cartLensApi"
import type { Structure, TreeNode } from "../../types/api"

type View = { x: number; y: number; scale: number }
type Position = { node: TreeNode; x: number; y: number; depth: number }

// Assign each leaf its own column, then center each parent above its children.
// Iterative traversal also supports trees deeper than the JavaScript call stack.
function layoutTree(nodes: TreeNode[]) {
  const children = new Map<number, TreeNode[]>()
  nodes.forEach(node => {
    if (node.parentId === null) return
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node); children.set(node.parentId, siblings)
  })
  const root = nodes.find(node => node.parentId === null)
  const ordered: { node: TreeNode; depth: number }[] = []
  const stack = root ? [{ node: root, depth: 0 }] : []
  while (stack.length) {
    const entry = stack.pop()!
    ordered.push(entry)
    const rows = children.get(entry.node.id) ?? []
    for (let i = rows.length - 1; i >= 0; i--) stack.push({ node: rows[i], depth: entry.depth + 1 })
  }
  const positions = new Map<number, Position>()
  let leaf = 0, maxDepth = 0
  // Left-to-right leaf positions are assigned before the bottom-up parent pass.
  const leafX = new Map<number, number>()
  ordered.forEach(({ node }) => { if (!children.has(node.id)) leafX.set(node.id, 60 + leaf++ * 112) })
  for (let i = ordered.length - 1; i >= 0; i--) {
    const { node, depth } = ordered[i]
    const rows = children.get(node.id) ?? []
    const x = rows.length ? (positions.get(rows[0].id)!.x + positions.get(rows[rows.length - 1].id)!.x) / 2 : leafX.get(node.id)!
    positions.set(node.id, { node, depth, x, y: 36 + depth * 80 })
    maxDepth = Math.max(maxDepth, depth)
  }
  return { nodes: ordered.map(({ node }) => positions.get(node.id)!), positions, width: Math.max(120, leaf * 112 + 8), height: maxDepth * 80 + 72 }
}

export default function DwtStructure({ structure: preview, streamId, sessionId, windowId }: {
  structure: Structure; streamId: string; sessionId: string; windowId: number
}) {
  const [full, setFull] = useState<Structure | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const needsFull = preview.nodes.length < preview.totalEntries
  useEffect(() => {
    if (!needsFull) return
    let disposed = false
    setError(false)
    void cartLensApi.dwtTree(streamId, sessionId, windowId).then(value => { if (!disposed) setFull(value) }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true }
  }, [streamId, sessionId, windowId, needsFull, retry])
  const structure = needsFull ? full : preview
  const layout = useMemo(() => layoutTree(structure?.nodes ?? []), [structure?.nodes])
  const [canvas, setCanvas] = useState({ width: 760, height: 240 })
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const [selected, setSelected] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; view: View } | null>(null)
  const moved = useRef(false)
  const fitScale = Math.min(Math.max(1, canvas.width - 24) / layout.width, Math.max(1, canvas.height - 24) / layout.height, 1)
  const fit = useCallback(() => setView({ x: (canvas.width - layout.width * fitScale) / 2, y: (canvas.height - layout.height * fitScale) / 2, scale: fitScale }), [canvas.width, canvas.height, layout.width, layout.height, fitScale])
  useEffect(() => { fit() }, [fit])
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setCanvas(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(svg); return () => observer.disconnect()
  }, [])
  const zoom = useCallback((factor: number, x = canvas.width / 2, y = canvas.height / 2) => {
    setView(previous => {
      const scale = Math.max(Math.min(fitScale / 2, 0.1), Math.min(4, previous.scale * factor))
      return { x: x - (x - previous.x) * scale / previous.scale, y: y - (y - previous.y) * scale / previous.scale, scale }
    })
  }, [canvas.width, canvas.height, fitScale])
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = svg.getBoundingClientRect()
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.005), event.clientX - bounds.left, event.clientY - bounds.top)
    }
    svg.addEventListener("wheel", wheel, { passive: false })
    return () => svg.removeEventListener("wheel", wheel)
  }, [zoom])
  const selectedNode = structure?.nodes.find(node => node.id === selected)
  const controlClass = "grid size-7 shrink-0 place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
  return <div className="flex min-h-0 flex-1 flex-col gap-1.5">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
      <span>{formatNumber(preview.totalEntries)} nút · TAILLIST: {formatNumber(preview.tailCount)} giao dịch</span>
      <div className="flex items-center gap-1" role="group" aria-label="Điều khiển cây">
        <button className={controlClass} aria-label="Thu nhỏ cây" title="Thu nhỏ" onClick={() => zoom(1 / 1.25)} disabled={!structure}><Minus size={14}/></button>
        <span className="w-10 text-center tabular-nums" data-testid="tree-zoom">{formatNumber(view.scale * 100, view.scale < 0.01 ? 2 : 0)}%</span>
        <button className={controlClass} aria-label="Phóng to cây" title="Phóng to" onClick={() => zoom(1.25)} disabled={!structure}><Plus size={14}/></button>
        <button className={`${controlClass} ml-1`} aria-label="Vừa khung cây" title="Hiện toàn bộ cây" onClick={fit} disabled={!structure}><Maximize size={14}/></button>
      </div>
    </div>
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/40">
      <svg ref={svgRef} className="h-full w-full touch-none cursor-grab select-none active:cursor-grabbing" role="img" aria-label="Cây DSWUN đang chạy" tabIndex={0} data-testid="dwt-structure" onDoubleClick={fit}
        onPointerDown={event => {
          if (event.button !== 0) return
          moved.current = false
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => {
          const start = drag.current; if (!start || start.id !== event.pointerId) return
          const dx = event.clientX - start.x, dy = event.clientY - start.y
          if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true
          setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy })
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return
          drag.current = null
          // Pointer capture retargets clicks to the SVG, so select by release position.
          if (!moved.current) {
            const bounds = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - bounds.left - view.x) / view.scale, y = (event.clientY - bounds.top - view.y) / view.scale
            const hit = layout.nodes.find(position => Math.abs(position.x - x) <= 42 && Math.abs(position.y - y) <= 22)
            if (hit) setSelected(hit.node.id)
          }
        }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
        onKeyDown={event => {
          if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.25) }
          else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.25) }
          else if (event.key === "0") { event.preventDefault(); fit() }
          else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault()
            setView(previous => ({ ...previous, x: previous.x + (event.key === "ArrowLeft" ? 40 : event.key === "ArrowRight" ? -40 : 0), y: previous.y + (event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0) }))
          }
        }}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`} data-testid="tree-transform">
          {layout.nodes.filter(({ node }) => node.parentId !== null).map(position => {
            const parent = layout.positions.get(position.node.parentId!)!
            return <path key={`edge-${position.node.id}`} d={`M${parent.x},${parent.y + 22} V${position.y - 40} H${position.x} V${position.y - 22}`} fill="none" stroke="#94b8c6" strokeWidth="1.5"/>
          })}
          {layout.nodes.map(({ node, x, y }) => <g key={node.id} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`Nút ${node.item}, pre ${node.pre}, post ${node.post}, ${node.count} giao dịch`} aria-pressed={selected === node.id} className="tree-node cursor-pointer"
            onClick={() => { if (!moved.current) setSelected(node.id) }}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(node.id) } }}>
            <title>{node.item}: TWU {formatNumber(node.weight, 2)}, pre={node.pre}, post={node.post}, {node.count} giao dịch, {node.childCount} nhánh</title>
            <rect x="-42" y="-22" width="84" height="44" rx="8" fill={node.id === selected ? "#0f766e" : "#f0fdfa"} stroke={node.id === selected ? "#0f766e" : "#5eead4"}/>
            <text y="-7" textAnchor="middle" fontSize="12" fontWeight="600" fill={node.id === selected ? "white" : "#115e59"}>{node.item.slice(0, 10)}</text>
            <text y="6" textAnchor="middle" fontSize="9" fill={node.id === selected ? "#ccfbf1" : "#475569"}>{node.pre},{node.post}{node.parentId === null ? "" : ` · n=${node.count}`}</text>
            {node.parentId !== null && <text y="17" textAnchor="middle" fontSize="8" fill={node.id === selected ? "#ccfbf1" : "#64748b"}>TWU {formatNumber(node.weight, 3)}</text>}
          </g>)}
        </g>
      </svg>
      {!structure && <div className="absolute inset-0 grid place-content-center bg-white/90 text-center text-xs text-slate-500">{error ? <><p>Không tải được cây đầy đủ.</p><button className="mt-2 rounded border border-slate-200 px-2 py-1" onClick={() => setRetry(value => value + 1)}>Thử lại</button></> : "Đang tải toàn bộ cây…"}</div>}
    </div>
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto text-[10px] text-slate-500"><b className="shrink-0 text-teal-700">TAIL →</b>{preview.tails.map(tail => <span key={tail.transactionId} className="shrink-0 rounded bg-teal-50 px-1.5 py-1" title={`TWU ${tail.twu}; tail node ${tail.nodeId}`}>{formatTransactionId(tail.transactionId)} → #{tail.nodeId}</span>)}</div>
    {selectedNode && selectedNode.parentId !== null && <p className="shrink-0 truncate text-[10px] text-teal-700" title={`${selectedNode.item}: TWU ${selectedNode.weight}; pre=${selectedNode.pre}, post=${selectedNode.post}`}>WUN-code({selectedNode.item}): ⟨{selectedNode.pre},{selectedNode.post},{formatNumber(selectedNode.weight, 4)}⟩</p>}
    <p className="shrink-0 text-[10px] text-slate-500">Kéo để di chuyển · lăn chuột để zoom · bấm ⛶ để vừa khung · {structure ? `đầy đủ ${formatNumber(structure.nodes.length)} nút` : "đang tải cây"}.</p>
  </div>
}
