"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        setRegistration(reg);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Check for existing waiting worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }

        console.log("[PWA] Service Worker registered");
      } catch (error) {
        console.error("[PWA] Service Worker registration failed:", error);
      }
    };

    registerSW();

    // Listen for controller change
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50">
      <div className="bg-card border rounded-lg shadow-lg p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-medium text-sm">Update available</p>
          <p className="text-xs text-muted-foreground">New version ready to install</p>
        </div>
        <Button size="sm" onClick={handleUpdate}>
          Update
        </Button>
      </div>
    </div>
  );
}
