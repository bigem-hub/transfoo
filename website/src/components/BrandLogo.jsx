export default function BrandLogo({ size = 28, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="10"
        fill="#101012"
        stroke="#232326"
      />
      {/* phone */}
      <rect x="7" y="12.5" width="10" height="17" rx="2" stroke="#e3a35e" strokeWidth="1.6" />
      <line x1="9.5" y1="27" x2="14.5" y2="27" stroke="#e3a35e" strokeWidth="1.2" />
      {/* monitor */}
      <rect x="23" y="10.5" width="11.5" height="8.5" rx="1.4" stroke="#cfd0d4" strokeWidth="1.6" />
      <line x1="26" y1="23.5" x2="31.5" y2="23.5" stroke="#cfd0d4" strokeWidth="1.6" />
      <line x1="28.75" y1="23.5" x2="28.75" y2="26.5" stroke="#cfd0d4" strokeWidth="1.4" />
      <line x1="26.5" y1="26.5" x2="31" y2="26.5" stroke="#cfd0d4" strokeWidth="1.4" />
      {/* transfer arrow */}
      <path d="M18 15.5h3M19.2 13.9l2.1 1.6-2.1 1.6" stroke="#e3a35e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}