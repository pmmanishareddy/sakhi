// The Sakhi mark: a full-length dressing mirror. Matches the app icon.
export function MirrorMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M16 36 L16 22 C16 15.4 19.6 11 24 11 C28.4 11 32 15.4 32 22 L32 36"
        stroke="#C88B6E"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line x1="12.5" y1="38.5" x2="35.5" y2="38.5" stroke="#C88B6E" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
