import { useState } from 'react'
import * as bridge from '../bridge'
import { baseUrl, ReactStore } from '../hooks'
import { Btn, Chip, Icon, Progress, formatBytes } from '../ui'

export default function Send() {
  const { state, action } = ReactStore()
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const base = baseUrl(state.config)

  async function pickFiles() {
    setError('')
    try {
      const res = await bridge.invoke('dialog.openFiles')
      if (res?.paths?.length) {
        setFiles(res.paths)
      }
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function start() {
    if (!files.length || busy) return
    setBusy(true)
    setError('')
    try {
      for (const f of files) {
        const res = await bridge.invoke('transfer.upload', {
          baseUrl: base,
          token: state.token,
          filePath: f.path,
          resume: true,
        })
        if (!res?.handle) throw new Error(`failed to start ${f.name}`)
        action.upsertTransfer({ handle: res.handle, dir: 'send', phase: 'started', fileName: f.name })
      }
      setFiles([])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function cancel(handle) {
    bridge.invoke('transfer.cancel', { handle }).catch(() => {})
  }

  const running = Object.values(state.transfers).filter((t) => !['done', 'failed', 'canceled'].includes(t.phase))

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Send</h1>
      <p className="text-[13px] text-muted mb-8">Publish files to your Transfo server so paired devices can receive them.</p>

      {!state.paired && (
        <div className="rounded-xl border border-border bg-surface px-5 py-3.5 mb-6 flex items-center gap-3">
          <Icon name="info" size={15} className="text-accent" />
          <span className="text-[13px] text-muted">
            No device is paired. Pair one first in <span className="text-accent">Devices</span>.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface mb-6">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Icon name="file" size={16} className="text-accent" />
              <span className="text-[14px] font-medium">Selected files</span>
            </div>
            <Chip>{files.length} files</Chip>
          </div>

          <button
            onClick={pickFiles}
            className="w-full rounded-lg border border-dashed border-border-strong hover:border-accent/50 hover:bg-surface-2 transition-colors px-5 py-12 flex flex-col items-center gap-2"
          >
            <Icon name="folder" size={22} className="text-faint" />
            <span className="text-[13px] text-muted">Choose files to send</span>
            <span className="font-mono text-[10px] text-faint">native file dialog</span>
          </button>

          {files.length > 0 && (
            <div className="mt-4 divide-y divide-border border border-border rounded-lg">
              {files.map((f) => (
                <div key={f.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon name="file" size={14} className="text-faint shrink-0" />
                    <span className="text-[13px] truncate">{f.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-faint shrink-0">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          <div className="font-mono text-[11px] text-faint">dest · {base}</div>
          <Btn onClick={start} disabled={!files.length || busy || !state.paired}>
            <Icon name="send" size={14} /> {busy ? 'Starting…' : 'Send files'}
          </Btn>
        </div>
      </div>

      {running.length > 0 && (
        <div className="rounded-xl border border-border bg-surface mb-6">
          <div className="px-5 py-3.5 border-b border-border text-[13px] font-medium">Active uploads</div>
          <div className="divide-y divide-border">
            {running.map((t) => {
              const frac = t.total > 0 ? t.transferred / t.total : 0
              return (
                <div key={t.handle} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[13px] truncate">{t.fileName}</span>
                    <button onClick={() => cancel(t.handle)} className="text-[11px] text-faint hover:text-[#c2716b] transition-colors shrink-0">
                      cancel
                    </button>
                  </div>
                  <Progress value={frac} />
                  <div className="flex justify-between font-mono text-[10px] text-faint mt-1.5">
                    <span>{formatBytes(t.transferred)} / {formatBytes(t.total)}</span>
                    <span>{Math.round(frac * 100)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#c2716b]/40 bg-[#c2716b]/[0.06] px-5 py-3.5 text-[13px] text-[#c2716b]">
          {error}
        </div>
      )}
    </div>
  )
}