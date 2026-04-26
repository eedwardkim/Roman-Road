ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS capture_source TEXT,
  ADD COLUMN IF NOT EXISTS text_origin TEXT,
  ADD COLUMN IF NOT EXISTS context_key TEXT;

UPDATE sessions
SET
  capture_source = CASE
    WHEN mode = 'system_wide' THEN 'system_wide'
    ELSE 'in_app'
  END,
  text_origin = CASE
    WHEN mode IN ('system_wide', 'free') THEN 'freeform'
    ELSE 'prompted'
  END,
  context_key = CASE
    WHEN mode = 'system_wide' THEN 'system_wide_freeform'
    WHEN mode = 'free' THEN 'in_app_freeform'
    ELSE 'in_app_prompted'
  END
WHERE capture_source IS NULL OR text_origin IS NULL OR context_key IS NULL;

ALTER TABLE sessions
  ALTER COLUMN capture_source SET NOT NULL,
  ALTER COLUMN text_origin SET NOT NULL,
  ALTER COLUMN context_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_context_started ON sessions(user_id, context_key, started_at DESC);

ALTER TABLE bigram_scores
  ADD COLUMN IF NOT EXISTS capture_source TEXT,
  ADD COLUMN IF NOT EXISTS text_origin TEXT,
  ADD COLUMN IF NOT EXISTS context_key TEXT;

UPDATE bigram_scores
SET
  capture_source = 'in_app',
  text_origin = 'prompted',
  context_key = 'in_app_prompted'
WHERE capture_source IS NULL OR text_origin IS NULL OR context_key IS NULL;

ALTER TABLE bigram_scores
  ALTER COLUMN capture_source SET NOT NULL,
  ALTER COLUMN text_origin SET NOT NULL,
  ALTER COLUMN context_key SET NOT NULL;

ALTER TABLE bigram_scores DROP CONSTRAINT IF EXISTS bigram_scores_user_id_bigram_key;
ALTER TABLE bigram_scores ADD CONSTRAINT bigram_scores_user_id_context_key_bigram_key UNIQUE (user_id, context_key, bigram);

CREATE INDEX IF NOT EXISTS idx_bigram_scores_user_context_score ON bigram_scores(user_id, context_key, normalized_score);

ALTER TABLE letter_scores
  ADD COLUMN IF NOT EXISTS capture_source TEXT,
  ADD COLUMN IF NOT EXISTS text_origin TEXT,
  ADD COLUMN IF NOT EXISTS context_key TEXT;

UPDATE letter_scores
SET
  capture_source = 'in_app',
  text_origin = 'prompted',
  context_key = 'in_app_prompted'
WHERE capture_source IS NULL OR text_origin IS NULL OR context_key IS NULL;

ALTER TABLE letter_scores
  ALTER COLUMN capture_source SET NOT NULL,
  ALTER COLUMN text_origin SET NOT NULL,
  ALTER COLUMN context_key SET NOT NULL;

ALTER TABLE letter_scores DROP CONSTRAINT IF EXISTS letter_scores_user_id_letter_key;
ALTER TABLE letter_scores ADD CONSTRAINT letter_scores_user_id_context_key_letter_key UNIQUE (user_id, context_key, letter);

CREATE INDEX IF NOT EXISTS idx_letter_scores_user_context_id ON letter_scores(user_id, context_key);

ALTER TABLE word_scores
  ADD COLUMN IF NOT EXISTS capture_source TEXT,
  ADD COLUMN IF NOT EXISTS text_origin TEXT,
  ADD COLUMN IF NOT EXISTS context_key TEXT;

UPDATE word_scores
SET
  capture_source = 'in_app',
  text_origin = 'prompted',
  context_key = 'in_app_prompted'
WHERE capture_source IS NULL OR text_origin IS NULL OR context_key IS NULL;

ALTER TABLE word_scores
  ALTER COLUMN capture_source SET NOT NULL,
  ALTER COLUMN text_origin SET NOT NULL,
  ALTER COLUMN context_key SET NOT NULL;

ALTER TABLE word_scores DROP CONSTRAINT IF EXISTS word_scores_user_id_word_key;
ALTER TABLE word_scores ADD CONSTRAINT word_scores_user_id_context_key_word_key UNIQUE (user_id, context_key, word);

CREATE INDEX IF NOT EXISTS idx_word_scores_user_context_score ON word_scores(user_id, context_key, normalized_score);
