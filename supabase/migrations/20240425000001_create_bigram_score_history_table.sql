-- Create bigram_score_history table to track score changes over time
CREATE TABLE IF NOT EXISTS bigram_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bigram TEXT NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and bigram for faster lookups of recent history
CREATE INDEX IF NOT EXISTS idx_bigram_history_user_bigram ON bigram_score_history(user_id, bigram, created_at DESC);

-- Create index on session_id for joining with sessions
CREATE INDEX IF NOT EXISTS idx_bigram_history_session ON bigram_score_history(session_id);

-- Enable RLS
ALTER TABLE bigram_score_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own history
CREATE POLICY "Users can read own bigram history"
  ON bigram_score_history FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own history
CREATE POLICY "Users can insert own bigram history"
  ON bigram_score_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
