import { reviewQueue } from "@/src/server";

/**
 * GET /api/review — the spaced-review queue (2026-10-26): thin transport
 * over the derived schedule. { dueCount, due } — `due` holds at most one
 * review session's nodes, most overdue first.
 */

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(reviewQueue());
}
