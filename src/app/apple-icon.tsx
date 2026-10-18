import { ImageResponse } from "next/og";

// Home-screen icon: the pixel ghost on near-black, one orange eye.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0c" }}>
        <svg width="112" height="112" viewBox="0 0 12 12" shapeRendering="crispEdges">
          <path fill="#ecebe7" fillRule="evenodd" d="M4 0H8V1H10V2H11V12H9V11H7V12H5V11H3V12H1V2H2V1H4Z M3 4V6H5V4Z" />
          <rect x="7" y="4" width="2" height="2" fill="#f7931a" />
        </svg>
      </div>
    ),
    size,
  );
}
