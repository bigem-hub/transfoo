import { downloads } from '../config/downloads'
import BrandLogo from './BrandLogo'

const cols = [
  { title: 'Product', links: [['How it works', '#how-it-works'], ['Features', '#features'], ['Apps', '#showcase'], ['Architecture', '#architecture']] },
  { title: 'Download', links: [['Windows', '#download'], ['Android', '#download']] },
  { title: 'Open', links: [['FAQ', '#faq'], ['Protocol', '#architecture']] },
]

export default function Footer() {
  return (
    <footer className="tf-divider py-14">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BrandLogo size={26} />
              <span className="text-[13px] font-semibold tracking-[0.12em] text-text">TRANSFO</span>
            </div>
            <p className="text-[12px] text-faint leading-relaxed max-w-[240px]">
              Local file transfer between your Windows PC and Android phone. No cloud, no accounts.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint mb-4">{c.title}</div>
              <ul className="space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-[13px] text-muted hover:text-text transition-colors">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="tf-divider pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-faint">© 2026 Transfo · v{downloads.windows.version}</p>
          <p className="font-mono text-[11px] text-faint">LAN HTTP + UDP · JSON chunks</p>
        </div>
      </div>
    </footer>
  )
}