"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FloatingActionsProps {
  onRefresh: () => void;
  onTabChange: (tab: string) => void;
}

export function FloatingActions({ onRefresh, onTabChange }: FloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: "Dashboard", icon: "H", action: () => onTabChange("dashboard") },
    { label: "SNIPER", icon: "S", action: () => onTabChange("sniper") },
    { label: "Copilot", icon: "C", action: () => onTabChange("copilot") },
    { label: "Refresh", icon: "R", action: onRefresh },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 lg:hidden">
      {/* Action buttons */}
      <div
        className={`flex flex-col-reverse gap-2 mb-2 transition-all duration-200 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {actions.map((action, idx) => (
          <Button
            key={idx}
            variant="secondary"
            size="icon"
            className="w-12 h-12 rounded-full shadow-lg"
            onClick={() => {
              action.action();
              setIsOpen(false);
            }}
          >
            <span className="text-sm font-medium">{action.icon}</span>
          </Button>
        ))}
      </div>

      {/* Main FAB button */}
      <Button
        variant="default"
        size="icon"
        className={`w-14 h-14 rounded-full shadow-lg transition-transform duration-200 ${
          isOpen ? "rotate-45" : ""
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Button>
    </div>
  );
}
