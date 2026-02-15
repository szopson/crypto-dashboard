"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * PostHog Analytics Provider.
 *
 * Features:
 * - Automatic page view tracking
 * - Session recordings
 * - Heatmaps
 * - Feature flags support
 *
 * Events tracked automatically:
 * - $pageview - page navigation
 * - $pageleave - leaving page
 * - $autocapture - clicks, form submissions
 *
 * Manual events (use posthog.capture):
 * - waitlist_signup
 * - user_signup
 * - user_login
 * - portfolio_created
 * - holding_added
 * - ai_chat_sent
 * - report_generated
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com";

// Initialize PostHog only on client side and when key is provided
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Only create person profiles for identified users
    person_profiles: "identified_only",
    // Capture pageviews automatically
    capture_pageview: false, // We handle this manually for Next.js router
    capture_pageleave: true,
    // Session recordings
    disable_session_recording: false,
    // Respect Do Not Track
    respect_dnt: true,
    // Persist across sessions
    persistence: "localStorage+cookie",
    // Secure cookies
    secure_cookie: true,
    // Autocapture settings
    autocapture: {
      dom_event_allowlist: ["click", "submit"],
      element_allowlist: ["button", "a", "input", "form"],
      css_selector_allowlist: ["[data-ph-capture]"],
    },
  });
}

/**
 * Track page views on route changes.
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && POSTHOG_KEY) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url += `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  // Don't render provider if PostHog is not configured
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

/**
 * Helper functions for tracking custom events.
 * Import these where needed.
 */
export const analytics = {
  /**
   * Track waitlist signup
   */
  trackWaitlistSignup: (email: string, interest?: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("waitlist_signup", {
        email_domain: email.split("@")[1],
        interest,
      });
    }
  },

  /**
   * Track user signup
   */
  trackUserSignup: (userId: string, email?: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("user_signup", {
        user_id: userId,
        email_domain: email?.split("@")[1],
      });
    }
  },

  /**
   * Track user login
   */
  trackUserLogin: (userId: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("user_login", { user_id: userId });
    }
  },

  /**
   * Track portfolio creation
   */
  trackPortfolioCreated: (portfolioId: string, name: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("portfolio_created", {
        portfolio_id: portfolioId,
        name_length: name.length,
      });
    }
  },

  /**
   * Track holding added
   */
  trackHoldingAdded: (assetClass: string, ticker: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("holding_added", {
        asset_class: assetClass,
        ticker,
      });
    }
  },

  /**
   * Track AI chat message
   */
  trackAIChatSent: (messageLength: number) => {
    if (POSTHOG_KEY) {
      posthog.capture("ai_chat_sent", {
        message_length: messageLength,
      });
    }
  },

  /**
   * Track report generated
   */
  trackReportGenerated: (tokenSymbol: string) => {
    if (POSTHOG_KEY) {
      posthog.capture("report_generated", {
        token_symbol: tokenSymbol,
      });
    }
  },

  /**
   * Identify user after login
   */
  identify: (userId: string, traits?: Record<string, unknown>) => {
    if (POSTHOG_KEY) {
      posthog.identify(userId, traits);
    }
  },

  /**
   * Reset user identity on logout
   */
  reset: () => {
    if (POSTHOG_KEY) {
      posthog.reset();
    }
  },
};

export default PostHogProvider;
