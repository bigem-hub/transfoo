import { useEffect } from 'react'
import * as bridge from './bridge'
import { useStore } from './store'

export function ReactStore() {
  return useStore()
}

export function baseUrl(config) {
  const clean = (config?.serverUrl || '').replace(/\/+$/, '')
  return clean && config?.port && config.port !== 80 ? `${clean}:${config.port}` : clean || 'http://localhost:4000'
}

/** boot the runtime + config exactly once */
export function useBoot() {
  const store = useStore()
  const { boot } = store

  useEffect(() => {
    boot()
  }, [boot])

  return store
}

/** authenticated HTTP against the Transfo server through the native core */
export async function serverHttp(method, path, token, json, config) {
  const url = baseUrl(config) + path
  const res = await bridge.invoke('http', { method, url, token, json })
  let body = null
  if (res?.body) {
    try {
      body = JSON.parse(res.body)
    } catch {
      body = res.body
    }
  }
  return { status: res?.status ?? -1, body }
}