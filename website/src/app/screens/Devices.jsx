import { useEffect, useState } from 'react'
import * as bridge from '../bridge'
import { ReactStore, serverHttp, baseUrl } from '../hooks'
import { Btn, Chip, Icon, StatusDot } from '../ui'

export default function Devices() {
  const { state, action } = ReactStore()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [reqCode, setReqCode] = useState('')
  const [busy, setBusy] = useState(false)

  const base = baseUrl(state.config)

  useEffect(() => {
    if (state.config.discovery && state.ready && !state.discovering) {
      bridge.invoke('discovery.start').then(() => {
        action.dispatch({ type: 'set', payload: { discovering: true } })
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready])

  async function toggleDiscovery() {
    if (state.discovering) {
      try {
        await bridge.invoke('discovery.stop')
      } catch {
        /* host already stopped */
      }
      action.dispatch({ type: 'set', payload: { discovering: false } })
    } else {
      try {
        await bridge.invoke('discovery.start')
        action.dispatch({ type: 'set', payload: { discovering: true } })
        const snap = await bridge.invoke('discovery.snapshot')
        if (Array.isArray(snap)) action.setDevices(snap)
      } catch (e) {
        setMsg(e.message || 'could not start discovery')
      }
    }
  }

  async function requestCode() {
    setBusy(true)
    setMsg('')
    try {
      const res = await serverHttp('POST', '/api/pairing', '', JSON.stringify({ deviceName: state.config.deviceName }), state.config)
      if (res.status === 200 && res.body?.code) setReqCode(res.body.code)
      else setMsg(`Could not request a code (HTTP ${res.status})`)
    } catch {
      setMsg(`Could not reach ${base}`)
    } finally {
      setBusy(false)
    }
  }

  async function authorize() {
    const c = code.trim()
    if (!c) return
    setBusy(true)
    setMsg('')
    try {
      const login = await serverHttp('POST', '/api/auth/login', '', JSON.stringify({ email: 'pc', password: 'transfo' }), state.config)
      const loginToken = login.body?.token
      if (!loginToken) throw new Error('login failed')
      const pair = await serverHttp('POST', '/api/pairing/authorize', loginToken, JSON.stringify({ code: c }), state.config)
      if (pair.status === 200 && pair.body?.token) {
        action.setPaired(true, pair.body.token)
        setMsg(`Paired with ${pair.body.deviceName || 'device'} at ${new Date().toLocaleTimeString()}`)
        setCode('')
      } else {
        throw new Error(pair.body?.error || `HTTP ${pair.status}`)
      }
    } catch (e) {
      setMsg(`Pairing failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!state.token) return
    try {
      await serverHttp('DELETE', `/api/pairing/${encodeURIComponent('self')}`, state.token, '', state.config)
    } catch {
      /* best-effort */
    }
    action.setPaired(false, '')
    setMsg('Local pairing cleared.')
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] mb-1">Devices</h1>
      <p className="text-[13px] text-muted mb-8">Discover and pair the devices on your network.</p>

      {/* discover + server */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Icon name="network" size={16} className="text-accent" />
              <span className="text-[14px] font-medium">LAN discovery</span>
            </div>
            <StatusDot tone={state.discovering ? 'ok' : 'muted'} pulse={state.discovering} />
          </div>
          <p className="font-mono text-[11px] text-faint mb-4">UDP announce on port 4001</p>
          <Btn variant={state.discovering ? 'secondary' : 'primary'} onClick={toggleDiscovery} className="w-full">
            <Icon name={state.discovering ? 'x' : 'network'} size={14} />
            {state.discovering ? 'Stop discovery' : 'Start discovery'}
          </Btn>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Icon name="pulse" size={16} className="text-accent" />
              <span className="text-[14px] font-medium">Transfo server</span>
            </div>
            <Chip tone={state.paired ? 'ok' : 'default'}>{state.paired ? 'paired' : 'unpaired'}</Chip>
          </div>
          <p className="font-mono text-[11px] text-faint mb-4">{base}</p>
          <Btn variant="secondary" onClick={requestCode} disabled={busy || !state.ready} className="w-full">
            <Icon name="key" size={14} /> {reqCode ? `Code: ${reqCode}` : 'Request a pairing code'}
          </Btn>
          {reqCode && (
            <p className="mt-3 text-[12px] text-muted">
              Enter <span className="font-mono text-accent">{reqCode}</span> on your phone to pair it. Code expires in 5 minutes.
            </p>
          )}
        </div>
      </div>

      {/* enter a code from a phone */}
      {!state.paired && (
        <div className="rounded-xl border border-border bg-surface p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <Icon name="key" size={16} className="text-accent" />
            <span className="text-[14px] font-medium">Authorize a phone</span>
          </div>
          <p className="text-[12px] text-muted mb-4">Started pairing from the phone? Enter the 6-digit code it shows.</p>
          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="flex-1 min-w-0 rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-[15px] text-text tracking-[0.3em] placeholder:tracking-normal placeholder:text-faint focus:border-accent/60 focus:outline-none transition-colors"
              inputMode="numeric"
            />
            <Btn onClick={authorize} disabled={code.length !== 6 || busy}>
              <Icon name="check" size={14} /> Authorize
            </Btn>
          </div>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border px-5 py-3.5 text-[13px] mb-6 ${msg.includes('failed') || msg.includes('Could') ? 'border-[#c2716b]/40 bg-[#c2716b]/[0.06] text-[#c2716b]' : 'border-border bg-surface text-muted'}`}>
          {msg}
        </div>
      )}

      {/* devices */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">Discovered devices</h2>
        <span className="font-mono text-[11px] text-faint">{state.devices.length}</span>
      </div>

      {state.devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-2/60 px-5 py-12 text-center">
          <Icon name="devices" size={20} className="text-faint mx-auto mb-3" />
          <p className="text-[13px] text-muted">No devices discovered.</p>
          <p className="text-[11px] text-faint mt-1">Make sure the other device is on this network and announcing.</p>
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-xl bg-surface">
          {state.devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="devices" size={15} className="text-faint shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{d.name}</div>
<div className="font-mono text-[11px] text-faint">
                      {d.ip}:{d.port} · {typeof d.lastSeen === 'number' && d.lastSeen > 0 ? `${Math.max(1, Math.round((Date.now() - d.lastSeen) / 1000))}s ago` : 'just now'}
                    </div>
                </div>
              </div>
<Chip tone="ok">
                  <StatusDot tone="ok" /> LAN
                </Chip>
            </div>
          ))}
        </div>
      )}

      {state.paired && (
        <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-4 flex items-center justify-between">
          <div className="text-[13px] text-muted">Currently paired with this server.</div>
          <Btn variant="danger" onClick={revoke}>
            <Icon name="logout" size={14} /> Revoke
          </Btn>
        </div>
      )}
    </div>
  )
}