import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  setExamAttemptQuestionFlag: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/exam-attempt.service", () => ({
  setExamAttemptQuestionFlag: mocks.setExamAttemptQuestionFlag,
}));

import { PATCH } from "@/app/api/student/exams/[examId]/attempts/[attemptId]/flags/route";
import { USER_ROLE } from "@/lib/constants/roles";

const examId = "507f1f77bcf86cd799439011";
const attemptId = "507f191e810c19729de860ea";
const student = {
  id: "student-id",
  username: "student",
  fullName: "Hoc Sinh",
  role: USER_ROLE.STUDENT,
};

describe("student attempt flags route", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.setExamAttemptQuestionFlag.mockReset();
    mocks.requireApiRole.mockResolvedValue(student);
  });

  it("validates and forwards an absolute flag state", async () => {
    const result = {
      attempt: { id: attemptId, flaggedQuestionIds: ["part-one-question-1"] },
      serverNow: "2026-08-11T03:00:00.000Z",
      canEditAnswers: true,
    };
    mocks.setExamAttemptQuestionFlag.mockResolvedValue(result);

    const response = await PATCH(
      new Request(
        `http://localhost/api/student/exams/${examId}/attempts/${attemptId}/flags`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "part-one-question-1",
            flagged: true,
          }),
        },
      ),
      { params: Promise.resolve({ examId, attemptId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: result });
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.STUDENT);
    expect(mocks.setExamAttemptQuestionFlag).toHaveBeenCalledWith(
      student,
      examId,
      attemptId,
      "part-one-question-1",
      true,
    );
  });

  it("rejects malformed payloads before mutating the attempt", async () => {
    const response = await PATCH(
      new Request(
        `http://localhost/api/student/exams/${examId}/attempts/${attemptId}/flags`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "part-one-question-1" }),
        },
      ),
      { params: Promise.resolve({ examId, attemptId }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.setExamAttemptQuestionFlag).not.toHaveBeenCalled();
  });
});
