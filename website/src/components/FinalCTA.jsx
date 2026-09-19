import { downloads } from '../config/downloads'

export default function FinalCTA() {
  return (
    <section className="relative py-28 tf-divider overflow-hidden">
      <div className="absolute inset-0 tf-grid tf-mask-radial pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-4">Transfo v{downloads.windows.version}</p>
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.02em] text-text leading-tight mb-6">
          Your files, one local hop away
        </h2>
        <p className="text-muted text-[15px] mb-10 max-w-xl mx-auto">
          Install on your PC and phone, pair once, and never think about uploads again.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <a
            href={downloads.windows.url}
            download={downloads.windows.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-accent text-on-accent text-[15px] font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-[filter,transform]"
          >
            Download for Windows
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/15 font-medium">{downloads.windows.size}</span>
          </a>
          <a
            href={downloads.android.url}
            download={downloads.android.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl border border-border bg-surface text-text text-[15px] font-semibold hover:border-border-strong hover:bg-surface-2 hover:-translate-y-0.5 transition-[filter,transform]"
          >
            Get Android App
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-muted font-medium">{downloads.android.size}</span>
          </a>
        </div>
      </div>
    </section>
  )
}