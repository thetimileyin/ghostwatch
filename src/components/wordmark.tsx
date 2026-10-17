/** GhostWatch glyph: an aperture ring, a sweep arc, and a waking point (the one orange mark). */
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5" />
      <path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="10" height="10" stroke="currentColor" strokeWidth="1.5" />
      <rect x="23" y="5.4" width="3.6" height="3.6" fill="var(--accent)" />
    </svg>
  );
}
