"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetClass, HoldingCreate } from "@/lib/wealth-types";

interface AddHoldingDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: HoldingCreate) => Promise<void>;
  portfolioId: string;
}

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "crypto", label: "Cryptocurrency" },
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "bond", label: "Bond" },
  { value: "real_estate", label: "Real Estate" },
  { value: "cash", label: "Cash" },
  { value: "commodity", label: "Commodity" },
];

export function AddHoldingDialog({
  open,
  onClose,
  onSubmit,
  portfolioId,
}: AddHoldingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [assetClass, setAssetClass] = useState<AssetClass>("crypto");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  const resetForm = () => {
    setAssetClass("crypto");
    setTicker("");
    setName("");
    setQuantity("");
    setCostBasis("");
    setManualPrice("");
    setPurchaseDate("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!ticker.trim()) {
      setError("Ticker is required");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    const data: HoldingCreate = {
      portfolio_id: portfolioId,
      asset_class: assetClass,
      ticker: ticker.trim().toUpperCase(),
      name: name.trim(),
      quantity: parseFloat(quantity),
      cost_basis: costBasis ? parseFloat(costBasis) : undefined,
      manual_price: manualPrice ? parseFloat(manualPrice) : undefined,
      purchase_date: purchaseDate || undefined,
    };

    setLoading(true);
    try {
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holding");
    } finally {
      setLoading(false);
    }
  };

  const needsManualPrice = ["real_estate", "bond", "cash"].includes(assetClass);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Holding</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Class */}
          <div className="space-y-2">
            <Label htmlFor="asset-class">Asset Type</Label>
            <Select
              value={assetClass}
              onValueChange={(v) => setAssetClass(v as AssetClass)}
            >
              <SelectTrigger id="asset-class">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((ac) => (
                  <SelectItem key={ac.value} value={ac.value}>
                    {ac.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ticker & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker / Symbol</Label>
              <Input
                id="ticker"
                placeholder={
                  assetClass === "crypto"
                    ? "BTC"
                    : assetClass === "real_estate"
                    ? "APT-1"
                    : "AAPL"
                }
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder={
                  assetClass === "crypto"
                    ? "Bitcoin"
                    : assetClass === "real_estate"
                    ? "Warsaw Apartment"
                    : "Apple Inc."
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              placeholder={assetClass === "crypto" ? "0.5" : "100"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Cost Basis */}
          <div className="space-y-2">
            <Label htmlFor="cost-basis">
              Cost Basis (per unit) <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="cost-basis"
              type="number"
              step="0.01"
              min="0"
              placeholder="45000.00"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used to calculate profit/loss
            </p>
          </div>

          {/* Manual Price (for assets without automatic pricing) */}
          {needsManualPrice && (
            <div className="space-y-2">
              <Label htmlFor="manual-price">
                Current Price (per unit)
              </Label>
              <Input
                id="manual-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="150000.00"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This asset type requires manual price input
              </p>
            </div>
          )}

          {/* Purchase Date */}
          <div className="space-y-2">
            <Label htmlFor="purchase-date">
              Purchase Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Holding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddHoldingDialog;
