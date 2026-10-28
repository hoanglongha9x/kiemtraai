import { afterEach, describe, expect, it, vi } from "vitest";
import { postJSON } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("submit conflict error propagation", () => {
  it.each([
    "Không tìm thấy kết quả chính thức của phiên đã nộp. Cần kiểm tra dữ liệu.",
    "Kết quả không khớp với phiên làm bài. Cần kiểm tra dữ liệu.",
  ])("preserves the 409 message for the student's submit error UI", async (message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "error", message }), {
      status: 409, headers: { "Content-Type": "application/json" },
    })));
    await expect(postJSON("/api/student/submit", {})).rejects.toThrow(message);
  });
});
