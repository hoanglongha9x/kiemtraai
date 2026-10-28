import { createTransactionStore } from "./__tests__/transaction-store";
import { describe, expect, it } from "vitest";
import { runSubmitTransaction } from "./submit-transaction";
import { buildSubmitSuccessResponse } from "./submit-response";

const submittedAt = new Date("2026-10-28T08:00:00.000Z");
const assignment = {
  classIds: ["class-1"], classNames: ["12A"],
  resultVisibility: "immediately", showCorrectAnswers: true,
  testSnapshot: { sections: [{ id: "part-1", type: "single_choice", questions: [
    { id: "q1", type: "single_choice", content: "Question", score: 1, correctAnswer: "A" },
  ] }] },
};
const attempt = {
  assignmentId: "assignment-1", studentId: "student-1", studentCode: "HS01",
  status: "in_progress", answers: {}, startedAt: "2026-10-28T07:55:00.000Z",
};


function fixture(overrides: Record<string, Record<string, unknown>> = {}) {
  return createTransactionStore({
    "examAttempts/attempt-1": attempt,
    "assignments/assignment-1": assignment,
    "students/student-1": { studentCode: "HS01", status: "active", classId: "class-1", studentName: "Student" },
    ...overrides,
  });
}

function submit(store: ReturnType<typeof fixture>, answer = "A") {
  return runSubmitTransaction({
    db: store.db, attemptId: "attempt-1", studentId: "student-1", studentCode: "HS01",
    requestAnswers: { q1: answer }, requestAntiCheat: {}, submittedAt, autoSubmit: false,
  });
}

