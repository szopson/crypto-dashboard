/**
 * Client-side share-image renderer for the /portfolio page — same approach as
 * the trade-review scorecard card (offscreen canvas, 1200x675 X-timeline PNG,
 * no dependencies, no server round-trip).
 *
 * Mirrors the page's privacy construction: percentages are shares of the
 * DISCLOSED sleeve only, moonshots appear solely as "sized privately", and
 * the not-investment-advice line is part of the image itself.
 */
import {
  PORTFOLIO_TIERS,
  PORTFOLIO_SNAPSHOT_DATE,
  DONUT_PALETTE,
  tierTotalPct,
} from "@/config/utility-portfolio";

const W = 1200;
const H = 675;
const SCALE = 2;

const BG = "#09090b";
const FG = "#fafafa";
const MUTED = "#a1a1aa";
const FAINT = "#3f3f46";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const ORANGE = "#f97316";
const RED = "#ef4444";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const LEGEND_TOP = 7;

export async function renderPortfolioImage(): Promise<Blob> {
  const publicTokens = PORTFOLIO_TIERS.filter((t) => !t.maskAllocations)
    .flatMap((t) => t.tokens)
    .sort((a, b) => b.allocationPct - a.allocationPct);
  const publicTotal = publicTokens.reduce((s, t) => s + t.allocationPct, 0);
  const pctOf = (v: number) => (v / publicTotal) * 100;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  ctx.scale(SCALE, SCALE);

  // Background + soft glows (amber/red — the portfolio page's accents)
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  let glow = ctx.createRadialGradient(1060, 60, 0, 1060, 60, 420);
  glow.addColorStop(0, "rgba(245,158,11,0.14)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(120, 640, 0, 120, 640, 380);
  glow.addColorStop(0, "rgba(239,68,68,0.10)");
  glow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header
  const brand = ctx.createLinearGradient(64, 0, 220, 0);
  brand.addColorStop(0, EMERALD);
  brand.addColorStop(1, "#34d399");
  ctx.fillStyle = brand;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText("Follio", 64, 84);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("Altcoin Utility Season Portfolio", W - 64, 84);
  ctx.textAlign = "left";

  // Donut (left)
  const cx = 300;
  const cy = 350;
  const r = 150;
  const ring = 46;
  let angle = -Math.PI / 2;
  const gap = 0.012 * Math.PI * 2;
  publicTokens.forEach((t, i) => {
    const frac = t.allocationPct / publicTotal;
    const sweep = frac * Math.PI * 2;
    // Gap must never exceed the segment itself: with end < start, canvas
    // arc() wraps a FULL circle and the last color paints over everything.
    const g = Math.min(gap / 2, sweep / 4);
    ctx.beginPath();
    ctx.strokeStyle = DONUT_PALETTE[i % DONUT_PALETTE.length];
    ctx.lineWidth = ring;
    ctx.arc(cx, cy, r, angle + g, angle + sweep - g);
    ctx.stroke();
    angle += sweep;
  });

  // Tier chips under the donut
  const tierChips = [
    ...PORTFOLIO_TIERS.filter((t) => !t.maskAllocations).map((t) => ({
      label: `${t.label} ${pctOf(tierTotalPct(t)).toFixed(1)}%`,
      color: t.id === "core" ? AMBER : ORANGE,
    })),
    { label: "Moonshots — sized privately", color: RED },
  ];
  ctx.font = `500 17px ${FONT}`;
  const chipWidths = tierChips.map(
    (c) => ctx.measureText(c.label).width + 18,
  );
  const chipsTotal = chipWidths.reduce((s, w) => s + w, 0) + (tierChips.length - 1) * 18;
  let chipX = cx - chipsTotal / 2 + 40;
  const chipY = cy + r + ring / 2 + 44;
  tierChips.forEach((chip, i) => {
    ctx.beginPath();
    ctx.fillStyle = chip.color;
    ctx.arc(chipX, chipY - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.fillText(chip.label, chipX + 12, chipY);
    chipX += chipWidths[i] + 18;
  });

  // Legend (right)
  const legendX = 640;
  let y = 165;
  ctx.font = `500 24px ${FONT}`;
  publicTokens.slice(0, LEGEND_TOP).forEach((t, i) => {
    ctx.beginPath();
    ctx.fillStyle = DONUT_PALETTE[i % DONUT_PALETTE.length];
    ctx.arc(legendX + 7, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FG;
    ctx.fillText(t.symbol, legendX + 28, y);
    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.fillText(`${pctOf(t.allocationPct).toFixed(1)}%`, W - 64, y);
    ctx.textAlign = "left";
    y += 46;
  });
  const othersPct = publicTokens
    .slice(LEGEND_TOP)
    .reduce((s, t) => s + pctOf(t.allocationPct), 0);
  ctx.beginPath();
  ctx.fillStyle = "#52525b";
  ctx.arc(legendX + 7, y - 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.fillText(`Others (${publicTokens.length - LEGEND_TOP})`, legendX + 28, y);
  ctx.textAlign = "right";
  ctx.fillText(`${othersPct.toFixed(1)}%`, W - 64, y);
  ctx.textAlign = "left";

  // Snapshot + themes note
  ctx.fillStyle = FAINT;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText(
    `Snapshot ${PORTFOLIO_SNAPSHOT_DATE} · zero memecoins`,
    legendX,
    y + 42,
  );

  // Footer: risk line + link
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 615);
  ctx.lineTo(W - 64, 615);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText("HIGH / EXTREME RISK", 64, 648);
  const riskW = ctx.measureText("HIGH / EXTREME RISK").width;
  ctx.fillStyle = MUTED;
  ctx.font = `400 19px ${FONT}`;
  ctx.fillText(" — transparency, not investment advice", 64 + riskW, 648);
  ctx.fillStyle = EMERALD;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("follio.io/portfolio", W - 64, 648);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    );
  });
}
