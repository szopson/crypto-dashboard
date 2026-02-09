"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useSymbol, formatSymbol } from "@/contexts/SymbolContext";
import type { PriceData } from "@/lib/types";

interface PriceDisplayProps {
  price: PriceData;
}

export function PriceDisplay({ price }: PriceDisplayProps) {
  const { symbol } = useSymbol();
  const isPositive = (price.change_24h ?? 0) >= 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{formatSymbol(symbol)}</p>
            <p className="text-3xl font-bold">
              ${price.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-lg font-semibold ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? "+" : ""}
              {price.change_24h?.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">24h Change</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">24h High</p>
            <p className="font-medium">
              ${price.high_24h?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">24h Low</p>
            <p className="font-medium">
              ${price.low_24h?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">24h Volume</p>
            <p className="font-medium">
              ${(price.volume_24h ? price.volume_24h / 1e9 : 0).toFixed(2)}B
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
