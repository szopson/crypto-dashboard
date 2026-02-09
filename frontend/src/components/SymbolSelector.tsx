"use client";

import { useSymbol, formatSymbolShort } from "@/contexts/SymbolContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SymbolSelector() {
  const { symbol, setSymbol, availableSymbols, loading } = useSymbol();

  if (loading) {
    return (
      <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
    );
  }

  return (
    <Select value={symbol} onValueChange={setSymbol}>
      <SelectTrigger className="w-[100px] sm:w-[130px] h-9">
        <SelectValue>
          {formatSymbolShort(symbol)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableSymbols.map((sym) => (
          <SelectItem key={sym} value={sym}>
            <span className="font-medium">{formatSymbolShort(sym)}</span>
            <span className="text-muted-foreground text-xs ml-1">/USDT</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