describe("submit idempotency", () => {
  it("commits result and attempt together on first submission", async () => {
    const store = fixture();
    const result = await submit(store);
    expect(result.alreadySubmitted).toBe(false);
    expect(result.result).toEqual(store.docs.get("results/attempt-1"));
    expect(result.result.score).toBe(10);
    expect(store.docs.get("examAttempts/attempt-1")).toMatchObject({ status: "submitted", resultId: "attempt-1", answers: { q1: "A" } });
  });

  it.each(["A", "B"])("replay answer %s never changes any stored result or attempt field", async (answer) => {
    const store = fixture();
    const first = await submit(store);
    const before = structuredClone([...store.docs]);
    const writes = store.writes;
    const replay = await submit(store, answer);
    expect([...store.docs]).toEqual(before);
    expect(store.writes).toBe(writes);
    expect(replay).toMatchObject({ alreadySubmitted: true, resultId: first.resultId, result: first.result });
    const response = buildSubmitSuccessResponse({ transactionResult: replay });
    expect(response.summary?.score).toBe(10);
    expect(response.answerReview?.[0].studentAnswer).toBe("A");
  });

  it("20 concurrent different submissions return the committed winner after retries", async () => {
    const store = fixture();
    const replies = await Promise.all(Array.from({ length: 20 }, (_, i) => submit(store, i % 2 ? "B" : "A")));
    const saved = store.docs.get("results/attempt-1");
    expect(store.conflicts).toBeGreaterThan(0);
    expect(store.writes).toBe(2);
    expect(replies.filter((r) => !r.alreadySubmitted)).toHaveLength(1);
    expect([...store.docs.keys()].filter((key) => key.startsWith("results/"))).toHaveLength(1);
    for (const reply of replies) {
      expect(reply.result).toEqual(saved);
      expect(buildSubmitSuccessResponse({ transactionResult: reply }).summary?.score).toBe(saved?.score);
    }
  });

  it("replays without grading when the source snapshot is no longer valid", async () => {
    const store = fixture();
    const first = await submit(store);
    store.docs.set("assignments/assignment-1", { ...assignment, testSnapshot: {} });
    const replay = await submit(store, "B");
    expect(replay.result).toEqual(first.result);
  });

  it("honors a legacy resultId without creating a canonical duplicate", async () => {
    const store = fixture();
    const first = await submit(store);
    store.docs.delete("results/attempt-1");
    store.docs.set("results/legacy-result", first.result);
    store.docs.set("examAttempts/attempt-1", { ...store.docs.get("examAttempts/attempt-1"), resultId: "legacy-result" });
    const writes = store.writes;
    expect(await submit(store, "B")).toMatchObject({ resultId: "legacy-result", alreadySubmitted: true, result: first.result });
    expect(store.docs.has("results/attempt-1")).toBe(false);
    expect(store.writes).toBe(writes);
  });

  it("does not recreate a missing official result", async () => {
    const store = fixture({ "examAttempts/attempt-1": { ...attempt, status: "submitted", resultId: "missing" } });
    await expect(submit(store)).rejects.toMatchObject({ statusCode: 409 });
    expect(store.writes).toBe(0);
  });

  it("does not grade a submitted attempt with no result pointer or result", async () => {
    const store = fixture({ "examAttempts/attempt-1": { ...attempt, status: "submitted" } });
    await expect(submit(store)).rejects.toMatchObject({ statusCode: 409 });
    expect(store.writes).toBe(0);
  });

  it("validates identity even when an official result exists", async () => {
    const store = fixture();
    await submit(store);
    const before = structuredClone([...store.docs]);
    await expect(runSubmitTransaction({
      db: store.db, attemptId: "attempt-1", studentId: "another-student", studentCode: "HS01",
      requestAnswers: {}, requestAntiCheat: {}, submittedAt, autoSubmit: false,
    })).rejects.toMatchObject({ statusCode: 403 });
    expect([...store.docs]).toEqual(before);
  });

  it("does not repair or overwrite inconsistent result ownership", async () => {
    const store = fixture({ "results/attempt-1": { attemptId: "another-attempt", studentId: "another-student" } });
    await expect(submit(store)).rejects.toMatchObject({ statusCode: 409 });
    expect(store.writes).toBe(0);
  });

  it("withholds response data under the existing after_close policy", async () => {
    const store = fixture({ "assignments/assignment-1": { ...assignment, resultVisibility: "after_close" } });
    await submit(store);
    const replay = await submit(store, "B");
    expect(buildSubmitSuccessResponse({ transactionResult: replay })).toMatchObject({ summary: null });
    expect(buildSubmitSuccessResponse({ transactionResult: replay })).not.toHaveProperty("answerReview");
  });
  it("keeps canonical results read-only even if attempt finalization is incomplete", async () => {
    const store = fixture();
    const first = await submit(store);
    store.docs.set("examAttempts/attempt-1", { ...attempt, answers: { q1: "B" } });
    const before = structuredClone([...store.docs]);
    expect(await submit(store, "B")).toMatchObject({ alreadySubmitted: true, result: first.result });
    expect([...store.docs]).toEqual(before);
  });

  it("rejects conflicting linked and canonical results without choosing or modifying either", async () => {
    const store = fixture();
    const first = await submit(store);
    store.docs.set("results/legacy-result", first.result);
    store.docs.set("examAttempts/attempt-1", { ...store.docs.get("examAttempts/attempt-1"), resultId: "legacy-result" });
    const before = structuredClone([...store.docs]);
    await expect(submit(store, "B")).rejects.toMatchObject({ statusCode: 409 });
    expect([...store.docs]).toEqual(before);
  });

  it("supports first submission from testAssignments without migrating it", async () => {
    const store = fixture();
    store.docs.delete("assignments/assignment-1");
    store.docs.set("testAssignments/assignment-1", assignment);
    const result = await submit(store);
    expect(result.result.score).toBe(10);
    expect(store.docs.has("assignments/assignment-1")).toBe(false);
    expect(store.docs.get("testAssignments/assignment-1")).toEqual(assignment);
  });

  it("leaves no partial writes when first-submission grading fails", async () => {
    const store = fixture({ "assignments/assignment-1": { ...assignment, testSnapshot: {} } });
    const before = structuredClone([...store.docs]);
    await expect(submit(store)).rejects.toThrow();
    expect([...store.docs]).toEqual(before);
    expect(store.writes).toBe(0);
  });

  it("returns 404 for a missing attempt without writes", async () => {
    const store = fixture();
    store.docs.delete("examAttempts/attempt-1");
    await expect(submit(store)).rejects.toMatchObject({ statusCode: 404 });
    expect(store.writes).toBe(0);
  });

});
