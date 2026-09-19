import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import * as bridge from './bridge'

const initialConfig = {
  deviceName: 'MY-PC',
  serverUrl: 'http://localhost',
  port: 4000,
  downloadDir: '',
  discovery: true,
}

const initialState = {
  config: initialConfig,
  ready: false,
  host: null,
  paired: false,
  token: localStorage.getItem('transfo.token') || '',
  devices: [],
  discovering: false,
  transfers: {}, // handle -> TransferState
  history: JSON.parse(localStorage.getItem('transfo.history') || '[]'),
}

function reducer(state, action) {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.payload }
    case 'config':
      return { ...state, config: { ...state.config, ...action.payload }, ready: true }
    case 'device':
      return { ...state, devices: action.payload }
    case 'paired':
      if (action.token) localStorage.setItem('transfo.token', action.token)
      else localStorage.removeItem('transfo.token')
      return { ...state, paired: action.paired, token: action.token || '' }
    case 'transfer:upsert': {
      const t = action.transfer
      const transfers = { ...state.transfers, [t.handle]: { ...state.transfers[t.handle], ...t } }
      return { ...state, transfers }
    }
    case 'transfer:remove':
      const cur = { ...state.transfers }
      delete cur[action.handle]
      return { ...state, transfers: cur }
    case 'history':
      localStorage.setItem('transfo.history', JSON.stringify(action.payload))
      return { ...state, history: action.payload }
    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const action = useMemo(
    () => ({
      dispatch,
      setConfig: (patch) => dispatch({ type: 'config', payload: patch }),
      setPaired: (paired, token = '') => dispatch({ type: 'paired', paired, token }),
      setDevices: (devices) => dispatch({ type: 'device', payload: devices }),
      upsertTransfer(transfer) {
        dispatch({ type: 'transfer:upsert', transfer })
      },
      removeTransfer(handle) {
        dispatch({ type: 'transfer:remove', handle })
      },
      pushHistory(entry) {
        const next = [entry, ...state.history].slice(0, 200)
        dispatch({ type: 'history', payload: next })
      },
    }),
    [state.history],
  )

  /* wire bridge push events */
  useEffect(() => {
    const offA = bridge.on('discovery:update', (data) => {
      dispatch({ type: 'device', payload: data?.devices || [] })
    })
    const offB = bridge.on('transfer:update', (u) => {
      if (!u) return
      const phaseMap = { 0: 'started', 1: 'progress', 2: 'done', 3: 'canceled', 4: 'failed' }
      const phase = phaseMap[u.phase] || 'progress'
      action.upsertTransfer({
        handle: u.handle,
        phase,
        fileName: u.fileName,
        sessionId: u.sessionId,
        transferred: u.transferred,
        total: u.total,
        error: u.error,
        updatedAt: Date.now(),
      })
      if (phase === 'done' || phase === 'failed' || phase === 'canceled') {
        action.pushHistory({
          fileName: u.fileName,
          dir: u.dir || state.transfers[u.handle]?.dir || 'send',
          phase,
          total: u.total,
          transferred: u.transferred,
          error: u.error,
          at: new Date().toISOString(),
        })
      }
    })
    return () => {
      offA()
      offB()
    }
  }, [action, state.transfers])

  const value = useMemo(
    () => ({
      state,
      action,
      bridge,
      boot() {
        if (state.ready) return
        Promise.all([bridge.invoke('ping'), bridge.invoke('config.get'), bridge.invoke('runtime.init')])
          .then(([ping, cfg]) => {
            dispatch({
              type: 'set',
              payload: { ready: true, host: ping?.data || null },
            })
            action.setConfig(cfg?.data || {})
          })
          .catch(() => dispatch({ type: 'set', payload: { ready: true } }))
      },
    }),
    [state, action],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}