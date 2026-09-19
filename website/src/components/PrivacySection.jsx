export default function PrivacySection() {
  return (
    <section id="architecture" className="relative py-24 sm:py-32 tf-divider">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">Architecture</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            A server you own, on a network you control
          </h2>
        </div>

        {/* flow diagram */}
        <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 mb-8 overflow-x-auto">
          <div className="flex items-center justify-center min-w-[560px] gap-3">
            {[
              { label: 'Android', sub: 'phone app' },
              { label: 'LAN', sub: 'chunked HTTP', accent: true },
              { label: 'Your PC', sub: 'Transfo server · 4000' },
            ].map((n, i) => (
              <div key={n.label} className="flex items-center gap-3">
                <div
                  className={`min-w-[150px] rounded-lg border px-5 py-4 text-center ${
                    n.accent ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2'
                  }`}
                >
                  <div className={`text-[13px] font-semibold ${n.accent ? 'text-accent' : 'text-text'}`}>{n.label}</div>
                  <div className="font-mono text-[10px] text-faint mt-0.5">{n.sub}</div>
                </div>
                {i < 2 && (
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden="true">
                    <path d="M1 6h16m0 0-4-4m4 4-4 4" stroke="#3c3c42" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-[15px] font-semibold text-text mb-2">Stays on your network</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              The transfer server runs on your PC. Your phone connects to it over the local network —
              files never leave your LAN, and Transfo has no cloud relay.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-[15px] font-semibold text-text mb-2">No accounts, no trackers</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              No account system, no analytics, no telemetry. Pairing is a local 6-digit code that
              issues a session token between your own devices.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-[15px] font-semibold text-text mb-2">Honest about the wire</h3>
            <p className="text-[13px] text-muted leading-relaxed">
              Transfers use plain HTTP over your local network, so the protocol is simple and
              inspectable. Use a trusted network (or your own Wi-Fi) when transferring.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}