import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransactionStore } from "@/features/exam/server/__tests__/transaction-store";

const mocks = vi.hoisted(() => ({ getAdminDb: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => mocks);
vi.mock("@/features/exam/server/prepare-submit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/exam/server/prepare-submit")>();
  return { ...original, prepareSubmit: vi.fn(original.prepareSubmit) };
});

import { prepareSubmit } from "@/features/exam/server/prepare-submit";
import { POST } from "./route";

const assignment = {
  classIds: ["class"], resultVisibility: "immediately", showCorrectAnswers: true,
  testSnapshot: { sections: [{ id: "part", type: "single_choice", questions: [
    { id: "q", type: "single_choice", score: 1, correctAnswer: "A" },
  ] }] },
};
function fixture() {
  const store = createTransactionStore({
    "examAttempts/attempt": {
      status: "in_progress", assignmentId: "assignment", studentId: "student", studentCode: "HS01", answers: {},
    },
    "assignments/assignment": assignment,
    "students/student": { status: "active", classId: "class", studentCode: "HS01" },
  });
  mocks.getAdminDb.mockReturnValue(store.db);
  return store;
}
async function post(answer = "A", extra: Record<string, unknown> = {}) {
  const response = await POST(new Request("http://localhost/api/student/submit", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId: "attempt", studentId: "student", studentCode: "HS01", answers: { q: answer }, ...extra }),
  }));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/student/submit", () => {
  it.each(["A", "B"])("replay %s returns persisted score/review without invoking grading", async (answer) => {
    const store = fixture();
    const first = await post("A");
    expect(first.status).toBe(200);
    const before = structuredClone([...store.docs]);
    vi.mocked(prepareSubmit).mockClear();
    const replay = await post(answer, { autoSubmit: true, antiCheat: { visibilityLostCount: 100 } });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ ...first.body, alreadySubmitted: true, message: "Bài làm này đã được nộp trước đó." });
    expect(replay.body.summary.score).toBe(10);
    expect(replay.body.answerReview[0].studentAnswer).toBe("A");
    expect(prepareSubmit).not.toHaveBeenCalled();
    expect([...store.docs]).toEqual(before);
    expect(replay.body).not.toHaveProperty("result");
    expect(replay.body).not.toHaveProperty("antiCheat");
  });

  it("concurrent HTTP requests return the winner's stored score and answers", async () => {
    const store = fixture();
    const replies = await Promise.all(Array.from({ length: 20 }, (_, i) => post(i % 2 ? "A" : "B")));
    const saved = store.docs.get("results/attempt");
    expect(store.conflicts).toBeGreaterThan(0);
    expect(store.writes).toBe(2);
    expect(replies.filter((r) => !r.body.alreadySubmitted)).toHaveLength(1);
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.body.resultId).toBe("attempt");
      expect(reply.body.summary.score).toBe(saved?.score);
      expect(reply.body.answerReview[0].studentAnswer).toBe((saved?.answers as Record<string, unknown>).q);
    }
  });

  it("replays when grading source and current student record are gone, without fabricating a result", async () => {
    const store = fixture();
    await post();
    const saved = structuredClone(store.docs.get("results/attempt"));
    store.docs.delete("assignments/assignment");
    store.docs.delete("students/student");
    vi.mocked(prepareSubmit).mockClear();
    const replay = await post("B");
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ resultId: "attempt", alreadySubmitted: true, summary: null });
    expect(replay.body).not.toHaveProperty("answerReview");
    expect(prepareSubmit).not.toHaveBeenCalled();
    expect(store.docs.get("results/attempt")).toEqual(saved);
  });

  it("does not expose review when showCorrectAnswers is false", async () => {
    const store = fixture();
    store.docs.set("assignments/assignment", { ...assignment, showCorrectAnswers: false });
    await post();
    const replay = await post("B");
    expect(replay.body.summary.score).toBe(10);
    expect(replay.body).not.toHaveProperty("answerReview");
  });

  it("reads the current release setting on replay without changing the stored grade", async () => {
    const store = fixture();
    await post();
    const saved = structuredClone(store.docs.get("results/attempt"));
    store.docs.set("assignments/assignment", { ...assignment, resultVisibility: "after_close" });
    const replay = await post("B");
    expect(replay.body.summary).toBeNull();
    expect(replay.body).not.toHaveProperty("answerReview");
    expect(store.docs.get("results/attempt")).toEqual(saved);
  });

  it("does not synthesize missing summary fields for an incomplete legacy result", async () => {
    const store = fixture();
    store.docs.set("results/attempt", { score: 7, totalScore: 10, answers: { q: "A" } });
    const before = structuredClone([...store.docs]);
    vi.mocked(prepareSubmit).mockClear();
    const replay = await post("B");
    expect(replay.status).toBe(200);
    expect(replay.body.summary).toBeNull();
    expect(prepareSubmit).not.toHaveBeenCalled();
    expect([...store.docs]).toEqual(before);
  });

  it("rejects wrong identity on replay and preserves all data", async () => {
    const store = fixture();
    await post();
    const before = structuredClone([...store.docs]);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const replay = await post("B", { studentId: "other-student" });
      expect(replay.status).toBe(403);
      expect(replay.body).not.toHaveProperty("summary");
      expect([...store.docs]).toEqual(before);
    } finally { consoleError.mockRestore(); }
  });

  it("returns 409 for a missing official result and never regrades", async () => {
    const store = fixture();
    store.docs.set("examAttempts/attempt", { ...store.docs.get("examAttempts/attempt"), status: "submitted", resultId: "missing" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await post()).status).toBe(409);
      expect(prepareSubmit).not.toHaveBeenCalled();
      expect(store.writes).toBe(0);
    } finally { consoleError.mockRestore(); }
  });
  it("returns stored reviews for all question types through an explicit public DTO", async () => {
    const store = fixture();
    await post();
    const result = store.docs.get("results/attempt")!;
    const common = { questionNumber: 1, sectionTitle: "Part", isCorrect: true, score: 1, maxScore: 1, explanation: "private explanation" };
    const detail = [
      { ...common, type: "single_choice", questionId: "q1", studentAnswer: "A", correctAnswer: "A" },
      { ...common, type: "true_false_group", questionId: "q2", studentAnswer: { A: true }, correctAnswer: { A: true } },
      { ...common, type: "short_answer", questionId: "q3", studentAnswer: "42", acceptedAnswers: ["42"] },
    ];
    store.docs.set("results/attempt", { ...result, detail });
    const reply = await post("B");
    expect(reply.body.answerReview).toEqual(detail.map(({ explanation, ...item }) => item));
    expect(JSON.stringify(reply.body)).not.toContain("private explanation");
  });

});
