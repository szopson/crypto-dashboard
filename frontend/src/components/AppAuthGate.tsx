"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// /app/trade-review handles its own auth states: its logged-out view (blurred
// demo + Google CTA) is a conversion surface and must render for anonymous
// visitors. Must match the exemption in src/middleware.ts.
const isExempt = (pathname: string) => pathname.startsWith("/app/trade-review");

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const exempt = isExempt(pathname);

  useEffect(() => {
    if (!exempt && !loading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [exempt, loading, user, pathname, router]);

  if (exempt) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
