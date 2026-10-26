import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ChatKind } from "./contracts/chat.ts";
import type { GraphNode } from "./contracts/graph.ts";
import {
	cleanToolCallIds,
	PRACTICE_CONCLUDE_TOOL,
	problemInputForConclude,
	type LhMessage,
} from "./native-messages.ts";

/**
 * SPACED REVIEW (2026-10-26) — the expanding-ladder schedule, DERIVED at
 * read from the graph and the practice record; nothing is stored. Pure +
 * browser-safe (the barrel exports it).
 *
 * Eligible nodes: a node any teach session touched (provenance in a chat
 * whose kind is teach or absent), or any node a concluded practice
 * problem targeted. Imported-notes nodes (provenance "src_…" only) stay
 * off the schedule until practiced.
 *
 * The ladder: 1 → 3 → 7 → 16 → 35 → 90 days. A node starts at step 0,
 * anchored at its createdAt. Each cleanly concluded practice problem
 * moves every node it targeted:
 *   - solved / solvedWithHints at R0–R1 (or no hint)  → step + 1
 *   - solvedWithHints at R2–R3                        → same step
 *   - surrendered, R4–R5, or a structural miss         → step 0
 *   - movedOn / dismissed                               → ignored
 * due = last counted conclusion (or createdAt) + the step's interval.
 */

/** The ladder's intervals in days, indexed by step. */
export const REVIEW_LADDER_DAYS: readonly number[] = [1, 3, 7, 16, 35, 90];

/** The most due nodes one review session takes. */
export const REVIEW_SESSION_CAP = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a review fold needs from a chat record. */
export interface ReviewChat {
	id: string;
	kind?: ChatKind;
	messages: readonly LhMessage[];
}

/** One node's derived schedule. */
export interface ReviewEntry {
	id: string;
	name: string;
	statement: string;
	/** Ladder step (0-based index into REVIEW_LADDER_DAYS). */
	step: number;
	/** ISO time of the last counted conclusion, or null (never reviewed). */
	lastReviewedAt: string | null;
	/** ISO time the node falls due. */
	dueAt: string;
}

/** The step change one conclusion implies — null = ignored. */
export function ladderMove(outcome: unknown, rung: unknown, missClass: unknown): "up" | "stay" | "reset" | null {
	if (outcome !== "solved" && outcome !== "solvedWithHints" && outcome !== "surrendered") return null;
	if (outcome === "surrendered" || missClass === "structural" || rung === "R4" || rung === "R5") return "reset";
	if (rung === "R2" || rung === "R3") return "stay";
	return "up";
}

/** One counted practice conclusion: when, which targets, which move. */
interface ReviewEvent {
	at: number;
	targets: string[];
	move: "up" | "stay" | "reset";
}

/** Every cleanly concluded, counted practice problem in one chat. */
function reviewEvents(chat: ReviewChat): ReviewEvent[] {
	const events: ReviewEvent[] = [];
	const clean = cleanToolCallIds(chat.messages);
	for (const m of chat.messages) {
		if ((m as { role?: string }).role !== "assistant") continue;
		const assistant = m as AssistantMessage & { id: string };
		for (const block of assistant.content) {
			if (block.type !== "toolCall" || block.name !== PRACTICE_CONCLUDE_TOOL) continue;
			if (!clean.has(block.id)) continue;
			const args = (block.arguments ?? {}) as { outcome?: unknown; rung?: unknown; missClass?: unknown };
			const move = ladderMove(args.outcome, args.rung, args.missClass);
			if (!move) continue;
			const target = problemInputForConclude(chat.messages, block.id)?.target;
			const targets = Array.isArray(target) ? target.filter((t): t is string => typeof t === "string") : [];
			if (targets.length === 0) continue;
			events.push({ at: assistant.timestamp, targets, move });
		}
	}
	return events;
}

/** The full schedule: every eligible node's entry, unsorted. */
export function reviewSchedule(nodes: readonly GraphNode[], chats: readonly ReviewChat[]): ReviewEntry[] {
	const teachChats = new Set(chats.filter((c) => c.kind === undefined || c.kind === "teach").map((c) => c.id));
	const byNode = new Map<string, ReviewEvent[]>();
	for (const chat of chats) {
		if (chat.kind !== "practice") continue;
		for (const event of reviewEvents(chat)) {
			for (const id of event.targets) {
				const list = byNode.get(id) ?? [];
				list.push(event);
				byNode.set(id, list);
			}
		}
	}
	const entries: ReviewEntry[] = [];
	for (const node of nodes) {
		const events = byNode.get(node.id) ?? [];
		const taught = node.provenance.some((p) => teachChats.has(p.chatId));
		if (!taught && events.length === 0) continue;
		let step = 0;
		let last: number | null = null;
		for (const event of [...events].sort((a, b) => a.at - b.at)) {
			if (event.move === "up") step = Math.min(step + 1, REVIEW_LADDER_DAYS.length - 1);
			else if (event.move === "reset") step = 0;
			last = event.at;
		}
		const anchor = last ?? Date.parse(node.createdAt);
		if (Number.isNaN(anchor)) continue;
		entries.push({
			id: node.id,
			name: node.name,
			statement: node.statement,
			step,
			lastReviewedAt: last === null ? null : new Date(last).toISOString(),
			dueAt: new Date(anchor + REVIEW_LADDER_DAYS[step]! * DAY_MS).toISOString(),
		});
	}
	return entries;
}

/** The due entries at `now`, most overdue first (ties by id). */
export function dueForReview(entries: readonly ReviewEntry[], now: number): ReviewEntry[] {
	return entries
		.filter((e) => Date.parse(e.dueAt) <= now)
		.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id));
}
