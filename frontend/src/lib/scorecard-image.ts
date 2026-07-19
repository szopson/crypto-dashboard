/**
 * Client-side share-image renderer for trade-review scorecards.
 *
 * Draws a 1200x675 (X/Twitter timeline 16:9) PNG on an offscreen canvas —
 * no server round-trip, no html2canvas dependency, no new /api route (which
 * would need a Traefik rule change to reach Next in prod).
 *
 * Content mirrors the product's compliance stance: the big number is DECISION
 * QUALITY, outcome is a separate small chip, and there is no directional
 * language — the whole shareable hook is "AI grades your decision, not your
 * PnL".
 */
import type { TradeScorecard } from "@/lib/trade-review";

const W = 1200;
const H = 675;
const SCALE = 2; // retina-crisp PNG

const BG = "#09090b";
const FG = "#fafafa";
const MUTED = "#a1a1aa";
const FAINT = "#3f3f46";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function scoreColor(score: number): string {
  if (score >= 75) return EMERALD;
  if (score >= 50) return AMBER;
  return RED;
}

function dimColor(score: number): string {
  if (score >= 4) return EMERALD;
  if (score >= 3) return AMBER;
  return RED;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wrap text to maxWidth; returns at most maxLines lines (last one ellipsised). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth) {
      line = attempt;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

export async function renderScorecardImage(
  scorecard: TradeScorecard,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  ctx.scale(SCALE, SCALE);

  // Background + soft brand glows (mirrors the app's glow-blob look)
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  let glow = ctx.createRadialGradient(1050, 40, 0, 1050, 40, 420);
  glow.addColorStop(0, "rgba(16,185,129,0.16)");
  glow.addColorStop(1, "rgba(16,185,129,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(120, 660, 0, 120, 660, 380);
  glow.addColorStop(0, "rgba(139,92,246,0.13)");
  glow.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header: brand + product name
  const brand = ctx.createLinearGradient(64, 0, 220, 0);
  brand.addColorStop(0, EMERALD);
  brand.addColorStop(1, "#34d399");
  ctx.fillStyle = brand;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText("Follio", 64, 84);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("AI Trade Review", W - 64, 84);
  ctx.textAlign = "left";

  // Left column — the big decision-quality score
  const color = scoreColor(scorecard.process_score);
  ctx.fillStyle = color;
  ctx.font = `700 150px ${FONT}`;
  const scoreText = String(scorecard.process_score);
  ctx.fillText(scoreText, 64, 300);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.fillStyle = FAINT;
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText("/100", 64 + scoreWidth + 12, 300);

  ctx.fillStyle = FG;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText("Decision quality", 64, 348);
  ctx.fillStyle = MUTED;
  ctx.font = `400 21px ${FONT}`;
  ctx.fillText("process, not outcome", 64, 378);

  // Trade line: symbol · direction · timeframe (the user's own past trade)
  const parts = [
    scorecard.detected_symbol,
    scorecard.detected_direction !== "unclear"
      ? scorecard.detected_direction.toUpperCase()
      : "",
    scorecard.detected_timeframe,
  ].filter(Boolean);
  if (parts.length > 0) {
    ctx.fillStyle = FG;
    ctx.font = `500 23px ${FONT}`;
    ctx.fillText(parts.join(" · "), 64, 424);
  }

  // Outcome chip — deliberately small and separate from the score
  const outcomeLabel: Record<TradeScorecard["outcome"], string> = {
    win: "Outcome: win",
    loss: "Outcome: loss",
    open: "Outcome: open",
    unclear: "Outcome: unclear",
  };
  const chipText = outcomeLabel[scorecard.outcome];
  ctx.font = `500 19px ${FONT}`;
  const chipW = ctx.measureText(chipText).width + 32;
  roundRect(ctx, 64, 448, chipW, 38, 19);
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.fillText(chipText, 80, 473);

  // Right column — dimension bars
  const dims = scorecard.dimensions.slice(0, 6);
  const colX = 620;
  const barW = 320;
  let y = 150;
  for (const dim of dims) {
    ctx.fillStyle = FG;
    ctx.font = `500 21px ${FONT}`;
    ctx.fillText(dim.label, colX, y);
    ctx.fillStyle = MUTED;
    ctx.font = `500 19px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${dim.score}/5`, W - 64, y);
    ctx.textAlign = "left";
    // track
    roundRect(ctx, colX, y + 12, W - 64 - colX, 8, 4);
    ctx.fillStyle = "#27272a";
    ctx.fill();
    // fill
    const frac = Math.max(0, Math.min(1, dim.score / 5));
    if (frac > 0) {
      roundRect(ctx, colX, y + 12, (W - 64 - colX) * frac, 8, 4);
      ctx.fillStyle = dimColor(dim.score);
      ctx.fill();
    }
    y += 56;
  }
  void barW;

  // Key lesson — the quotable takeaway
  if (scorecard.key_lesson) {
    ctx.font = `400 23px ${FONT}`;
    const lines = wrapText(ctx, `“${scorecard.key_lesson}”`, W - 128, 2);
    ctx.fillStyle = FG;
    let ly = 545;
    for (const line of lines) {
      ctx.fillText(line, 64, ly);
      ly += 32;
    }
  }

  // Footer
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 615);
  ctx.lineTo(W - 64, 615);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText("AI grades your decision, not your PnL", 64, 648);
  ctx.fillStyle = EMERALD;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("follio.io", W - 64, 648);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    );
  });
}
