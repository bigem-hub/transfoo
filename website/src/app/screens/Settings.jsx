import { useState } from 'react'
import * as bridge from '../bridge'
import { ReactStore, baseUrl } from '../hooks'
import { Btn, Chip } from '../ui'

export default function Settings() {
  const { state, action } = ReactStore()
  const [form, setForm] = useState({
    deviceName: state.config.deviceName,
    serverUrl: state.config.serverUrl,
    port: String(state.config.port),
    discovery: state.config.discovery,
  })
  const [saved, setSaved] = useState('')

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }))
    setSaved('')
  }

  async function save() {
    const clean = (form.serverUrl || '').replace(/\/+$/, '')
    const port = parseInt(form.port, 10) || 4000
    const patch = { deviceName: form.deviceName.trim() || 'MY-PC', serverUrl: clean || 'http://192.168.1.104', port, discovery: form.discovery }
    action.setConfig(patch)
    bridge
      .invoke('config.set', patch)
      .then(() => setSaved('Saved.'))
      .catch(() => setSaved('Could not reach host in preview mode.'))
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Settings</h1>
      <p className="text-[13px] text-muted mb-8">Application, network and device settings.</p>

      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        <Field label="Device name" hint="Announced to other devices during discovery.">
          <input
            value={form.deviceName}
            onChange={(e) => set({ deviceName: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-text focus:border-accent/60 focus:outline-none transition-colors"
          />
        </Field>

        <Field label="Transfo server" hint="Where your LAN server runs (usually this PC).">
          <div className="flex gap-2.5">
            <input
              value={form.serverUrl}
              onChange={(e) => set({ serverUrl: e.target.value })}
              placeholder="http://192.168.1.104"
              className="flex-1 min-w-0 rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-[13px] text-text focus:border-accent/60 focus:outline-none transition-colors"
            />
            <input
              value={form.port}
              onChange={(e) => set({ port: e.target.value })}
              inputMode="numeric"
              className="w-20 rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-text text-center focus:border-accent/60 focus:outline-none transition-colors"
            />
          </div>
          <p className="font-mono text-[11px] text-faint mt-2">resolves to {baseUrl({ serverUrl: form.serverUrl, port: parseInt(form.port, 10) || 4000 })}</p>
        </Field>

        <Field label="Auto-discover on start" hint="Start LAN discovery automatically when the app opens.">
          <button
            onClick={() => set({ discovery: !form.discovery })}
            className={`relative w-10 h-[22px] rounded-full transition-colors ${form.discovery ? 'bg-accent' : 'bg-surface-3 border border-border-strong'}`}
            aria-pressed={form.discovery}
          >
            <span
              className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-text transition-[left] duration-200 ${form.discovery ? 'left-[20px]' : 'left-[2px]'}`}
            />
          </button>
        </Field>
      </div>

      <div className="flex items-center justify-between mt-5">
        <span className="text-[12px] text-muted">{saved || ' '}</span>
        <Btn onClick={save}>
          <span>Save settings</span>
        </Btn>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 mt-8">
        <h2 className="text-[13px] font-medium text-muted mb-3">About</h2>
        <div className="space-y-2 font-mono text-[12px]">
          <div className="flex justify-between">
            <span className="text-faint">product</span>
            <span className="text-text">Transfo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-faint">version</span>
            <span className="text-text">1.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-faint">host</span>
            <span className="text-text">{state.host ? (state.host.desktop === false ? 'preview (no desktop host)' : `desktop host v${state.host.version}`) : 'connecting…'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-faint">transfer core</span>
            <Chip>TransfoCore.dll · chunked · resumable</Chip>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="px-6 py-5">
      <div className="text-[13px] font-medium text-text mb-1.5">{label}</div>
      <div className="text-[12px] text-faint mb-3">{hint}</div>
      {children}
    </div>
  )
}