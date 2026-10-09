-- Additive billing foundation. Never activates or charges an existing family.
CREATE TABLE billing_subscriptions (
 id TEXT PRIMARY KEY,
 familia_id TEXT NOT NULL REFERENCES familias(id),
 environment TEXT NOT NULL CHECK(environment IN ('test','production')),
 external_reference TEXT NOT NULL UNIQUE,
 provider_id TEXT UNIQUE,
 checkout_url TEXT,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','authorized','paused','cancelled')),
 amount_clp INTEGER NOT NULL CHECK(amount_clp>0),
 currency TEXT NOT NULL DEFAULT 'CLP' CHECK(currency='CLP'),
 paid_until TEXT,
 provider_updated_at TEXT,
 last_reconciled_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX billing_one_open_subscription ON billing_subscriptions(familia_id,environment)
 WHERE state IN ('pending','authorized','paused');
CREATE TABLE billing_payments (
 id TEXT PRIMARY KEY,
 subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id),
 provider_payment_id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','cancelled','refunded','charged_back')),
 amount_clp INTEGER NOT NULL CHECK(amount_clp>=0),
 currency TEXT NOT NULL CHECK(currency='CLP'),
 period_start TEXT,
 period_end TEXT,
 provider_updated_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE billing_webhook_inbox (
 id TEXT PRIMARY KEY,
 environment TEXT NOT NULL CHECK(environment IN ('test','production')),
 topic TEXT NOT NULL CHECK(topic IN ('subscription_preapproval','subscription_authorized_payment','payment')),
 resource_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 signature_ts TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','processed','failed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 lease_until TEXT,
 received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(environment,topic,resource_id,request_id,signature_ts)
);
CREATE INDEX billing_webhook_pending ON billing_webhook_inbox(state,received_at);
CREATE INDEX billing_family_history ON billing_subscriptions(familia_id,created_at);
CREATE TABLE billing_job_status (
 id INTEGER PRIMARY KEY CHECK(id=1),
 lease_until TEXT,
 last_started_at TEXT,
 last_finished_at TEXT,
 failures INTEGER NOT NULL DEFAULT 0,
 processed INTEGER NOT NULL DEFAULT 0
);
INSERT INTO billing_job_status(id) VALUES(1);

