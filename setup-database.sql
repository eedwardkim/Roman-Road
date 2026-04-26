-- Run this script in your Supabase dashboard SQL Editor
-- Navigate to: https://app.supabase.com/project/staakbgjbrllbjsqkbuq/sql/new

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  typing_archetype TEXT DEFAULT 'balanced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop existing policies and recreate with anon support
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Create sessions table for tracking typing practice sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode TEXT NOT NULL,
  capture_source TEXT NOT NULL,
  text_origin TEXT NOT NULL,
  context_key TEXT NOT NULL,
  wpm INTEGER NOT NULL,
  accuracy DECIMAL(5,2) NOT NULL,
  raw_error_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_context_started ON sessions(user_id, context_key, started_at DESC);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can read own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can read own bigram history" ON bigram_score_history;
DROP POLICY IF EXISTS "Users can insert own bigram history" ON bigram_score_history;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own bigram history"
  ON bigram_score_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bigram history"
  ON bigram_score_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create bigram_scores table for tracking user performance on character pairs
CREATE TABLE IF NOT EXISTS bigram_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  capture_source TEXT NOT NULL,
  text_origin TEXT NOT NULL,
  context_key TEXT NOT NULL,
  bigram TEXT NOT NULL,
  avg_latency_ms DECIMAL(10,2) NOT NULL,
  error_rate DECIMAL(5,4) NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, context_key, bigram)
);

-- Create index for weakest/strongest bigram queries
CREATE INDEX IF NOT EXISTS idx_bigram_scores_user_score ON bigram_scores(user_id, normalized_score);
CREATE INDEX IF NOT EXISTS idx_bigram_scores_user_context_score ON bigram_scores(user_id, context_key, normalized_score);

-- Enable RLS
ALTER TABLE bigram_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can read own bigram scores" ON bigram_scores;
DROP POLICY IF EXISTS "Users can insert own bigram scores" ON bigram_scores;
DROP POLICY IF EXISTS "Users can update own bigram scores" ON bigram_scores;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own bigram scores"
  ON bigram_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bigram scores"
  ON bigram_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bigram scores"
  ON bigram_scores FOR UPDATE
  USING (auth.uid() = user_id);

-- Create letter_scores table for tracking user performance on individual letters
CREATE TABLE IF NOT EXISTS letter_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  capture_source TEXT NOT NULL,
  text_origin TEXT NOT NULL,
  context_key TEXT NOT NULL,
  letter TEXT NOT NULL,
  avg_latency_ms DECIMAL(10,2) NOT NULL,
  error_rate DECIMAL(5,4) NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, context_key, letter)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_letter_scores_user_id ON letter_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_letter_scores_user_context_id ON letter_scores(user_id, context_key);

-- Enable RLS
ALTER TABLE letter_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can read own letter scores" ON letter_scores;
DROP POLICY IF EXISTS "Users can insert own letter scores" ON letter_scores;
DROP POLICY IF EXISTS "Users can update own letter scores" ON letter_scores;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own letter scores"
  ON letter_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own letter scores"
  ON letter_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own letter scores"
  ON letter_scores FOR UPDATE
  USING (auth.uid() = user_id);

-- Create word_scores table for tracking user performance on words
CREATE TABLE IF NOT EXISTS word_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  capture_source TEXT NOT NULL,
  text_origin TEXT NOT NULL,
  context_key TEXT NOT NULL,
  word TEXT NOT NULL,
  avg_latency_ms DECIMAL(10,2) NOT NULL,
  error_rate DECIMAL(5,4) NOT NULL,
  normalized_score DECIMAL(3,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, context_key, word)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_word_scores_user_id ON word_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_word_scores_user_context_score ON word_scores(user_id, context_key, normalized_score);

-- Enable RLS
ALTER TABLE word_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can read own word scores" ON word_scores;
DROP POLICY IF EXISTS "Users can insert own word scores" ON word_scores;
DROP POLICY IF EXISTS "Users can update own word scores" ON word_scores;

-- Create policies that work with both authenticated and anonymous users
CREATE POLICY "Users can read own word scores"
  ON word_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own word scores"
  ON word_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own word scores"
  ON word_scores FOR UPDATE
  USING (auth.uid() = user_id);
