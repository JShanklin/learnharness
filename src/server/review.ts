import { dueForReview, REVIEW_SESSION_CAP, reviewSchedule, type ReviewChat } from "../core/review.ts";
import { graphSnapshot } from "../core/graph.ts";
import { stores } from "./stores.ts";

/** The spaced-review read (GET /api/review): the schedule derived from
 *  the live graph propositions and every chat record — a pure read,
 *  nothing stored. `due` is capped at one review session's worth. */
export function reviewQueue(now: number = Date.now()): {
	dueCount: number;
	due: Array<{ id: string; name: string; statement: string; dueAt: string }>;
} {
	const chats: ReviewChat[] = stores.chatStore.listChats().flatMap((summary) => {
		const record = stores.chatStore.getChat(summary.id);
		return record ? [{ id: record.id, kind: record.kind, messages: record.messages }] : [];
	});
	const due = dueForReview(reviewSchedule(graphSnapshot(stores).propositions, chats), now);
	return {
		dueCount: due.length,
		due: due.slice(0, REVIEW_SESSION_CAP).map(({ id, name, statement, dueAt }) => ({ id, name, statement, dueAt })),
	};
}
