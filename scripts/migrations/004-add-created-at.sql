-- Add created_at column to cafes table
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill existing rows with last_crawled_at (or now() if null)
UPDATE cafes SET created_at = COALESCE(last_crawled_at, now()) WHERE created_at IS NULL;
