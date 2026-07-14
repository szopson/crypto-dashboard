/**
 * POST /api/trade-review
 *
 * Accepts a trade screenshot (base64) + optional notes, returns a decision-quality
 * scorecard. See src/lib/trade-review.ts for the analysis logic and the hard rules
 * (no signals; grade process, not outcome).
 *
 * The image and the ANTHROPIC_API_KEY never round-trip through the client bundle.
 */
import { NextRequest, NextResponse } from "next/server";
import { reviewTrade, type SupportedMedia } from "@/lib/trade-review";

// Vision + reasoning on Opus 4.8 can take a while — give it room.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ALLOWED: SupportedMedia[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

// ~8MB of base64 ≈ 6MB image; well within Claude's per-image limits.
const MAX_BASE64_LEN = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let body: { image_base64?: string; media_type?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { image_base64, media_type, notes } = body;

  if (!image_base64 || typeof image_base64 !== "string") {
    return NextResponse.json(
      { error: "Missing image (image_base64)." },
      { status: 400 },
    );
  }
  if (image_base64.length > MAX_BASE64_LEN) {
    return NextResponse.json(
      { error: "Image is too large (max ~6MB)." },
      { status: 413 },
    );
  }
  if (!ALLOWED.includes(media_type as SupportedMedia)) {
    return NextResponse.json(
      { error: "Unsupported format. Use PNG, JPEG, GIF or WebP." },
      { status: 400 },
    );
  }
  if (notes != null && (typeof notes !== "string" || notes.length > 2000)) {
    return NextResponse.json(
      { error: "Note is too long (max 2000 characters)." },
      { status: 400 },
    );
  }

  try {
    const result = await reviewTrade({
      imageBase64: image_base64,
      mediaType: media_type as SupportedMedia,
      notes: notes?.trim() || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed.";
    // Missing key / config issues shouldn't leak details to the client.
    const isConfig = message.includes("ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: isConfig ? "Analysis is temporarily unavailable." : message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
