-- Club Treasurer initial schema. Times are ISO-8601 UTC strings.

CREATE TABLE clubs (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	invite_code TEXT NOT NULL UNIQUE, -- normalized: 12 chars, no hyphens
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE members (
	id TEXT PRIMARY KEY,
	club_id TEXT NOT NULL REFERENCES clubs(id),
	name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('treasurer', 'member')),
	token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hex of the bearer token
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX members_club ON members(club_id);

-- Server-issued agent conversations. Only registered ids reach the agent.
CREATE TABLE conversations (
	id TEXT PRIMARY KEY, -- `${clubId}--${uuid}`
	club_id TEXT NOT NULL REFERENCES clubs(id),
	created_by TEXT NOT NULL REFERENCES members(id),
	used INTEGER NOT NULL DEFAULT 0, -- 1 after the single allowed message POST
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX conversations_club ON conversations(club_id);

CREATE TABLE entries (
	id TEXT PRIMARY KEY,
	club_id TEXT NOT NULL REFERENCES clubs(id),
	idempotency_key TEXT NOT NULL,
	date TEXT NOT NULL, -- YYYY-MM-DD
	merchant TEXT NOT NULL,
	amount INTEGER NOT NULL, -- KRW
	category TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	memo TEXT NOT NULL DEFAULT '',
	saved_by TEXT NOT NULL REFERENCES members(id),
	conversation_id TEXT REFERENCES conversations(id),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (club_id, idempotency_key)
);
CREATE INDEX entries_club_date ON entries(club_id, date);

-- Daily counters. scope: 'global' | <club_id> | 'ip:<sha256>' | 'join-ip:<sha256>'
CREATE TABLE usage_daily (
	day TEXT NOT NULL, -- YYYY-MM-DD, KST
	scope TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, scope)
);
