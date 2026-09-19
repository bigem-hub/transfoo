import { downloads } from '../config/downloads'
import HeroVisual from './HeroVisual'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* atmosphere */}
      <div className="absolute inset-0 tf-grid tf-mask-radial pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-accent/[0.05] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-36 pb-24 sm:pt-44 sm:pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border bg-surface text-[11px] font-mono text-muted mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent tf-pulse-dot" />
            Transfo v{downloads.windows.version} · LAN · Windows &amp; Android
          </div>

          <h1 className="text-[42px] leading-[1.05] sm:text-6xl lg:text-[68px] font-semibold tracking-[-0.03em] text-text mb-7">
            Move files.
            <br />
            <span className="tf-accent-text">Without the cloud.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Transfo sends files directly between your Windows PC and Android phone
            over your local network. No upload steps, no cloud detour, no accounts.
            Install on both devices, pair once, and transfer.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-12">
            <a
              href={downloads.windows.url}
              download={downloads.windows.filename}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-accent text-on-accent text-[15px] font-semibold hover:brightness-110 transition-[filter,transform] hover:-translate-y-0.5"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M0 3.449 9.75 2.1v9.451H0m10.95-9.6L24 0v11.4H10.95M0 12.6h9.75v9.451L0 20.699M10.95 12.6H24V24l-13.05-1.85" />
              </svg>
              Download for Windows
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/15 font-medium">{downloads.windows.size}</span>
            </a>

            <a
              href={downloads.android.url}
              download={downloads.android.filename}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl border border-border bg-surface text-text text-[15px] font-semibold hover:border-border-strong hover:bg-surface-2 transition-[filter,transform] hover:-translate-y-0.5"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.523 15.341a.996.996 0 0 0-.996.996c0 .55.446.996.996.996s.996-.446.996-.996a.997.997 0 0 0-.996-.996zm-11.046 0a.996.996 0 0 0-.996.996c0 .55.446.996.996.996s.996-.446.996-.996a.997.997 0 0 0-.996-.996zm11.405-6.852 1.996-3.457a.416.416 0 0 0-.152-.568.416.416 0 0 0-.568.152l-2.023 3.504C15.65 7.429 13.882 7 12 7s-3.65.429-5.135 1.12L4.842 4.616a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.568l1.996 3.457C2.688 10.364.35 13.565.04 17.25h23.92c-.31-3.685-2.648-6.886-6.078-8.761z" />
              </svg>
              Get Android App
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-muted font-medium">{downloads.android.size}</span>
            </a>
          </div>

          {/* factual strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
            {[
              ['Local only', 'Transfers stay on your network'],
              ['Chunked', 'Reliable large-file streaming'],
              ['Resumable', 'Interrupted transfers continue'],
              ['Open protocol', 'Simple HTTP + JSON, no SDK lock-in'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-surface px-4 py-3.5">
                <div className="text-[13px] font-medium text-text">{k}</div>
                <div className="text-[11px] text-faint mt-0.5 leading-snug">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* product visual */}
        <div className="mt-16 sm:mt-20 flex justify-center">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}