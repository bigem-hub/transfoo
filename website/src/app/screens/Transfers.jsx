import * as bridge from '../bridge'
import { ReactStore } from '../hooks'
import { Chip, Icon, Progress, formatBytes } from '../ui'

export default function Transfers() {
  const { state, action } = ReactStore()
  const active = Object.values(state.transfers).filter((t) => !['done', 'failed', 'canceled'].includes(t.phase))
  const finished = Object.values(state.transfers).filter((t) => ['done', 'failed', 'canceled'].includes(t.phase))
  const history = state.history

  function cancel(handle) {
    bridge.invoke('transfer.cancel', { handle }).catch(() => {})
  }
  function forget(handle) {
    bridge.invoke('transfer.forget', { handle }).catch(() => {})
    action.removeTransfer(handle)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Transfers</h1>
      <p className="text-[13px] text-muted mb-8">Everything that’s moving or has moved.</p>

      <Section title={`Active (${active.length})`}>
        {active.length === 0 ? (
          <Empty>No active transfers.</Empty>
        ) : (
          active.map((t) => {
            const frac = t.total > 0 ? t.transferred / t.total : 0
            return (
              <div key={t.handle} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon name={t.dir === 'receive' ? 'down' : 'up'} size={14} className="text-accent shrink-0" />
                    <span className="text-[13px] truncate">{t.fileName}</span>
                    <Chip tone={t.dir === 'receive' ? 'accent' : 'default'}>{t.dir === 'receive' ? 'recv' : 'send'}</Chip>
                  </div>
                  <button onClick={() => cancel(t.handle)} className="text-[11px] text-faint hover:text-[#c2716b] transition-colors shrink-0">
                    cancel
                  </button>
                </div>
                <Progress value={frac} />
                <div className="flex justify-between font-mono text-[10px] text-faint mt-1.5">
                  <span>
                    {formatBytes(t.transferred)} / {formatBytes(t.total)}
                  </span>
                  <span>{Math.round(frac * 100)}%</span>
                </div>
              </div>
            )
          })
        )}
      </Section>

      <Section title={`Completed (${finished.length})`}>
        {finished.length === 0 ? (
          <Empty>Nothing finished yet.</Empty>
        ) : (
          finished.map((t) => (
            <div key={t.handle} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name={t.dir === 'receive' ? 'down' : 'up'} size={14} className="text-faint shrink-0" />
                <span className="text-[13px] truncate">{t.fileName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {t.total > 0 && <span className="font-mono text-[11px] text-faint">{formatBytes(t.total)}</span>}
                <Chip tone={t.phase === 'done' ? 'ok' : t.phase === 'failed' ? 'bad' : 'default'}>{t.phase}</Chip>
                <button onClick={() => forget(t.handle)} className="text-[11px] text-faint hover:text-text transition-colors">
                  clear
                </button>
              </div>
            </div>
          ))
        )}
      </Section>

      {history.length > 0 && (
        <Section title="History">
          {history.slice(0, 12).map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name={h.dir === 'receive' ? 'down' : 'up'} size={14} className="text-faint shrink-0" />
                <span className="text-[13px] truncate">{h.fileName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[11px] text-faint">
                  {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Chip tone={h.phase === 'done' ? 'ok' : h.phase === 'failed' ? 'bad' : 'default'}>{h.phase}</Chip>
              </div>
            </div>
          ))}
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

function Empty({ children }) {
  return <div className="px-5 py-6 text-center text-[12px] text-faint">{children}</div>
}