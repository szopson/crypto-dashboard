import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Follio - Professional Crypto Analysis Tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #050505 0%, #0a1a15 50%, #050505 100%)",
          position: "relative",
        }}
      >
        {/* Gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "200px",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "200px",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "40px",
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              marginBottom: "30px",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 12L19 12" />
              <path d="M12 2a10 10 0 0 1 0 20" strokeDasharray="4 4" />
            </svg>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              color: "white",
              margin: "0 0 20px 0",
              letterSpacing: "-2px",
            }}
          >
            Follio
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "28px",
              color: "#a1a1aa",
              margin: "0 0 40px 0",
              maxWidth: "800px",
            }}
          >
            Professional crypto analysis tools, AI-powered reports, and smart alerts
          </p>

          {/* Features row */}
          <div
            style={{
              display: "flex",
              gap: "30px",
              marginTop: "20px",
            }}
          >
            {["RADAR Analysis", "AI Reports", "Smart Alerts", "SNIPER Setups"].map(
              (feature) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 20px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "100px",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <span style={{ color: "#e4e4e7", fontSize: "18px" }}>{feature}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
