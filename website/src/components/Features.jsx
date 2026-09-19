const features = [
  {
    title: 'Direct LAN transfer',
    body: 'Files move across your local network, not through the internet. Nothing is uploaded to a remote service on its way between your devices.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="3" />
        <circle cx="19" cy="6" r="2.5" />
        <circle cx="19" cy="18" r="2.5" />
        <path d="M7.7 10.5 16.4 7M7.7 13.5l8.7 3.5" />
      </svg>
    ),
  },
  {
    title: 'Windows + Android',
    body: 'One product, two native apps. The desktop app runs on Windows 10/11, the mobile app on Android 8.0 and newer.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="13" height="9" rx="2" />
        <path d="M17 14v6M11 14v6M10 20h9M3 20h5M8.5 17h7" />
      </svg>
    ),
  },
  {
    title: 'Code-based pairing',
    body: 'A 6-digit code authorizes devices and issues a session token. Pair once, transfer whenever both devices are on the network.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </svg>
    ),
  },
  {
    title: 'Large file support',
    body: 'Files are split into 256 KB chunks and streamed sequentially, so multi-gigabyte transfers run without loading the file into memory.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    ),
  },
  {
    title: 'Resumable transfers',
    body: 'Transfers track their byte cursor. If the connection drops, the transfer resumes from the last accepted chunk instead of restarting.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4.5 4 10h8L7 4.5z" />
        <path d="M17 4.5 14 10h8L17 4.5z" />
        <path d="M5 14h14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5z" />
      </svg>
    ),
  },
  {
    title: 'Multi-file transfers',
    body: 'Send several files in one go. Each file becomes its own transfer session with individual progress, flowing through a single queue.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </svg>
    ),
  },
]

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32 tf-divider">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">Features</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            What Transfo actually does
          </h2>
          <p className="text-muted mt-4 text-[15px]">
            A focused set of capabilities built around one job: moving files between your Windows PC and Android phone.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface p-6 hover:border-border-strong hover:bg-surface-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-accent mb-5">
                {f.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-text mb-2">{f.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}