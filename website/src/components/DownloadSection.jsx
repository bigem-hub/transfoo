import { downloads } from '../config/downloads'

function DownloadCard({ platform, title, details, cta, note }) {
  const cfg = downloads[platform]
  return (
    <a
      href={cfg.url}
      download={cfg.filename}
      className="group block rounded-xl border border-border bg-surface p-7 hover:border-border-strong hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-accent">
            {platform === 'windows' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M0 3.449 9.75 2.1v9.451H0m10.95-9.6L24 0v11.4H10.95M0 12.6h9.75v9.451L0 20.699M10.95 12.6H24V24l-13.05-1.85" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.523 15.341a.996.996 0 0 0-.996.996c0 .55.446.996.996.996s.996-.446.996-.996a.997.997 0 0 0-.996-.996zm-11.046 0a.996.996 0 0 0-.996.996c0 .55.446.996.996.996s.996-.446.996-.996a.997.997 0 0 0-.996-.996zm11.405-6.852 1.996-3.457a.416.416 0 0 0-.152-.568.416.416 0 0 0-.568.152l-2.023 3.504C15.65 7.429 13.882 7 12 7s-3.65.429-5.135 1.12L4.842 4.616a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.568l1.996 3.457C2.688 10.364.35 13.565.04 17.25h23.92c-.31-3.685-2.648-6.886-6.078-8.761z" />
              </svg>
            )}
          </span>
          <div>
            <div className="text-[15px] font-semibold text-text">{title}</div>
            <div className="font-mono text-[10px] text-faint">v{cfg.version} · {cfg.label}</div>
          </div>
        </div>
      </div>

      <dl className="font-mono text-[11px] text-muted space-y-2 mb-6">
        {details.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6">
            <dt className="text-faint">{k}</dt>
            <dd className="text-right text-text/90">{v}</dd>
          </div>
        ))}
      </dl>

      <span className="flex items-center justify-center gap-2 rounded-lg bg-accent text-on-accent text-[14px] font-semibold py-3 group-hover:brightness-110 transition-[filter]">
        {cta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
        </svg>
      </span>
      <p className="font-mono text-[10px] text-faint text-center mt-3">{note}</p>
    </a>
  )
}

export default function DownloadSection() {
  return (
    <section id="download" className="relative py-24 sm:py-32 tf-divider">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">Download</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            Get Transfo on both devices
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <DownloadCard
            platform="windows"
            title="Transfo for Windows"
            cta="Download for Windows"
            note={`Installer · ${downloads.windows.size}`}
            details={[
              ['OS', 'Windows 10 / 11 (x64)'],
              ['Size', downloads.windows.size],
              ['Type', 'Setup .exe'],
              ['Runtime', '.NET 8 · self-contained'],
            ]}
          />
          <DownloadCard
            platform="android"
            title="Transfo for Android"
            cta="Get the Android app"
            note={`Standalone APK · ${downloads.android.size}`}
            details={[
              ['OS', 'Android 8.0+ (API 26+)'],
              ['Size', downloads.android.size],
              ['Type', 'APK'],
              ['Arch', 'arm64 · armv7 · x86_64'],
            ]}
          />
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-faint">
          Install both, keep them on the same Wi-Fi, and pair once. Transfers work whenever the PC is on.
        </p>
      </div>
    </section>
  )
}