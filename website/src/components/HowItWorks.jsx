const steps = [
  {
    n: '01',
    title: 'Install Transfo',
    body: 'Install the Windows app on your PC and the Android app on your phone. Both run on the same local network.',
  },
  {
    n: '02',
    title: 'Pair your devices',
    body: 'The phone shows a 6-digit code. Enter it on the PC to authorize the device. The exchange issues a short-lived session token.',
  },
  {
    n: '03',
    title: 'Select files',
    body: 'Pick files from either device. Transfo chunks each file and streams it to a transfer session on your PC.',
  },
  {
    n: '04',
    title: 'Transfer directly',
    body: 'Files move over your LAN in resumable chunks. An interrupted transfer can be picked up again where it stopped.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 tf-divider">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">How it works</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            From install to transfer in four steps
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`relative rounded-xl border border-border bg-surface p-6 ${
                i % 2 === 1 ? 'translate-y-0 lg:translate-y-4' : ''
              }`}
            >
              <div className="font-mono text-[12px] text-faint mb-4">{s.n}</div>
              <h3 className="text-[15px] font-semibold text-text mb-2.5">{s.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{s.body}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-4 z-10 w-4 text-border-strong" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}