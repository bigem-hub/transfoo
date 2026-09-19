import { useState } from 'react'
import { downloads } from '../config/downloads'
import BrandLogo from './BrandLogo'

const links = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#showcase', label: 'Apps' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#download', label: 'Download' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/0 bg-transparent">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#top" className="flex items-center gap-3">
            <BrandLogo size={30} />
            <span className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tracking-[0.12em] text-text">TRANSFO</span>
              <span className="text-[10px] font-mono text-faint">v{downloads.windows.version}</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] text-muted hover:text-text transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={downloads.windows.url}
              download={downloads.windows.filename}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-[13px] font-semibold hover:brightness-110 transition-[filter]"
            >
              Download for Windows
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-surface text-text"
              aria-label="Toggle navigation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {open ? (
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                ) : (
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-bg/95 backdrop-blur-xl">
          <nav className="max-w-6xl mx-auto px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-surface rounded-lg transition-colors"
              >
                {l.label}
              </a>
            ))}
            <a
              href={downloads.windows.url}
              download={downloads.windows.filename}
              className="mt-2 px-3 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-semibold text-center"
            >
              Download for Windows
            </a>
            <a
              href={downloads.android.url}
              download={downloads.android.filename}
              className="px-3 py-2.5 rounded-lg border border-border bg-surface text-sm font-semibold text-center text-text"
            >
              Get Android App
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}