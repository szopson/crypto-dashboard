import { AppAuthGate } from "@/components/AppAuthGate";

// Client-side auth gate for the /app tree — second layer behind the edge
// middleware (defense-in-depth + flash-of-content guard when the middleware
// is bypassed, e.g. client-side navigation after a session expires).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppAuthGate>{children}</AppAuthGate>;
}
