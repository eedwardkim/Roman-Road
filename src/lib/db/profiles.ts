import {
  getProfile as localGetProfile,
  upsertProfile as localUpsertProfile,
  computeTypingArchetype as localComputeTypingArchetype,
} from "./local-storage";

export interface Profile {
  id: string;
  user_id: string;
  total_sessions: number;
  last_active: string;
  typing_archetype: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches a user's profile by user ID.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  return localGetProfile(userId);
}

/**
 * Upserts a user's profile with updated session count and archetype.
 */
export async function upsertProfile(data: {
  userId: string;
  totalSessions: number;
  typingArchetype: string;
}): Promise<void> {
  await localUpsertProfile(data);
  console.log("Profile upserted successfully");
}

/**
 * Computes the typing archetype based on a user's bigram scores.
 * 
 * Speed metrics: based on normalized_score (higher = faster)
 * Accuracy metrics: based on (1 - error_rate) (higher = more accurate)
 * 
 * Returns: "speed-focused", "accuracy-focused", or "balanced"
 */
export async function computeTypingArchetype(userId: string): Promise<string> {
  return localComputeTypingArchetype(userId);
}
