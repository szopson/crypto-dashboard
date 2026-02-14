-- Price Cache Table for Wealth Dashboard
-- Run this in Supabase SQL Editor

-- Create price_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS price_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_class TEXT NOT NULL,
    ticker TEXT NOT NULL,
    price_usd DECIMAL(20, 8) NOT NULL,
    change_24h_pct DECIMAL(10, 4),
    market_cap DECIMAL(30, 2),
    volume_24h DECIMAL(30, 2),
    source TEXT DEFAULT 'unknown',
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_class, ticker)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_cache_lookup
ON price_cache(asset_class, ticker);

-- No RLS needed - price cache is shared data
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read prices
CREATE POLICY IF NOT EXISTS "Anyone can read price cache"
    ON price_cache FOR SELECT
    USING (true);

-- Only service role can write prices
CREATE POLICY IF NOT EXISTS "Service role can manage price cache"
    ON price_cache FOR ALL
    USING (auth.role() = 'service_role');
