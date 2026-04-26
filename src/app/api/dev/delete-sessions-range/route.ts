import { NextRequest, NextResponse } from "next/server";
import { getRecentSessions, deleteSession } from "@/lib/db/sessions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startSessionNumber, endSessionNumber, userId } = body;

    if (typeof startSessionNumber !== "number" || typeof endSessionNumber !== "number") {
      return NextResponse.json({ error: "startSessionNumber and endSessionNumber are required" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (startSessionNumber < 1 || endSessionNumber < startSessionNumber) {
      return NextResponse.json({ error: "Invalid session number range" }, { status: 400 });
    }

    // Get all sessions
    const allSessions = await getRecentSessions(userId, Number.MAX_SAFE_INTEGER);

    // Filter valid sessions and sort chronologically
    const minValidTimestamp = new Date("2020-01-01").getTime();
    const chronologicalSessions = allSessions
      .filter((session) => {
        const timestamp = new Date(session.started_at).getTime();
        return Number.isFinite(timestamp) && timestamp > minValidTimestamp;
      })
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .map((session, index) => ({ ...session, sessionNumber: index + 1 }));

    // Find target sessions
    const targetSessions = chronologicalSessions.filter(
      (session) => session.sessionNumber >= startSessionNumber && session.sessionNumber <= endSessionNumber
    );

    if (targetSessions.length === 0) {
      return NextResponse.json({
        message: "No sessions found in the specified range",
        totalSessions: chronologicalSessions.length,
        startSessionNumber,
        endSessionNumber,
      });
    }

    // Delete each session
    const deletedSessionIds: string[] = [];
    for (const session of targetSessions) {
      try {
        await deleteSession(session.id);
        deletedSessionIds.push(session.id);
      } catch (error) {
        console.error(`Failed to delete session ${session.id}:`, error);
      }
    }

    return NextResponse.json({
      message: `Deleted ${deletedSessionIds.length} sessions`,
      deletedCount: deletedSessionIds.length,
      targetCount: targetSessions.length,
      startSessionNumber,
      endSessionNumber,
      deletedSessionIds,
      totalSessionsRemaining: chronologicalSessions.length - deletedSessionIds.length,
    });
  } catch (error) {
    console.error("Error in delete-sessions-range:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
