"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SymbolContextType {
  symbol: string;
  setSymbol: (symbol: string) => void;
  availableSymbols: string[];
  loading: boolean;
}

const SymbolContext = createContext<SymbolContextType | undefined>(undefined);

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbolState] = useState("BTC/USDT:USDT");
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available symbols from backend
    const fetchSymbols = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/symbols");
        if (response.ok) {
          const data = await response.json();
          setAvailableSymbols(data.symbols || []);
          // Use stored symbol or default
          const storedSymbol = localStorage.getItem("selectedSymbol");
          if (storedSymbol && data.symbols.includes(storedSymbol)) {
            setSymbolState(storedSymbol);
          } else {
            setSymbolState(data.default || "BTC/USDT:USDT");
          }
        }
      } catch (error) {
        console.error("Error fetching symbols:", error);
        setAvailableSymbols(["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT"]);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  const setSymbol = (newSymbol: string) => {
    setSymbolState(newSymbol);
    localStorage.setItem("selectedSymbol", newSymbol);
  };

  return (
    <SymbolContext.Provider value={{ symbol, setSymbol, availableSymbols, loading }}>
      {children}
    </SymbolContext.Provider>
  );
}

export function useSymbol() {
  const context = useContext(SymbolContext);
  if (context === undefined) {
    throw new Error("useSymbol must be used within a SymbolProvider");
  }
  return context;
}

// Helper to format symbol for display (e.g., "BTC/USDT:USDT" -> "BTC")
export function formatSymbolShort(symbol: string): string {
  return symbol.split("/")[0];
}

// Helper to format symbol for display (e.g., "BTC/USDT:USDT" -> "BTC/USDT")
export function formatSymbol(symbol: string): string {
  return symbol.replace(":USDT", "");
}
