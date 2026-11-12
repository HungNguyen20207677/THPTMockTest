import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  aggregate: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/db/models/user.model", () => ({
  UserModel: {
    aggregate: mocks.aggregate,
    init: mocks.init,
  },
}));

vi.mock("@/lib/db/models/exam-attempt.model", () => ({
  ExamAttemptModel: { collection: { name: "examattempts" } },
}));

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { EXAM_VISIBILITY_MODE } from "@/lib/constants/exam";
import { getExamAssignmentCompletionPage } from "@/lib/db/dao/user.dao";

describe("Exam assignment completion DAO", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.init.mockReset();
    mocks.init.mockResolvedValue(undefined);
    mocks.aggregate.mockReset();
  });

  it("aggregates a selected roster once per student across all retakes", async () => {
    const studentId = "507f191e810c19729de860ea";
    const attemptId = "507f1f77bcf86cd799439012";
    const submittedAt = new Date("2026-11-12T01:00:00.000Z");
    mocks.aggregate.mockReturnValue({
      exec: () =>
        Promise.resolve([
          {
            statistics: [
              {
                assigned: 1,
                completed: 1,
                inProgress: 0,
                notStarted: 0,
                overdue: 0,
              },
            ],
            students: [
              {
                _id: { toString: () => studentId },
                username: "student",
                fullName: "Hoc Sinh",
                isActive: true,
                completionStatus: "COMPLETED",
                isOverdue: false,
                firstCompletion: {
                  _id: { toString: () => attemptId },
                  attemptNumber: 1,
                  status: EXAM_ATTEMPT_STATUS.SUBMITTED,
                  submittedAt,
                },
              },
            ],
          },
        ]),
    });

    const result = await getExamAssignmentCompletionPage({
      examId: "507f1f77bcf86cd799439011",
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: [studentId],
      assignmentDueAt: new Date("2026-11-12T02:00:00.000Z"),
      now: new Date("2026-11-12T03:00:00.000Z"),
      page: 1,
      pageSize: 20,
    });

    const pipeline = mocks.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({ role: "STUDENT" });
    expect(pipeline[0].$match._id.$in).toHaveLength(1);
    expect(pipeline[1].$lookup.from).toBe("examattempts");
    expect(JSON.stringify(pipeline)).toContain("terminalAttempts");
    expect(JSON.stringify(pipeline)).toContain("firstCompletion");
    expect(result).toEqual({
      totals: {
        assigned: 1,
        completed: 1,
        inProgress: 0,
        notStarted: 0,
        overdue: 0,
      },
      students: [
        {
          studentId,
          username: "student",
          fullName: "Hoc Sinh",
          isActive: true,
          completionStatus: "COMPLETED",
          isOverdue: false,
          firstCompletion: {
            attemptId,
            attemptNumber: 1,
            status: EXAM_ATTEMPT_STATUS.SUBMITTED,
            submittedAt,
          },
        },
      ],
    });
  });

  it("tracks ALL_STUDENTS without materializing an ID filter", async () => {
    mocks.aggregate.mockReturnValue({
      exec: () => Promise.resolve([{ statistics: [], students: [] }]),
    });

    await getExamAssignmentCompletionPage({
      examId: "507f1f77bcf86cd799439011",
      visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
      assignedStudentIds: [],
      assignmentDueAt: null,
      now: new Date("2026-11-12T03:00:00.000Z"),
      page: 2,
      pageSize: 20,
    });

    const pipeline = mocks.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { role: "STUDENT" } });
    expect(pipeline.at(-1).$facet.students).toEqual(
      expect.arrayContaining([{ $skip: 20 }, { $limit: 20 }]),
    );
  });

  it("returns an empty selected roster without querying attempts", async () => {
    await expect(
      getExamAssignmentCompletionPage({
        examId: "507f1f77bcf86cd799439011",
        visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
        assignedStudentIds: [],
        assignmentDueAt: null,
        now: new Date("2026-11-12T03:00:00.000Z"),
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toMatchObject({ totals: { assigned: 0 }, students: [] });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
