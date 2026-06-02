-- Push notification device tokens
-- Used for future APNs server push (local notifications work without this)

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  favorite_cafe_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up tokens by platform (APNs vs FCM)
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens (platform);

-- RLS: only service role can access
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
