/**
 * Transfo download configuration.
 * Update version strings and URLs here - all download buttons read from this file.
 * `size` must match the actual file on disk (bytes).
 */
export const downloads = {
  windows: {
    version: "1.1.0",
    label: "Windows 10 / 11",
    filename: "Transfo-Setup.exe",
    url: "https://github.com/bigem-hub/transfoo/releases/download/v1.1.0/Transfo-Setup.exe",
    size: "47 MB",
  },
  android: {
    version: "1.1.0",
    label: "Android 8.0+",
    filename: "Transfo.apk",
    url: "https://github.com/bigem-hub/transfoo/releases/download/v1.1.0/Transfo.apk",
    size: "17 MB",
  },
}

/**
 * Central download handler.
 * Provides robust fallback across desktop and mobile browsers.
 */
export function handleDownload(platform) {
  const config = downloads[platform]
  if (!config || !config.url) return

  try {
    const link = document.createElement("a")
    link.href = config.url
    link.setAttribute("download", config.filename)
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch {
    window.location.href = config.url
  }
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ""
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB"
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB"
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB"
  return bytes + " B"
}