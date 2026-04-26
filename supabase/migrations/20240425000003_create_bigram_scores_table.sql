-- Create bigram_scores table for tracking user performance on character pairs
CREATE TABLE IF NOT EXISTS bigram_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bigram TEXT NOT NULL,
  avg_latency_ms DECIMAL(10,2) NOT NULL,
  error_rate DECIMAL(5,4) NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, bigram)
);

-- Create index for weakest/strongest bigram queries
CREATE INDEX IF NOT EXISTS idx_bigram_scores_user_score ON bigram_scores(user_id, normalized_score);

-- Enable RLS
ALTER TABLE bigram_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own bigram scores
CREATE POLICY "Users can read own bigram scores"
  ON bigram_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own bigram scores
CREATE POLICY "Users can insert own bigram scores"
  ON bigram_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own bigram scores
CREATE POLICY "Users can update own bigram scores"
  ON bigram_scores FOR UPDATE
  USING (auth.uid() = user_id);
