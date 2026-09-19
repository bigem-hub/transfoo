import { useEffect, useState } from 'react'

/**
 * Dark, minimal PC <-> Android transfer visualization.
 * Pure SVG + CSS animation; no canvas, no WebGL.
 */
export default function HeroVisual() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => (p >= 100 ? 0 : p + 1))
    }, 60)
    return () => clearInterval(id)
  }, [])

  const uploaded = (72 * pct) / 100 // 72 MB demo payload

  return (
    <div className="relative">
      <div className="relative flex items-stretch justify-center gap-6 sm:gap-14 px-2">
        {/* PC */}
        <div className="flex flex-col items-center gap-3 pt-2 w-[130px] sm:w-[160px]">
          <div className="w-full rounded-xl border border-border bg-surface p-5 flex flex-col items-center gap-2.5">
            <svg width="34" height="26" viewBox="0 0 34 26" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="32" height="21" rx="2.5" stroke="#cfd0d4" strokeWidth="1.5" />
              <path d="M12 25h10M17 22v3" stroke="#cfd0d4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-mono text-muted truncate max-w-full">WINDOWS PC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent tf-pulse-dot" />
            <span className="text-[10px] font-mono text-faint">192.168.1.104</span>
          </div>
        </div>

        {/* Connector */}
        <div className="flex flex-col items-center justify-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-faint">
            <span className="text-accent">LAN</span>
            <span>·</span>
            <span>4000</span>
          </div>
          <svg width="64" height="24" viewBox="0 0 64 24" fill="none" aria-hidden="true">
            <path d="M2 12h56" stroke="#2e2e32" strokeWidth="1.5" strokeLinecap="round" />
            <path className="tf-flow" d="M2 12h56" stroke="#e3a35e" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M42 5l12 7-12 7" stroke="#9b9ba1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-40 sm:w-44">
            <div className="flex justify-between text-[10px] font-mono text-faint mb-1">
              <span>{uploaded.toFixed(1)} / 72 MB</span>
              <span className="text-accent">{pct}%</span>
            </div>
            <div className="h-[5px] rounded-full bg-surface-2 overflow-hidden border border-border">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Android */}
        <div className="flex flex-col items-center gap-3 pt-2 w-[130px] sm:w-[160px]">
          <div className="w-full rounded-xl border border-border bg-surface p-5 flex flex-col items-center gap-2.5">
            <svg width="20" height="34" viewBox="0 0 20 34" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="18" height="32" rx="3.5" stroke="#e3a35e" strokeWidth="1.5" />
              <line x1="7" y1="29.5" x2="13" y2="29.5" stroke="#e3a35e" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-mono text-muted truncate max-w-full">ANDROID</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-faint tf-pulse-dot" />
            <span className="text-[10px] font-mono text-faint">paired · idle</span>
          </div>
        </div>
      </div>
    </div>
  )
}