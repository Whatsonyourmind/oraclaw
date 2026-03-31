import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "OraClaw - Decision Intelligence as an API";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <span style={{ color: "#00cc66", fontSize: "64px", fontWeight: "bold" }}>
            &gt;_
          </span>
          <span style={{ color: "#ffffff", fontSize: "64px", fontWeight: "bold" }}>
            OraClaw
          </span>
        </div>

        <div
          style={{
            color: "#a0a0a0",
            fontSize: "28px",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
            marginBottom: "40px",
          }}
        >
          Decision Intelligence as an API
        </div>

        <div
          style={{
            display: "flex",
            gap: "40px",
            marginBottom: "40px",
          }}
        >
          {[
            { value: "19", label: "Algorithms" },
            { value: "<25ms", label: "Latency" },
            { value: "12", label: "MCP Tools" },
            { value: "14", label: "npm Packages" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px 24px",
                border: "1px solid #333",
                borderRadius: "8px",
                background: "rgba(0, 204, 102, 0.05)",
              }}
            >
              <span style={{ color: "#00cc66", fontSize: "36px", fontWeight: "bold" }}>
                {stat.value}
              </span>
              <span style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ color: "#555", fontSize: "16px" }}>
          web-olive-one-89.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
