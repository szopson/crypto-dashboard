"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseClient();

      try {
        // Check for error in URL params
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error) {
          setStatus("error");
          setErrorMessage(errorDescription || error);
          return;
        }

        // Where to land after sign-in. Same-origin paths only ("/..." but not
        // "//...") to rule out open redirects; default: trader's workspace.
        const rawNext = params.get("next");
        const nextPath =
          rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
            ? rawNext
            : "/app";

        // Handle the OAuth callback
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          setStatus("success");
          // Redirect after short delay
          setTimeout(() => {
            router.push(nextPath);
          }, 1500);
        } else {
          // No session - might need to exchange code
          const code = params.get("code");
          if (code) {
            const { error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              throw exchangeError;
            }
            setStatus("success");
            setTimeout(() => {
              router.push(nextPath);
            }, 1500);
          } else {
            throw new Error("No session or code found");
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Authentication failed"
        );
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl p-8 shadow-lg text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Completing sign in...
              </h2>
              <p className="text-muted-foreground">
                Please wait while we verify your account.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Success!</h2>
              <p className="text-muted-foreground">
                Redirecting you to your dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Authentication Failed
              </h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <div className="space-y-2">
                <Link href="/auth/login">
                  <Button className="w-full">Try again</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Back to home
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
