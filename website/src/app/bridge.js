/**
 * Transfo Desktop bridge.
 *
 * When the shared UI runs inside the Transfo Windows host (WPF + WebView2), the
 * host injects `window.chrome.webview`. All commands are routed to the native
 * host, which calls the C++ core through the C# interop layer.
 *
 * When running in a plain browser (vite dev / CI) there is no host — this module
 * falls back to a lightweight in-memory preview so the UI remains renderable.
 */

let seq = 0
const pending = new Map()

/** true when running inside the WebView2 desktop host */
export const isDesktop = () => typeof window !== 'undefined' && !!window.chrome?.webview

export function postMessage(msg) {
  window.chrome.webview.postMessage(msg)
}

function initChannel() {
  if (!isDesktop() || window.__transfoChannelInit) return
  window.__transfoChannelInit = true
  window.chrome.webview.addEventListener('message', (e) => {
    const message = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    if (message?.type === 'result' || message?.type === 'error') {
      const p = pending.get(message.id)
      if (!p) return
      pending.delete(message.id)
      if (message.type === 'error') p.reject(new Error(message.error || 'host error'))
      else p.resolve(message.data)
    } else if (message?.type === 'event') {
      emit(message.name, message.data)
    }
  })
}

/** send a command to the host and await the response */
export function invoke(cmd, args = {}) {
  if (!isDesktop()) return mockInvoke(cmd, args)
  initChannel()
  const id = ++seq
  postMessage({ id, cmd, args })
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`host timeout: ${cmd}`))
      }
    }, 60000)
  })
}

/* ---------------- push events ---------------- */

const listeners = new Map()
export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set())
  listeners.get(name).add(fn)
  if (isDesktop()) initChannel()
  return () => listeners.get(name)?.delete(fn)
}
export function emit(name, data) {
  listeners.get(name)?.forEach((fn) => {
    try {
      fn(data)
    } catch {
      /* ignore listener errors */
    }
  })
}

/* ---------------- preview / mock mode ---------------- */

const mock = {
  devices: [
    { id: 'd1', name: 'ORVYN-DESKTOP', ip: '192.168.1.104', port: 4000, lastSeen: Date.now() - 1200 },
    { id: 'd2', name: 'Android Phone', ip: '192.168.1.23', port: 4000, lastSeen: Date.now() - 80000 },
  ],
  transfers: [],
}

function mkErr(msg) {
  return Promise.reject(new Error(msg))
}

function mockInvoke(cmd, args = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (cmd) {
        case 'ping':
          return resolve({ ok: true, data: { name: 'Transfo', version: '1.1.0', desktop: false } })
        case 'config.get':
          return resolve({
            ok: true,
            data: { deviceName: 'DESKTOP', serverUrl: 'http://192.168.1.104', port: 4000, downloadDir: '', discovery: true },
          })
        case 'config.set':
          return resolve({ ok: true, data: true })
        case 'runtime.init':
          return resolve({ ok: true })
        case 'runtime.shutdown':
          return resolve({ ok: true })
        case 'discovery.snapshot':
          return resolve({ ok: true, data: mock.devices })
        case 'discovery.start':
          return resolve({ ok: true, data: true })
        case 'discovery.stop':
          return resolve({ ok: true, data: true })
        case 'http': {
          try {
            const headers = {}
            if (args.json) headers['Content-Type'] = 'application/json'
            if (args.token) headers['Authorization'] = `Bearer ${args.token}`
            fetch(args.url, {
              method: args.method || 'GET',
              headers,
              body: args.json || undefined,
            })
              .then(async (res) => {
                const text = await res.text()
                resolve({ ok: true, data: { status: res.status, body: text } })
              })
              .catch((err) => {
                resolve({ ok: false, error: err.message, data: { status: 0, body: null } })
              })
          } catch (err) {
            resolve({ ok: false, error: err.message, data: { status: 0, body: null } })
          }
          return
        }
        case 'dialog.openFiles':
          return resolve({ ok: true, data: { paths: [] } })
        case 'dialog.openFolder':
          return resolve({ ok: true, data: { path: '' } })
        default:
          return mkErr(`host not available in preview mode: ${cmd}`)
      }
    }, 40)
  })
}