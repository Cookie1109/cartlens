import { useEffect, useRef, useState } from "react"
import { useApp } from "../../app/AppProvider"
import { Modal, formatNumber } from "../../components/ui"
import type { ComparisonPoint } from "../../types/api"

type Values = [number | null, number | null]
const display = (value: number | null) => value === null ? "—" : formatNumber(value, value < 0.01 ? 5 : 3)

function Chart({ title, unit, points, values, logarithmic, selected, onSelect }: { title: string; unit: string; points: ComparisonPoint[]; values: (point: ComparisonPoint) => Values; logarithmic: boolean; selected: number | null; onSelect: (window: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 700, height: 140 })
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const observer = new ResizeObserver(entries => {
      const {width,height} = entries[0].contentRect
      if (width > 0 && height > 0) setSize({width,height})
    })
    observer.observe(svg); return () => observer.disconnect()
  }, [])
  const data = points.map(point => ({point, values:values(point)}))
  const scale = (value: number) => logarithmic ? Math.log2(1 + value) : value
  const measured = data.flatMap(row => row.values).filter((value): value is number => value !== null)
  const max = Math.max(0.00001, ...measured.map(scale)) * 1.12
  const left = 55, right = size.width - 12, top = 12, bottom = Math.max(top+6,size.height-22)
  const x = (index: number) => data.length === 1 ? (left+right)/2 : left + index / Math.max(1,data.length-1) * (right-left)
  const y = (value: number) => bottom - scale(value)/max * (bottom-top)
  const found = data.findIndex(row => row.point.windowId === selected)
  const index = found >= 0 ? found : data.length-1
  const active = data[index]
  const ticks = size.height < 110 ? [0,1] : [0,1/3,2/3,1]
  const path = (lane: number) => {
    let connected = false
    return data.map((row,i) => {
      const value = row.values[lane]
      if (value === null) { connected=false; return "" }
      const command = `${connected ? "L" : "M"}${x(i)},${y(value)}`
      connected=true; return command
    }).join(" ")
  }
  return <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white px-3 py-2" data-testid={`chart-${title}`}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 text-xs"><h2 className="font-semibold text-slate-700">{title} <span className="font-normal text-slate-500">({unit})</span></h2><span className="text-[11px] text-slate-600">{active ? `#${active.point.windowId} · CT ${display(active.values[0])} / DWT ${display(active.values[1])}` : "Chờ cửa sổ đầu tiên"}</span></div>
    <svg ref={svgRef} className="min-h-0 w-full flex-1 rounded focus-visible:outline-2 focus-visible:outline-blue-500" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" tabIndex={data.length ? 0 : undefined} role="img" aria-label={`${title}: FWUDS-CT và FWUDS-DWT`} onKeyDown={event => {
      if (!data.length) return
      const next = event.key === "ArrowLeft" ? Math.max(0,index-1) : event.key === "ArrowRight" ? Math.min(data.length-1,index+1) : event.key === "Home" ? 0 : event.key === "End" ? data.length-1 : null
      if (next !== null) { event.preventDefault(); onSelect(data[next].point.windowId) }
    }}>
      <title>Chọn cửa sổ bằng chuột, chạm hoặc phím mũi tên trái/phải.</title>
      {ticks.map(tick => { const scaled = max*tick; const value = logarithmic ? 2 ** scaled - 1 : scaled; const height = bottom - tick*(bottom-top); return <g key={tick}><line x1={left} x2={right} y1={height} y2={height} stroke="#e2e8f0"/><text x={left-8} y={height+3} textAnchor="end" fill="#64748b" fontSize="10">{formatNumber(value,value<0.01?5:value<1?3:1)}</text></g> })}
      {[0,1].map(lane => <g key={lane}><path d={path(lane)} fill="none" stroke={lane===0?"#2563eb":"#0d9488"} strokeWidth="2" vectorEffect="non-scaling-stroke"/>{data.map((row,i) => row.values[lane]===null?null:<circle key={row.point.windowId} cx={x(i)} cy={y(row.values[lane]!)} r={data.length>40?1.5:3} fill={lane===0?"#2563eb":"#0d9488"}/>)}</g>)}
      {active && selected!==null && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#94a3b8" strokeDasharray="4 3"/>}
      {data.map((row,i) => { const width=(right-left)/Math.max(1,data.length-1); return <rect key={row.point.windowId} x={Math.max(left,x(i)-width/2)} y={top-5} width={Math.max(10,width)} height={bottom-top+10} fill="transparent" onMouseEnter={() => onSelect(row.point.windowId)} onClick={() => onSelect(row.point.windowId)}><title>{`Cửa sổ #${row.point.windowId}: CT ${display(row.values[0])} ${unit}, DWT ${display(row.values[1])} ${unit}`}</title></rect> })}
      {[...new Set(size.width<450?[0,data.length-1]:[0,Math.floor((data.length-1)/2),data.length-1])].filter(i=>i>=0&&data[i]).map(i=><text key={i} x={x(i)} y={size.height-5} textAnchor="middle" fill="#64748b" fontSize="10">W{data[i].point.windowId}</text>)}
      {!measured.length && <text x={(left+right)/2} y={(top+bottom)/2+4} textAnchor="middle" fill="#64748b" fontSize="11">{data.length?"Không có số đo cho lựa chọn này":"Chưa có dữ liệu"}</text>}
    </svg>
  </section>
}

