-- Postgres schema for Notascam
-- Source of truth on-chain; DB is index/cache/analytics.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  handle TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  trader_id INTEGER NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  subscriber_wallet TEXT NOT NULL,
  onchain_object_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ,
  tx_digest TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trader_id, subscriber_wallet, onchain_object_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_trader ON subscriptions(trader_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet ON subscriptions(subscriber_wallet);

CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  trader_id INTEGER NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  walrus_uri TEXT NOT NULL,
  sui_object_id TEXT NOT NULL,
  tx_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signals_trader ON signals(trader_id);

CREATE TABLE IF NOT EXISTS signal_events (
  id SERIAL PRIMARY KEY,
  signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  tx_digest TEXT NOT NULL,
  emitted_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trader_stats (
  trader_id INTEGER PRIMARY KEY REFERENCES traders(id) ON DELETE CASCADE,
  pnl_30d NUMERIC,
  winrate NUMERIC,
  subs_count INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);
