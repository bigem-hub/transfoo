import { useEffect } from 'react'
import * as bridge from './bridge'
import { useStore } from './store'

export function ReactStore() {
  return useStore()
}

export function baseUrl(config) {
  if (!config?.serverUrl) return 'http://localhost:4000'
  let url = config.serverUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes('.') && !url.includes(':') && !/^\d+\.\d+\.\d+\.\d+$/.test(url)) {
      url = 'https://' + url
    } else {
      url = 'http://' + url
    }
  }
  try {
    const parsed = new URL(url)
    // If URL already has a port, don't append config.port
    if (parsed.port) return url
    // For HTTPS, don't append port unless explicitly configured to non-standard port
    if (parsed.protocol === 'https:') {
      if (config.port && config.port !== 443 && config.port !== 4000) {
        return `${url}:${config.port}`
      }
      return url
    }
    // For HTTP, append port if configured and not standard HTTP port
    if (config.port && config.port !== 80) {
      return `${url}:${config.port}`
    }
    return url
  } catch {
    return url
  }
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