"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const SHORTCUTS = [
  { keys: ["Alt", "1"], description: "Dashboard tab" },
  { keys: ["Alt", "2"], description: "SNIPER tab" },
  { keys: ["Alt", "3"], description: "Journal tab" },
  { keys: ["Alt", "4"], description: "Copilot tab" },
  { keys: ["Alt", "5"], description: "Research tab" },
  { keys: ["Alt", "6"], description: "Chart tab" },
  { keys: ["Alt", "7"], description: "Backtest tab" },
  { keys: ["Alt", "8"], description: "Alerts tab" },
  { keys: ["Alt", "R"], description: "Refresh market data" },
  { keys: ["Esc"], description: "Close dialogs" },
  { keys: ["?"], description: "Show this help" },
];

interface KeyboardShortcutsProps {
  onRefresh?: () => void;
  onTabChange?: (tab: string) => void;
}

export function KeyboardShortcuts({ onRefresh, onTabChange }: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Show help with ?
      if (event.key === "?" && !event.altKey && !event.ctrlKey) {
        event.preventDefault();
        setShowHelp(true);
        return;
      }

      // Close with Escape
      if (event.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // Alt + number for tabs
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        const tabs = ["dashboard", "sniper", "journal", "copilot", "research", "chart", "backtest", "alerts"];
        const num = parseInt(event.key);

        if (num >= 1 && num <= 8) {
          event.preventDefault();
          onTabChange?.(tabs[num - 1]);
          return;
        }

        // Alt + R for refresh
        if (event.key.toLowerCase() === "r") {
          event.preventDefault();
          onRefresh?.();
          return;
        }
      }
    },
    [onRefresh, onTabChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <Badge
                    key={keyIndex}
                    variant="outline"
                    className="font-mono text-xs px-2"
                  >
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Press <Badge variant="outline" className="font-mono text-xs px-1">?</Badge> anytime to show this help
        </p>
      </DialogContent>
    </Dialog>
  );
}
