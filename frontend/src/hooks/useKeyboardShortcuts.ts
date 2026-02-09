"use client";

import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  description: string;
}

const shortcuts: Shortcut[] = [];

export function useKeyboardShortcuts(
  customShortcuts: Omit<Shortcut, "description">[] = []
) {
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

      const allShortcuts = [...shortcuts, ...customShortcuts];

      for (const shortcut of allShortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [customShortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Hook for tab navigation shortcuts
export function useTabShortcuts(
  setActiveTab: (tab: string) => void,
  tabs: string[]
) {
  const shortcuts = tabs.map((tab, index) => ({
    key: String(index + 1),
    alt: true,
    handler: () => setActiveTab(tab),
  }));

  useKeyboardShortcuts(shortcuts);
}

// Predefined shortcut descriptions for help modal
export const SHORTCUT_DESCRIPTIONS = [
  { keys: ["Alt", "1-8"], description: "Switch between tabs" },
  { keys: ["Alt", "R"], description: "Refresh market data" },
  { keys: ["Alt", "S"], description: "Focus symbol selector" },
  { keys: ["Esc"], description: "Close dialogs/modals" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];
