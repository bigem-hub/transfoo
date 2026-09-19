function WinNavItem({ icon, label }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-faint">
      {icon}
      {label}
    </div>
  )
}

function AndroidNavItem({ icon, label, active }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-1 py-1 ${active ? 'text-accent' : 'text-faint'}`}>
      {icon}
      <span className="text-[9px] font-mono">{label}</span>
    </div>
  )
}

export default function ProductShowcase() {
  return (
    <section id="showcase" className="relative py-24 sm:py-32 tf-divider overflow-hidden">
      <div className="absolute -top-24 right-0 w-[480px] h-[320px] bg-accent/[0.04] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">The apps</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            One interface on both of your devices
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          {/* Windows app */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-surface-3 border border-border-strong" />
                <span className="font-mono text-[11px] text-muted">Windows app</span>
              </div>
              <span className="font-mono text-[10px] text-faint">Transfo Desktop</span>
            </div>
            <div className="flex">
              <div className="w-[168px] shrink-0 border-r border-border p-3 hidden sm:block">
                <div className="flex items-center gap-2 px-3 py-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#101012" stroke="#232326" />
                    <rect x="7" y="12.5" width="10" height="17" rx="2" stroke="#e3a35e" strokeWidth="2" />
                    <rect x="23" y="10.5" width="11.5" height="8.5" rx="1.4" stroke="#cfd0d4" strokeWidth="2" />
                  </svg>
                  <span className="text-[12px] font-semibold tracking-[0.12em] text-text">TRANSFO</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <WinNavItem label="Home" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" /></svg>} />
                  <WinNavItem label="Send" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-8-8 18-2.5-7.5L3 11z" /></svg>} />
                  <WinNavItem label="Receive" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>} />
                  <WinNavItem label="Devices" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2" /></svg>} />
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-text bg-surface-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h11v10H4zM15 10h4v4h-4" /></svg>
                    Transfers
                  </div>
                  <WinNavItem label="Settings" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1" /></svg>} />
                </div>
              </div>
              <div className="flex-1 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[13px] text-text font-medium">Transfers</div>
                  <span className="font-mono text-[10px] text-faint">1 active</span>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e3a35e" strokeWidth="1.6" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6" /></svg>
                      <span className="text-[12px] text-text truncate">Project_Render_4K.mov</span>
                    </div>
                    <span className="font-mono text-[10px] text-accent">72/405 MB</span>
                  </div>
                  <div className="h-[4px] rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full w-[18%] rounded-full bg-accent" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-faint">
                  <span className="w-1 h-1 rounded-full bg-accent tf-pulse-dot" />
                  LAN host on port 4000 · 2 paired devices nearby
                </div>
              </div>
            </div>
          </div>

          {/* Android app */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-surface-3 border border-border-strong" />
                <span className="font-mono text-[11px] text-muted">Android app</span>
              </div>
              <span className="font-mono text-[10px] text-faint">Transfo Mobile</span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] text-text font-medium">Home</div>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  PC on LAN
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 p-3 mb-3">
                <div className="text-[10px] font-mono text-faint uppercase tracking-wide mb-1.5">Your devices</div>
                <div className="flex items-center gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cfd0d4" strokeWidth="1.6" strokeLinejoin="round"><rect x="2" y="4" width="13" height="9" rx="2" /><path d="M17 14v6M11 14v6M10 20h9M3 20h5M8.5 17h7" /></svg>
                  <div className="flex-1">
                    <div className="text-[12px] text-text">ORVYN-DESKTOP</div>
                    <div className="font-mono text-[10px] text-faint">192.168.1.104 · paired</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-accent bg-accent-soft p-3 text-center">
                  <div className="text-[12px] font-semibold text-accent">Send files</div>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3 text-center">
                  <div className="text-[12px] font-medium text-muted">Receive files</div>
                </div>
              </div>
              <div className="mt-4 flex justify-center gap-6 border-t border-border pt-3.5">
                <AndroidNavItem active icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" /></svg>} label="Home" />
                <AndroidNavItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 7h11v10H4zM15 10h4v4h-4" /></svg>} label="Transfers" />
                <AndroidNavItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2" /></svg>} label="Devices" />
                <AndroidNavItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>} label="Settings" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 font-mono text-[11px] text-faint text-center">
          Screens follow the redesigned Transfo interface on both platforms.
        </p>
      </div>
    </section>
  )
}