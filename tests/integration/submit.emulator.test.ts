import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// No application credentials or .env.local initialization: require the local
// emulator and a fixed demo project before creating any database client.
const projectId = "demo-kiemtraai-submit";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8089") {
  throw new Error("Refusing database access: run npm run test:emulator (127.0.0.1:8089 only).");
}
const mocks = vi.hoisted(() => ({ getAdminDb: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => mocks);
import { POST } from "../../src/app/api/student/submit/route";

const app = initializeApp({ projectId }, `submit-emulator-${randomUUID()}`);
const db = getFirestore(app);
let attemptId: string;
let assignmentId: string;
let studentId: string;

async function seed() {
  const namespace = randomUUID();
  attemptId = `attempt-${namespace}`;
  assignmentId = `assignment-${namespace}`;
  studentId = `student-${namespace}`;
  const batch = db.batch();
  batch.set(db.doc(`examAttempts/${attemptId}`), {
    assignmentId, studentId, studentCode: "HS01", status: "in_progress", answers: {},
  });
  batch.set(db.doc(`students/${studentId}`), { studentCode: "HS01", classId: "class-1", status: "active" });
  batch.set(db.doc(`assignments/${assignmentId}`), {
    classIds: ["class-1"], resultVisibility: "immediately", showCorrectAnswers: true,
    testSnapshot: { sections: [{ id: "part-1", type: "single_choice", questions: [
      { id: "q1", type: "single_choice", score: 1, correctAnswer: "A" },
    ] }] },
  });
  await batch.commit();
}
async function post(answer = "A") {
  const response = await POST(new Request("http://localhost/api/student/submit", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, studentId, studentCode: "HS01", answers: { q1: answer } }),
  }));
  return { status: response.status, body: await response.json() };
}
async function savedResult() { return (await db.doc(`results/${attemptId}`).get()).data()!; }

beforeAll(async () => { await db.listCollections(); });
beforeEach(async () => {
  vi.restoreAllMocks();
  mocks.getAdminDb.mockReturnValue(db);
  await seed();
});
afterAll(async () => { await db.terminate(); await deleteApp(app); });

describe("Firestore Emulator: submit through the real API handler and Admin SDK", () => {
  it.each([["A", "A"], ["A", "B"]])("two concurrent requests, answers %s / %s", async (a, b) => {
    const replies = await Promise.all([post(a), post(b)]);
    const saved = await savedResult();
    expect(replies.filter((r) => !r.body.alreadySubmitted)).toHaveLength(1);
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.body.resultId).toBe(attemptId);
      expect(reply.body.summary.score).toBe(saved.score);
      expect(reply.body.answerReview[0].studentAnswer).toBe((saved.answers as Record<string, unknown>).q1);
    }
    expect((await db.collection("results").where("attemptId", "==", attemptId).get()).size).toBe(1);
    expect((await db.doc(`examAttempts/${attemptId}`).get()).data()?.status).toBe("submitted");
  });

  it("a completed request is read-only when a later request reads its result", async () => {
    const first = await post("A");
    const beforeResult = await db.doc(`results/${attemptId}`).get();
    const beforeAttempt = await db.doc(`examAttempts/${attemptId}`).get();
    const replay = await post("B");
    const afterResult = await db.doc(`results/${attemptId}`).get();
    const afterAttempt = await db.doc(`examAttempts/${attemptId}`).get();
    expect(replay.body).toEqual({ ...first.body, alreadySubmitted: true, message: "Bài làm này đã được nộp trước đó." });
    expect(afterResult.data()).toEqual(beforeResult.data());
    expect(afterResult.updateTime?.isEqual(beforeResult.updateTime!)).toBe(true);
    expect(afterAttempt.updateTime?.isEqual(beforeAttempt.updateTime!)).toBe(true);
  });

  it("the real SDK retries an injected ABORTED conflict after a competing submit commits", async () => {
    // Deterministic fault injection: ABORTED is injected, not claimed to be
    // an emulator-generated conflict. Reads/writes, rollback and SDK retry
    // are real. The separate concurrent tests exercise actual contention.
    let callbacks = 0;
    let aborted = false;
    const original = db.runTransaction.bind(db);
    const wrapped = Object.create(db) as Firestore;
    wrapped.runTransaction = ((callback: Parameters<Firestore["runTransaction"]>[0]) => original(async (tx) => {
      callbacks++;
      if (!aborted) {
        aborted = true;
        await tx.get(db.doc(`examAttempts/${attemptId}`));
        throw Object.assign(new Error("Injected ABORTED conflict"), { code: 10 });
      }
      // The first transaction has rolled back before this retry. A normal
      // competing submit can now commit without waiting on its read lock.
      if (callbacks === 2) {
        mocks.getAdminDb.mockReturnValue(db);
        expect((await post("A")).status).toBe(200);
      }
      return callback(tx);
    })) as Firestore["runTransaction"];
    mocks.getAdminDb.mockReturnValue(wrapped);
    const reply = await post("B");
    expect(callbacks).toBeGreaterThanOrEqual(2);
    expect(reply.status).toBe(200);
    expect(reply.body.alreadySubmitted).toBe(true);
    expect(reply.body.summary.score).toBe(10);
    expect((await savedResult()).answers).toEqual({ q1: "A" });
  });

  it("missing official result returns 409 without recreating it", async () => {
    await db.doc(`examAttempts/${attemptId}`).update({ status: "submitted", resultId: "missing-result" });
    const before = await db.doc(`examAttempts/${attemptId}`).get();
    const reply = await post();
    expect(reply.status).toBe(409);
    expect(reply.body.message).toContain("Cần kiểm tra dữ liệu");
    expect(reply.body).not.toHaveProperty("summary");
    expect((await db.doc(`results/${attemptId}`).get()).exists).toBe(false);
    expect((await db.doc(`examAttempts/${attemptId}`).get()).updateTime?.isEqual(before.updateTime!)).toBe(true);
  });

  it.each(["attemptId", "assignmentId", "studentId", "studentCode"])("conflicting result %s returns 409 without mutation", async (field) => {
    await post();
    await db.doc(`results/${attemptId}`).update({ [field]: "conflicting-value" });
    const before = await db.doc(`results/${attemptId}`).get();
    const reply = await post("B");
    const after = await db.doc(`results/${attemptId}`).get();
    expect(reply.status).toBe(409);
    expect(reply.body).not.toHaveProperty("summary");
    expect(after.data()).toEqual(before.data());
    expect(after.updateTime?.isEqual(before.updateTime!)).toBe(true);
  });
});
