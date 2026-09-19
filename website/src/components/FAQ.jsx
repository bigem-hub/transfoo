import { useState } from 'react'

const faqs = [
  {
    q: 'Do transfers go through the internet?',
    a: 'No. Your phone sends files to the Transfo server that runs on your PC over your local network. Nothing is routed through a cloud service.',
  },
  {
    q: 'What do I need to run Transfo?',
    a: 'A Windows 10/11 PC and an Android 8.0+ phone on the same local network (usually the same Wi-Fi). Install the app on both, pair once, and transfer.',
  },
  {
    q: 'How does pairing work?',
    a: 'The phone requests a 6-digit code from your PC, you enter it on the PC, and the two devices exchange a short-lived session token. Codes expire after five minutes.',
  },
  {
    q: 'Can it handle large files?',
    a: 'Yes. Files are streamed in 256 KB chunks, so multi-gigabyte transfers do not require loading the file into memory.',
  },
  {
    q: 'What happens if the connection drops mid-transfer?',
    a: 'The transfer keeps a byte cursor on the server. When the connection returns, the transfer resumes from the last accepted chunk instead of starting over.',
  },
  {
    q: 'Is my data encrypted?',
    a: 'Transfers use plain HTTP over your local network, just like browsing a local router page. It is fast and inspectable, but not end-to-end encrypted — use it on networks you trust.',
  },
  {
    q: 'Does Transfo need an account?',
    a: 'No account, no sign-up, no telemetry. Pairing happens between your own devices with a local code.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="relative py-24 sm:py-32 tf-divider">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-[-0.02em] text-text leading-tight">
            Questions, answered honestly
          </h2>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left"
                >
                  <span className="text-[15px] font-medium text-text">{f.q}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                    isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-[13px] text-muted leading-relaxed pb-5 pr-8">{f.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}