import { ImageResponse } from "next/og";
import { MARK, PRODUCT_NAME } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#eef3ec",
          color: "#14211b",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#14352b",
              color: "#dff56a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {MARK}
          </div>
          <div style={{ fontSize: 32 }}>{PRODUCT_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 68, lineHeight: 1.05, maxWidth: 900 }}>
            The weekend call, graded in public.
          </div>
          <div style={{ fontSize: 28, color: "#5c6b62" }}>
            One cohort. Monday, Wednesday, and Friday at noon ET.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
