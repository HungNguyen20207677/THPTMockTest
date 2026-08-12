import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  deleteMany: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/db/models/exam-attempt.model", () => ({
  ExamAttemptModel: {
    deleteMany: mocks.deleteMany,
    init: mocks.init,
  },
}));

import {
  deleteExamAttemptRecordsByExamId,
  deleteExamAttemptRecordsByStudentId,
} from "@/lib/db/dao/exam-attempt.dao";

describe("ExamAttempt cascade DAO", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.deleteMany.mockReset();
    mocks.init.mockReset();
    mocks.init.mockResolvedValue(undefined);
  });

  it("deletes every attempt status belonging to an Exam", async () => {
    const session = { id: "exam-delete-session" };
    const attempts = [
      { examId: "exam-id", status: "IN_PROGRESS" },
      { examId: "exam-id", status: "SUBMITTED" },
      { examId: "other-exam", status: "AUTO_SUBMITTED" },
    ];
    mocks.deleteMany.mockImplementation(
      async (filter: { examId: string }, options: { session: unknown }) => {
        expect(options.session).toBe(session);
        const deletedCount = attempts.filter(
          (attempt) => attempt.examId === filter.examId,
        ).length;
        return { deletedCount };
      },
    );

    await expect(
      deleteExamAttemptRecordsByExamId("exam-id", session as never),
    ).resolves.toBe(2);
    expect(mocks.deleteMany).toHaveBeenCalledWith(
      { examId: "exam-id" },
      { session },
    );
  });

  it("deletes every attempt status belonging to a Student", async () => {
    const session = { id: "student-delete-session" };
    const attempts = [
      { studentId: "student-id", status: "IN_PROGRESS" },
      { studentId: "student-id", status: "AUTO_SUBMITTED" },
      { studentId: "other-student", status: "SUBMITTED" },
    ];
    mocks.deleteMany.mockImplementation(
      async (filter: { studentId: string }, options: { session: unknown }) => {
        expect(options.session).toBe(session);
        const deletedCount = attempts.filter(
          (attempt) => attempt.studentId === filter.studentId,
        ).length;
        return { deletedCount };
      },
    );

    await expect(
      deleteExamAttemptRecordsByStudentId("student-id", session as never),
    ).resolves.toBe(2);
    expect(mocks.deleteMany).toHaveBeenCalledWith(
      { studentId: "student-id" },
      { session },
    );
  });
});
