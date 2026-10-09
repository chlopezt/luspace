-- Additive only: preserve subscriptions, manual transfers and all family data.
CREATE TABLE billing_orders (
 id TEXT PRIMARY KEY,
 familia_id TEXT NOT NULL REFERENCES familias(id),
 environment TEXT NOT NULL CHECK(environment IN ('test','production')),
 external_reference TEXT NOT NULL UNIQUE,
 preference_id TEXT UNIQUE,
 checkout_url TEXT,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','refunded','charged_back','expired')),
 amount_clp INTEGER NOT NULL CHECK(amount_clp>0),
 expires_at TEXT NOT NULL,
 last_reconciled_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX billing_one_pending_order ON billing_orders(familia_id,environment) WHERE state='pending';
CREATE TABLE billing_order_payments (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL UNIQUE REFERENCES billing_orders(id),
 provider_payment_id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('approved','refunded','charged_back')),
 amount_clp INTEGER NOT NULL,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 provider_updated_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
