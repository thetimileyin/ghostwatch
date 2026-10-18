/** GhostWatch mark: a pixel ghost with one orange eye, open and watching. Ink follows currentColor. */
export const GHOST_PATH = "M4 0H8V1H10V2H11V12H9V11H7V12H5V11H3V12H1V2H2V1H4Z M3 4V6H5V4Z";

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" fillRule="evenodd" d={GHOST_PATH} />
      <rect x="7" y="4" width="2" height="2" fill="var(--accent)" />
    </svg>
  );
}
