-- Create word_scores table for tracking user performance on words
CREATE TABLE IF NOT EXISTS word_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  avg_latency_ms DECIMAL(10,2) NOT NULL,
  error_rate DECIMAL(5,4) NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_word_scores_user_id ON word_scores(user_id);

-- Enable RLS
ALTER TABLE word_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own word scores
CREATE POLICY "Users can read own word scores"
  ON word_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own word scores
CREATE POLICY "Users can insert own word scores"
  ON word_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own word scores
CREATE POLICY "Users can update own word scores"
  ON word_scores FOR UPDATE
  USING (auth.uid() = user_id);
