export interface KeystrokeEvent {
  key: string;
  timestamp: number;
  type: "keydown" | "keyup";
}

export interface BigramLatency {
  bigram: string;
  latency: number;
}

export interface BigramStats {
  bigram: string;
  count: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  latencies: number[];
}

export interface TypingSession {
  id?: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  keystrokes: KeystrokeEvent[];
  bigramStats?: Record<string, BigramStats>;
}
