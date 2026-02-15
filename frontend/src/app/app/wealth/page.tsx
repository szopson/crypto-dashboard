"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioOverview } from "@/components/wealth/PortfolioOverview";
import { HoldingsTable } from "@/components/wealth/HoldingsTable";
import { AllocationChart } from "@/components/wealth/AllocationChart";
import { AddHoldingDialog } from "@/components/wealth/AddHoldingDialog";
import { PortfolioChat } from "@/components/wealth/PortfolioChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WealthDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    portfolios,
    activePortfolio,
    holdings,
    summary,
    allocation,
    loading,
    error,
    lastUpdate,
    setActivePortfolio,
    createPortfolio,
    deletePortfolio,
    addHolding,
    deleteHolding,
    refresh,
  } = usePortfolio();

  // Modal states
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [creating, setCreating] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  // Show loading state
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Handle create portfolio
  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) return;

    setCreating(true);
    try {
      await createPortfolio({ name: newPortfolioName.trim() });
      setNewPortfolioName("");
      setShowCreatePortfolio(false);
    } catch (err) {
      console.error("Failed to create portfolio:", err);
    } finally {
      setCreating(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold hidden sm:block">
              Wealth Dashboard
            </h1>

            {/* Portfolio Selector */}
            {portfolios.length > 0 && (
              <Select
                value={activePortfolio?.id || ""}
                onValueChange={(id) => {
                  const portfolio = portfolios.find((p) => p.id === id);
                  if (portfolio) setActivePortfolio(portfolio);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* User email */}
            <span className="text-sm text-muted-foreground hidden md:block">
              {user?.email}
            </span>

            {/* Refresh button */}
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              {loading ? "..." : "Refresh"}
            </Button>

            <ThemeToggle />

            {/* Sign out */}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Error state */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="py-4">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No portfolios state */}
        {!loading && portfolios.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Welcome to Wealth Dashboard</h2>
              <p className="text-muted-foreground mb-6">
                Create your first portfolio to start tracking your investments.
              </p>
              <Button onClick={() => setShowCreatePortfolio(true)}>
                Create Portfolio
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Content */}
        {activePortfolio && (
          <>
            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowAddHolding(true)}>Add Holding</Button>
              <Button variant="outline" onClick={() => setShowCreatePortfolio(true)}>
                New Portfolio
              </Button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PortfolioOverview summary={summary} loading={loading} />
              </div>
              <div>
                <AllocationChart allocation={allocation} loading={loading} />
              </div>
            </div>

            {/* Holdings Table */}
            <HoldingsTable
              holdings={holdings}
              loading={loading}
              onDelete={deleteHolding}
            />

            {/* AI Portfolio Chat */}
            <PortfolioChat portfolioId={activePortfolio.id} />
          </>
        )}

        {/* Last Update */}
        {lastUpdate && (
          <p className="text-xs text-muted-foreground text-center">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </main>

      {/* Add Holding Dialog */}
      {activePortfolio && (
        <AddHoldingDialog
          open={showAddHolding}
          onClose={() => setShowAddHolding(false)}
          onSubmit={addHolding}
          portfolioId={activePortfolio.id}
        />
      )}

      {/* Create Portfolio Dialog */}
      <Dialog open={showCreatePortfolio} onOpenChange={setShowCreatePortfolio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-name">Portfolio Name</Label>
              <Input
                id="portfolio-name"
                placeholder="My Portfolio"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePortfolio();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreatePortfolio(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePortfolio} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
