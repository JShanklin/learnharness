/**
 * Spaced review (2026-10-26): the expanding-ladder schedule derived from
 * the graph + practice record, the due ordering and cap inputs, the
 * sidebar's Review row, and the review draft's opening message.
 */
import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssistantMessage, JsonObject, ToolResultMessage } from "@earendil-works/pi-ai";
import {
	dueForReview,
	ladderMove,
	PRACTICE_CONCLUDE_TOOL,
	PRACTICE_PROBLEM_TOOL,
	REVIEW_LADDER_DAYS,
	reviewSchedule,
	type GraphNode,
	type LhMessage,
	type ReviewChat,
} from "../src/core/index.ts";
import { ReviewNavRow } from "../components/sidebar.tsx";
import { reviewDraftText } from "../components/new-session.tsx";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-10-01T00:00:00.000Z");

const STAMPS = {
	api: "faux",
	provider: "test",
	model: "test-model",
	usage: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "toolUse",
} as const;

function node(id: string, chatId: string, createdAt = T0): GraphNode {
	return {
		id,
		name: `Name ${id}`,
		statement: `Statement ${id}`,
		aliases: [],
		createdAt: new Date(createdAt).toISOString(),
		provenance: [{ chatId, messageId: "m1" }],
	};
}

function call(id: string, name: string, args: JsonObject, at: number, isError = false): LhMessage[] {
	const assistant: LhMessage & AssistantMessage = {
		id: `msg_a_${id}`,
		role: "assistant",
		content: [{ type: "toolCall", id, name, arguments: args }],
		timestamp: at,
		...STAMPS,
	};
	const ack: LhMessage & ToolResultMessage = {
		id: `msg_r_${id}`,
		role: "toolResult",
		toolCallId: id,
		toolName: name,
		content: [{ type: "text", text: "ok" }],
		details: null,
		isError,
		timestamp: at + 1,
	};
	return [assistant, ack];
}

/** One posed + concluded practice problem on `targets`, concluded at `at`. */
function problem(
	n: number,
	targets: string[],
	conclude: { outcome: string; rung?: string | null; missClass?: string | null },
	at: number,
): LhMessage[] {
	return [
		...call(`p${n}`, PRACTICE_PROBLEM_TOOL, { statement: "s", mode: "recall", target: targets, modelSolution: "x" }, at - 10),
		...call(`c${n}`, PRACTICE_CONCLUDE_TOOL, { rung: null, missClass: null, ...conclude, verdict: "v", retest: false }, at),
	];
}

const teach: ReviewChat = { id: "chat_teach", kind: "teach", messages: [] };

describe("ladderMove — one conclusion's effect on its targets", () => {
	it("maps outcomes, rungs, and miss classes onto up / stay / reset / ignored", () => {
		assert.equal(ladderMove("solved", null, null), "up");
		assert.equal(ladderMove("solvedWithHints", "R1", null), "up");
		assert.equal(ladderMove("solvedWithHints", "R2", null), "stay");
		assert.equal(ladderMove("solvedWithHints", "R3", "execution"), "stay");
		assert.equal(ladderMove("solvedWithHints", "R4", null), "reset");
		assert.equal(ladderMove("surrendered", null, "cue"), "reset");
		assert.equal(ladderMove("solved", null, "structural"), "reset");
		assert.equal(ladderMove("movedOn", null, null), null);
		assert.equal(ladderMove("dismissed", null, null), null);
	});
});

describe("reviewSchedule — eligibility", () => {
	it("taught nodes are eligible; notes-only nodes are not until practiced", () => {
		const nodes = [node("n_taught", "chat_teach"), node("n_notes", "src_abc"), node("n_practiced", "src_def")];
		const practice: ReviewChat = {
			id: "chat_practice",
			kind: "practice",
			messages: problem(1, ["n_practiced"], { outcome: "solved" }, T0 + 2 * DAY),
		};
		const ids = reviewSchedule(nodes, [teach, practice]).map((e) => e.id).sort();
		assert.deepEqual(ids, ["n_practiced", "n_taught"]);
	});

	it("a legacy chat with no kind counts as teach", () => {
		const entries = reviewSchedule([node("n1", "chat_old")], [{ id: "chat_old", messages: [] }]);
		assert.equal(entries.length, 1);
	});
});

