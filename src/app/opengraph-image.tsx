import { ImageResponse } from "next/og";
import { PRODUCT_NAME } from "@/lib/brand";

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
          background: "#0b0c0e",
          color: "#f2f1ee",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#12141a",
              color: "#eb6505",
              border: "1px solid #eb6505",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            GC
          </div>
          <div style={{ fontSize: 32 }}>{PRODUCT_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 68, lineHeight: 1.05, maxWidth: 900 }}>
            Social calls vs Monday&apos;s tape.
          </div>
          <div style={{ fontSize: 28, color: "#9a9aa3" }}>
            GC Scale in neon. 0% is an empty glass.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
