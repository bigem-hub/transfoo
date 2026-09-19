import { useEffect, useState } from 'react'
import { baseUrl } from '../hooks'
import * as bridge from '../bridge'
import { ReactStore } from '../hooks'
import { Chip, Icon, StatusDot, formatBytes } from '../ui'

export default function Home({ go }) {
  const { state } = ReactStore()
  const [serverOk, setServerOk] = useState(null)
  const active = Object.values(state.transfers).filter((t) => !['done', 'failed', 'canceled'].includes(t.phase))

  useEffect(() => {
    bridge
      .invoke('http', { method: 'GET', url: baseUrl(state.config) + '/api/pairing', token: '', json: '' })
      .then((res) => setServerOk(res?.status === 200))
      .catch(() => setServerOk(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Home</h1>
      <p className="text-[13px] text-muted mb-8">Your Transfo setup at a glance.</p>

      {/* status strip */}
      <div className="rounded-xl border border-border bg-surface p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <StatusDot tone={serverOk ? 'ok' : 'muted'} pulse={serverOk} />
            <div>
              <div className="text-[14px] font-medium">
                {serverOk === null ? 'Checking Transfo server…' : serverOk ? 'Transfo server online' : 'Transfo server offline'}
              </div>
              <div className="font-mono text-[11px] text-faint">{baseUrl(state.config)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Chip tone={state.paired ? 'ok' : 'default'}>{state.paired ? 'paired device' : 'not paired'}</Chip>
            {active.length > 0 && <Chip tone="accent">{active.length} active</Chip>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <button onClick={() => go('send')} className="rounded-xl border border-border bg-surface p-5 text-left hover:border-accent/40 hover:bg-surface-2 transition-colors group">
          <Icon name="send" size={18} className="text-accent mb-3" />
          <div className="text-[14px] font-semibold group-hover:text-accent transition-colors">Send files</div>
          <div className="text-[12px] text-muted mt-1">Publish files to your Transfo hub for paired devices.</div>
        </button>
        <button onClick={() => go('receive')} className="rounded-xl border border-border bg-surface p-5 text-left hover:border-accent/40 hover:bg-surface-2 transition-colors group">
          <Icon name="receive" size={18} className="text-accent mb-3" />
          <div className="text-[14px] font-semibold group-hover:text-accent transition-colors">Receive files</div>
          <div className="text-[12px] text-muted mt-1">Pull incoming transfers from the server to your PC.</div>
        </button>
      </div>

      {/* devices */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-medium text-muted">Your devices</h2>
          <button onClick={() => go('devices')} className="font-mono text-[11px] text-faint hover:text-accent transition-colors">
            {state.devices.length} found
          </button>
        </div>
        {state.devices.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-2/60 px-5 py-6 text-center">
            <p className="text-[13px] text-muted">No devices discovered yet.</p>
            <p className="text-[11px] text-faint mt-1">Start discovery in Devices when your phone is on the same network.</p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl bg-surface">
            {state.devices.slice(0, 4).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Icon name="devices" size={15} className="text-faint" />
                  <div>
                    <div className="text-[13px] font-medium">{d.name}</div>
                    <div className="font-mono text-[11px] text-faint">
                      {d.ip}:{d.port}
                    </div>
                  </div>
                </div>
                <Chip tone="ok">
                  <StatusDot tone="ok" /> lan
                </Chip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* recent transfers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-medium text-muted">Recent transfers</h2>
          <button onClick={() => go('transfers')} className="font-mono text-[11px] text-faint hover:text-accent transition-colors">
            view all
          </button>
        </div>
        {state.history.length === 0 ? (
          <p className="text-[12px] text-faint">Nothing transferred yet.</p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl bg-surface">
            {state.history.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon name={h.dir === 'receive' ? 'receive' : 'send'} size={14} className="text-faint shrink-0" />
                  <span className="text-[13px] truncate">{h.fileName || 'unnamed'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-faint">{formatBytes(h.total)}</span>
                  <Chip tone={h.phase === 'done' ? 'ok' : h.phase === 'failed' ? 'bad' : 'default'}>{h.phase}</Chip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}