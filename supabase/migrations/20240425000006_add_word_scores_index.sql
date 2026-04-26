-- Add index for weakest/strongest word queries
CREATE INDEX IF NOT EXISTS idx_word_scores_user_score ON word_scores(user_id, normalized_score);
