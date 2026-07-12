"use client";

/**
 * User's region decision for affiliate CTA gating: "pending" until resolved,
 * then a RegionDecision. Callers must render NO affiliate links while pending
 * and pass the decision to rankExchangesForSymbol (fails closed on unknown).
 */
import { useEffect, useState } from "react";
import { resolveRegion, type RegionDecision } from "@/lib/region";

export type RegionState = RegionDecision | "pending";

export function useRegion(): RegionState {
  const [region, setRegion] = useState<RegionState>("pending");
  useEffect(() => {
    let active = true;
    resolveRegion().then((r) => {
      if (active) setRegion(r);
    });
    return () => {
      active = false;
    };
  }, []);
  return region;
}
