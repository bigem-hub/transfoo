import { useEffect, useState } from 'react'
import * as bridge from '../bridge'
import { ReactStore, serverHttp, baseUrl } from '../hooks'
import { Btn, Chip, Icon, Progress, formatBytes } from '../ui'

export default function Receive() {
  const { state, action } = ReactStore()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dest, setDest] = useState(state.config.downloadDir)

  const base = baseUrl(state.config)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const res = await serverHttp('GET', '/api/transfer/sessions', state.token, null, state.config)
      if (res.status === 200 && Array.isArray(res.body)) {
        setSessions(res.body.map((s) => ({ ...s, done: s.done || s.received >= s.size })))
      } else if (res.status === 401) {
        setError('Transfer endpoint requires a paired device. Pair one in Devices first.')
        setSessions([])
      } else {
        setError(`Server returned HTTP ${res.status}`)
        setSessions([])
      }
    } catch {
      setError(`Could not reach ${base}. Is the Transfo server running?`)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (state.ready && state.token) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready, state.token])

  async function chooseFolder() {
    try {
      const res = await bridge.invoke('dialog.openFolder')
      if (res?.path) {
        setDest(res.path)
        action.setConfig({ downloadDir: res.path })
        bridge.invoke('config.set', { downloadDir: res.path }).catch(() => {})
      }
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function receive(s) {
    let target = dest
    if (!target) {
      try {
        const res = await bridge.invoke('dialog.openFolder')
        if (!res?.path) return
        target = res.path
      } catch {
        return
      }
      setDest(target)
      action.setConfig({ downloadDir: target })
      bridge.invoke('config.set', { downloadDir: target }).catch(() => {})
    }
    try {
      const res = await bridge.invoke('transfer.download', {
        baseUrl: base,
        token: state.token,
        sessionId: s.id,
        name: s.name,
        destPath: target,
      })
      if (!res?.handle) throw new Error(`failed to start download of ${s.name}`)
      action.upsertTransfer({ handle: res.handle, dir: 'receive', phase: 'started', fileName: s.name, total: s.size })
      await refresh()
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  const fetchable = sessions.filter((s) => !s.done)
  const ready = sessions.filter((s) => s.done)
  const running = Object.values(state.transfers).filter((t) => !['done', 'failed', 'canceled'].includes(t.phase) && t.dir === 'receive')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Receive</h1>
      <p className="text-[13px] text-muted mb-8">Incoming files published by your paired devices.</p>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-faint">dest</span>
          {dest ? (
            <button onClick={chooseFolder} className="flex items-center gap-2 text-[13px] text-muted hover:text-text transition-colors">
              <Icon name="folder" size={14} /> {dest}
            </button>
          ) : (
            <button onClick={chooseFolder} className="flex items-center gap-2 text-[13px] text-accent hover:underline underline-offset-2">
              <Icon name="folder" size={14} /> choose download folder
            </button>
          )}
        </div>
        <Btn variant="secondary" onClick={refresh} disabled={loading}>
          <Icon name="refresh" size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Btn>
      </div>

      {error && (
        <div className="rounded-xl border border-[#c2716b]/40 bg-[#c2716b]/[0.06] px-5 py-3.5 text-[13px] text-[#c2716b] mb-6">{error}</div>
      )}

      {!state.paired && !error && (
        <div className="rounded-xl border border-border bg-surface px-5 py-4 text-[13px] text-muted mb-6">
          No device paired yet. Pair a device in <span className="text-accent">Devices</span> to see incoming transfers.
        </div>
      )}

      {fetchable.length + ready.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-surface-2/60 px-5 py-12 text-center">
          <Icon name="receive" size={20} className="text-faint mx-auto mb-3" />
          <p className="text-[13px] text-muted">{state.paired ? 'No incoming transfers on the server.' : 'Waiting…'}</p>
          <p className="text-[11px] text-faint mt-1">Transfers appear here when a paired device publishes files.</p>
        </div>
      )}

      {fetchable.length > 0 && (
        <Section title="Incoming">
          {fetchable.map((s) => {
            const frac = s.size > 0 ? s.received / s.size : 0
            return (
              <Row key={s.id}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{s.name}</div>
                  <div className="font-mono text-[11px] text-faint">
                    {formatBytes(s.received)} of {formatBytes(s.size)}
                  </div>
                </div>
                <div className="w-32 shrink-0 mr-4">
                  <Progress value={frac} />
                </div>
                <Chip>receiving</Chip>
              </Row>
            )
          })}
        </Section>
      )}

      {ready.length > 0 && (
        <Section title={`Ready to receive (${ready.length})`}>
          {ready.map((s) => (
            <Row key={s.id}>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate">{s.name}</div>
                <div className="font-mono text-[11px] text-faint">{formatBytes(s.size)} · completed</div>
              </div>
              <Btn variant="secondary" onClick={() => receive(s)} disabled={!!running.length}>
                <Icon name="down" size={13} /> Receive
              </Btn>
            </Row>
          ))}
        </Section>
      )}

      {running.length > 0 && (
        <Section title="Downloading">
          {running.map((t) => {
            const frac = t.total > 0 ? t.transferred / t.total : 0
            return (
              <Row key={t.handle}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{t.fileName}</div>
                  <div className="font-mono text-[11px] text-faint">
                    {formatBytes(t.transferred)} / {formatBytes(t.total)}
                  </div>
                </div>
                <div className="w-32 shrink-0 mr-4">
                  <Progress value={frac} />
                </div>
                <span className="font-mono text-[11px] text-accent">{Math.round(frac * 100)}%</span>
              </Row>
            )
          })}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-[13px] font-medium text-muted mb-3">{title}</h2>
      <div className="divide-y divide-border border border-border rounded-xl bg-surface">{children}</div>
    </div>
  )
}

function Row({ children }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-3.5">{children}</div>
}