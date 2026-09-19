const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z',
  send: 'm3 11 18-8-8 18-2.5-7.5L3 11z',
  receive: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
  devices: 'M7 3h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10 15h-3a3 3 0 0 0-3 3v1h18v-1a3 3 0 0 0-3-3h-3M12 13v5',
  transfer: 'M4 7h11v10H4zM15 10h4v4h-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  close: 'M6 6l12 12M18 6 6 18',
  network: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.6 9h16.8M3.6 15h16.8M12 21c-2.5-2-4-4.5-4-9s1.5-7 4-9c2.5 2 4 4.5 4 9s-1.5 7-4 9z',
  check: 'M5 13l4 4L19 7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
  x: 'M6 6l12 12M18 6 6 18',
  refresh: 'M20 11a8 8 0 1 0-1.5 6M20 5v6h-6',
  copy: 'M8 8h11v11H8zM16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3',
  logout: 'M15 12H3m0 0 4-4m-4 4 4 4M11 3h7a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-7',
  info: 'M12 11v5M12 8h.01',
  down: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
  up: 'M12 21V9m0 0 4 4m-4-4-4 4M4 3h16',
  warn: 'M12 3 2.5 20h19L12 3zM12 9v5M12 16.5h.01',
  key: 'M15 3a6 6 0 0 0-5.5 8.3L4 17v3h3l2-2 2 2h2l1.4-1.4a6 6 0 1 0-.4-11.6zM14 9h.01',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
}

export function Icon({ name, size = 16, strokeWidth = 1.6, className = '' }) {
  const d = paths[name] || paths.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

// oxlint-disable-next-line react/only-export-components
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

export function Progress({ value = 0, className = '', barClassName = '' }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`h-[5px] rounded-full bg-surface-2 overflow-hidden border border-border ${className}`}>
      <div
        className={`h-full rounded-full bg-accent transition-[width] duration-150 ease-linear ${barClassName}`}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  )
}

export function StatusDot({ tone = 'muted', pulse = false }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${tone === 'accent' ? 'bg-accent' : tone === 'ok' ? 'bg-[#9db8a8]' : tone === 'bad' ? 'bg-[#c2716b]' : 'bg-faint'} ${pulse ? 'tf-pulse-dot' : ''}`} />
  )
}

export function Chip({ children, tone = 'default' }) {
  const tones = {
    default: 'border-border text-faint bg-surface',
    accent: 'border-accent/40 text-accent bg-accent-soft',
    ok: 'border-[#9db8a8]/30 text-[#9db8a8] bg-[#9db8a8]/[0.07]',
    bad: 'border-[#c2716b]/30 text-[#c2716b] bg-[#c2716b]/[0.07]',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Btn({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-accent text-on-accent hover:brightness-110 font-semibold',
    secondary:
      'border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2',
    ghost: 'text-muted hover:text-text hover:bg-surface',
    danger: 'border border-[#c2716b]/40 text-[#c2716b] hover:bg-[#c2716b]/[0.08]',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] transition-[filter,color,background-color,border-color] disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    />
  )
}