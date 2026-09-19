import * as bridge from './bridge'
import { ReactStore, useBoot, baseUrl } from './hooks'
import { useEffect, useState } from 'react'
import { Icon, StatusDot } from './ui'
import Home from './screens/Home'
import Send from './screens/Send'
import Receive from './screens/Receive'
import Devices from './screens/Devices'
import Transfers from './screens/Transfers'
import Settings from './screens/Settings'

const nav = [
  ['home', 'Home'],
  ['send', 'Send'],
  ['receive', 'Receive'],
  ['devices', 'Devices'],
  ['transfers', 'Transfers'],
]

export default function AppShell() {
  const store = useBoot()
  const { state } = store
  const [page, setPage] = useState('home')

  return (
    <div className="flex h-screen w-screen bg-bg text-text overflow-hidden">
      {/* sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-surface/50 flex flex-col min-h-0">
        <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-border">
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#101012" stroke="#232326" />
            <rect x="7" y="12.5" width="10" height="17" rx="2" stroke="#e3a35e" strokeWidth="2" />
            <line x1="9.5" y1="27" x2="14.5" y2="27" stroke="#e3a35e" strokeWidth="1.4" />
            <rect x="23" y="10.5" width="11.5" height="8.5" rx="1.4" stroke="#cfd0d4" strokeWidth="2" />
          </svg>
          <span className="text-[13px] font-semibold tracking-[0.14em] text-text">TRANSFO</span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {nav.map(([key, label]) => {
            const active = page === key
            return (
              <button
                key={key}
                onClick={() => setPage(key)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] transition-colors ${
                  active ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface'
                }`}
              >
                <Icon name={key} size={15} className={active ? 'text-accent' : ''} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto p-3 border-t border-border">
          <button
            onClick={() => setPage('settings')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg w-full text-[13px] transition-colors ${
              page === 'settings' ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Icon name="settings" size={15} className={page === 'settings' ? 'text-accent' : ''} />
            Settings
          </button>
          <HostState />
        </div>
      </aside>

      {/* content */}
      <main className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-8 h-[60px] border-b border-border shrink-0">
          <div className="text-[15px] font-medium">
            {nav.find(([k]) => k === page)?.[1] ?? 'Settings'}
          </div>
          <div className="flex items-center gap-5 font-mono text-[11px] text-faint">
            <ServerState server={state.config} />
            {!window.chrome?.webview && <span className="text-accent">preview mode</span>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 min-h-0">
          {page === 'home' && <Home go={setPage} />}
          {page === 'send' && <Send />}
          {page === 'receive' && <Receive />}
          {page === 'devices' && <Devices />}
          {page === 'transfers' && <Transfers />}
          {page === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}

function HostState() {
  const { state } = ReactStore()
  return (
    <div className="flex items-center gap-2 px-3.5 py-2 font-mono text-[10px] text-faint">
      {state.host?.desktop === false ? (
        <>
          <StatusDot tone="accent" pulse /> preview
        </>
      ) : state.host ? (
        <>
          <StatusDot tone="ok" pulse /> host v{state.host.version}
        </>
      ) : (
        <>
          <StatusDot /> connecting…
        </>
      )}
    </div>
  )
}

function ServerState({ server }) {
  const [ok, setOk] = useState(null)
  useEffect(() => {
    let alive = true
    bridge.invoke('http', {
      method: 'GET',
      url: baseUrl(server) + '/api/pairing',
      token: '',
      json: '',
    })
      .then((res) => alive && setOk(res?.status === 200))
      .catch(() => alive && setOk(false))
    return () => {
      alive = false
    }
  }, [server])

  return (
    <span className="inline-flex items-center gap-2">
      <StatusDot tone={ok ? 'ok' : 'muted'} pulse={ok} />
      {ok === null ? 'checking server…' : ok ? baseUrl(server) : `${baseUrl(server)} · offline`}
    </span>
  )
}