describe("reviewSchedule — the expanding ladder", () => {
	it("a never-practiced node is due one day after creation, at step 0", () => {
		const [e] = reviewSchedule([node("n1", "chat_teach")], [teach]);
		assert.equal(e!.step, 0);
		assert.equal(e!.lastReviewedAt, null);
		assert.equal(e!.dueAt, new Date(T0 + DAY).toISOString());
	});

	it("clean solves climb the ladder; the due date anchors at the last conclusion", () => {
		const at1 = T0 + 1 * DAY;
		const at2 = T0 + 4 * DAY;
		const practice: ReviewChat = {
			id: "chat_practice",
			kind: "practice",
			messages: [...problem(1, ["n1"], { outcome: "solved" }, at1), ...problem(2, ["n1"], { outcome: "solved" }, at2)],
		};
		const [e] = reviewSchedule([node("n1", "chat_teach")], [teach, practice]);
		assert.equal(e!.step, 2);
		assert.equal(e!.lastReviewedAt, new Date(at2).toISOString());
		assert.equal(e!.dueAt, new Date(at2 + REVIEW_LADDER_DAYS[2]! * DAY).toISOString());
	});

	it("a heavy-hint solve holds the step; a surrender resets it", () => {
		const practice: ReviewChat = {
			id: "chat_practice",
			kind: "practice",
			messages: [
				...problem(1, ["n1", "n2"], { outcome: "solved" }, T0 + DAY),
				...problem(2, ["n1"], { outcome: "solvedWithHints", rung: "R3" }, T0 + 2 * DAY),
				...problem(3, ["n2"], { outcome: "surrendered", rung: "R5" }, T0 + 3 * DAY),
			],
		};
		const byId = new Map(reviewSchedule([node("n1", "chat_teach"), node("n2", "chat_teach")], [teach, practice]).map((e) => [e.id, e]));
		assert.equal(byId.get("n1")!.step, 1);
		assert.equal(byId.get("n2")!.step, 0);
	});

	it("the ladder tops out at its last step", () => {
		const messages = Array.from({ length: 9 }, (_, i) => problem(i, ["n1"], { outcome: "solved" }, T0 + (i + 1) * DAY)).flat();
		const [e] = reviewSchedule([node("n1", "chat_teach")], [teach, { id: "chat_practice", kind: "practice", messages }]);
		assert.equal(e!.step, REVIEW_LADDER_DAYS.length - 1);
	});

	it("errored concludes, moved-on problems, and untargeted problems count for nothing", () => {
		const practice: ReviewChat = {
			id: "chat_practice",
			kind: "practice",
			messages: [
				...call("p1", PRACTICE_PROBLEM_TOOL, { statement: "s", mode: "recall", target: ["n1"], modelSolution: "x" }, T0 + DAY),
				...call("c1", PRACTICE_CONCLUDE_TOOL, { outcome: "solved", rung: null, missClass: null }, T0 + DAY + 5, true),
				...problem(2, ["n1"], { outcome: "movedOn" }, T0 + 2 * DAY),
				...problem(3, [], { outcome: "solved" }, T0 + 3 * DAY),
			],
		};
		const [e] = reviewSchedule([node("n1", "chat_teach")], [teach, practice]);
		assert.equal(e!.step, 0);
		assert.equal(e!.lastReviewedAt, null);
	});
});

describe("dueForReview — what is due, most overdue first", () => {
	it("filters by now and orders by due date, then id", () => {
		const nodes = [node("n_b", "chat_teach", T0), node("n_a", "chat_teach", T0), node("n_late", "chat_teach", T0 - 5 * DAY), node("n_new", "chat_teach", T0 + 10 * DAY)];
		const due = dueForReview(reviewSchedule(nodes, [teach]), T0 + 2 * DAY);
		assert.deepEqual(due.map((e) => e.id), ["n_late", "n_a", "n_b"]);
	});
});

describe("ReviewNavRow — the sidebar's Review entry", () => {
	it("shows the due count as a badge when something is due", () => {
		const html = renderToStaticMarkup(<ReviewNavRow dueCount={12} onOpen={() => {}} />);
		assert.ok(html.includes('data-testid="review-due-count"'));
		assert.ok(html.includes(">12<"));
		assert.ok(!html.includes('disabled=""'));
	});

	it("is dimmed, inert, and badge-free when nothing is due", () => {
		const html = renderToStaticMarkup(<ReviewNavRow dueCount={0} onOpen={() => {}} />);
		assert.ok(!html.includes('data-testid="review-due-count"'));
		assert.ok(html.includes('disabled=""'));
		assert.ok(html.includes("nothing is due for review"));
	});
});

describe("reviewDraftText — the review session's opening message", () => {
	it("names the count, singular and plural", () => {
		assert.equal(reviewDraftText(1), "Spaced review: 1 node due. Mix them, fresh situations, retest anything I miss.");
		assert.ok(reviewDraftText(12).startsWith("Spaced review: 12 nodes due."));
	});
});
