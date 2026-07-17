"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { getSupabaseClient, User, Session, AuthChangeEvent } from "@/lib/supabase";
import { analytics } from "@/components/PostHogProvider";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Error getting session:", sessionError);
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      // PostHog user identification
      if (event === "SIGNED_IN" && newSession?.user) {
        analytics.identify(newSession.user.id, {
          email: newSession.user.email,
          created_at: newSession.user.created_at,
        });
        analytics.trackUserLogin(newSession.user.id);
      } else if (event === "SIGNED_OUT") {
        analytics.reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Sign in with email/password
  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);

      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to sign in";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase.auth]
  );

  // Sign up with email/password
  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      setError(null);
      setLoading(true);

      try {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to sign up";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase.auth]
  );

  // Sign in with Google OAuth. `next` is a same-origin path to return to
  // after the callback (e.g. "/cockpit"); defaults to the trader's workspace.
  const signInWithGoogle = useCallback(async (next?: string) => {
    setError(null);

    try {
      const nextParam =
        next && next.startsWith("/") && !next.startsWith("//")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${nextParam}`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in with Google";
      setError(message);
      throw err;
    }
  }, [supabase.auth]);

  // Sign out
  const signOut = useCallback(async () => {
    setError(null);

    try {
      // Reset PostHog before signing out
      analytics.reset();

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setUser(null);
      setSession(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
      throw err;
    }
  }, [supabase.auth]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Helper to get the access token for API calls.
 * Returns null if not authenticated.
 */
export function useAccessToken(): string | null {
  const { session } = useAuth();
  return session?.access_token ?? null;
}