export default function ComparisonPage() {
  const {liveSnapshot,overview,error} = useApp()
  const [logarithmic,setLogarithmic] = useState(false)
  const [memory,setMemory] = useState<"retained"|"allocated">("retained")
  const [selected,setSelected] = useState<number|null>(null)
  const [showMethod,setShowMethod] = useState(false)
  const points = liveSnapshot?.sessionId===overview?.configuration.sessionId ? liveSnapshot?.points??[] : []
  const last = points.at(-1)
  const failure = points.find(point=>!point.equivalent)
  const cfg = overview?.configuration.config
  const active = points.find(point=>point.windowId===selected)??last
  useEffect(()=>setSelected(null),[liveSnapshot?.sessionId])
  useEffect(()=>{ if(selected !== null && !points.some(point => point.windowId === selected)) setSelected(null) },[points,selected])
  return <div className="flex h-full min-h-0 flex-col gap-2" data-testid="comparison-page">
    <div className="flex shrink-0 items-start justify-between gap-2"><div><h1 className="text-xl font-bold">So sánh</h1><p className="mt-0.5 text-xs text-slate-600">minWUS {cfg?.minWus} · {formatNumber((cfg?.paneSize??0)*(cfg?.windowPaneCount??0))} giao dịch/cửa sổ · cùng nguồn dữ liệu</p></div><button className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 hover:bg-slate-100" onClick={()=>setShowMethod(true)}>Phương pháp đo</button></div>
    {(error||overview?.miningError)&&<p role="alert" className="shrink-0 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error||overview?.miningError}</p>}
    <div className={`flex shrink-0 flex-wrap items-center justify-between gap-1 rounded-lg px-3 py-2 text-xs ${failure?"bg-red-50 text-red-700":last?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600"}`}><span>{failure?`Sai khác tại W${failure.windowId}: ${failure.differences[0]}`:last?`✓ CT = DWT · ${points.length} cửa sổ đang hiển thị`:"Đủ cửa sổ đầu tiên sẽ tự xuất hiện biểu đồ."}</span>{active&&<span>{formatNumber(active.processedTransactions)} giao dịch tại W{active.windowId}</span>}</div>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]">
      <label className="flex items-center gap-1.5 text-slate-600">Cửa sổ<select aria-label="Cửa sổ đang xem" className="min-w-0 rounded border border-slate-200 bg-white px-1 py-1" disabled={!points.length} value={selected!==null&&points.some(p=>p.windowId===selected)?String(selected):"latest"} onChange={event=>setSelected(event.target.value==="latest"?null:Number(event.target.value))}><option value="latest">Mới nhất</option>{points.map(p=><option key={p.windowId} value={p.windowId}>#{p.windowId}</option>)}</select></label>
      <label className="flex min-w-0 items-center gap-1.5 text-slate-600">Bộ nhớ<select aria-label="Phép đo bộ nhớ" className="min-w-0 max-w-52 rounded border border-slate-200 bg-white px-1 py-1" value={memory} onChange={event=>setMemory(event.target.value as typeof memory)}><option value="retained">Giữ lại (ước tính)</option><option value="allocated">Cấp phát trong cửa sổ</option></select></label>
      <label className="flex items-center gap-1.5 whitespace-nowrap text-slate-600"><input type="checkbox" className="size-3.5 accent-blue-600" checked={logarithmic} onChange={event=>setLogarithmic(event.target.checked)}/>Trục log₂</label>
    </div>
    <div className="flex shrink-0 items-center gap-4 px-1 text-[11px]"><span className="flex items-center gap-1.5 text-blue-700"><span className="h-0.5 w-4 bg-blue-600"/>FWUDS-CT</span><span className="flex items-center gap-1.5 text-teal-700"><span className="h-0.5 w-4 bg-teal-600"/>FWUDS-DWT</span>{selected!==null&&<button className="ml-auto text-slate-600 underline underline-offset-2" onClick={()=>setSelected(null)}>Theo dõi mới nhất</button>}</div>
    <Chart title="Thời gian thực thi" unit="ms" points={points} values={p=>[p.ctUpdateMs+p.ctMiningMs,p.dwtUpdateMs+p.dwtMiningMs]} logarithmic={logarithmic} selected={selected} onSelect={setSelected}/>
    <Chart title={memory==="retained"?"Bộ nhớ sử dụng (ước tính)":"Bộ nhớ cấp phát"} unit="MiB" points={points} values={p=>memory==="retained"?[p.ctMemoryBytes/1048576,p.dwtMemoryBytes/1048576]:[p.ctAllocatedBytes===null?null:p.ctAllocatedBytes/1048576,p.dwtAllocatedBytes===null?null:p.dwtAllocatedBytes/1048576]} logarithmic={logarithmic} selected={selected} onSelect={setSelected}/>
    <Chart title="Thời gian cập nhật cửa sổ" unit="ms" points={points} values={p=>[p.ctUpdateMs,p.dwtUpdateMs]} logarithmic={logarithmic} selected={selected} onSelect={setSelected}/>
    <p className="shrink-0 text-[10px] text-slate-600">{points.length}/120 cửa sổ gần nhất · chạm biểu đồ hoặc dùng phím mũi tên để xem số đo.</p>
    <Modal open={showMethod} title="Phương pháp đo" onClose={()=>setShowMethod(false)}><div className="space-y-3 text-sm leading-relaxed text-slate-600"><p><strong className="text-slate-900">Thời gian:</strong> cập nhật cửa sổ + khai phá, không gồm đọc file, lưu trữ hay vẽ giao diện. Cửa sổ đầu gồm thời gian xây dựng cấu trúc.</p><p><strong className="text-slate-900">Bộ nhớ giữ lại:</strong> ước tính cấu trúc và kết quả của từng thuật toán. Đây không phải bộ nhớ đỉnh trong quá trình chạy.</p><p><strong className="text-slate-900">Bộ nhớ cấp phát:</strong> lượng bộ nhớ được cấp phát riêng cho mỗi thuật toán trong cửa sổ; có thể lớn hơn bộ nhớ được giữ lại.</p><p>Ứng dụng chạy song song bằng Java. Bài báo (§6.2–6.4) đo đơn luồng bằng C# trên phần cứng khác, nên các số đo không tương đương benchmark của bài báo.</p><p>Trục log₂ dùng log₂(1 + y), giúp quan sát cả số đo bằng 0. Chọn Mới nhất để theo dõi cửa sổ mới khi dữ liệu đến.</p></div></Modal>
  </div>
}
