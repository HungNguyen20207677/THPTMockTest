import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  examInit: vi.fn(),
  leaseInit: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  exists: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/db/models/exam.model", () => ({
  ExamModel: {
    init: mocks.examInit,
    find: mocks.find,
    findById: mocks.findById,
    exists: mocks.exists,
    updateOne: mocks.updateOne,
    updateMany: mocks.updateMany,
  },
  ExamPdfOperationLeaseModel: {
    init: mocks.leaseInit,
  },
}));

import {
  EXAM_STATUS,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";
import {
  findExamRecordById,
  findStudentExamRecordById,
  isPublishedExamAvailableToStudent,
  listPublishedStudentExamRecords,
  listStudentExamRecordsByIds,
  removeStudentFromExamAssignments,
  reserveExamForAttemptCreation,
} from "@/lib/db/dao/exam.dao";

const legacyExam = {
  _id: { toString: () => "legacy-exam-id" },
  title: "Legacy exam",
  status: EXAM_STATUS.PUBLISHED,
  pdf: {
    publicId: "legacy.pdf",
    secureUrl: "https://example.com/legacy.pdf",
    originalFilename: "legacy.pdf",
  },
  settings: {
    allowRetake: true,
    showScoreAfterSubmission: true,
    showAnswersAfterSubmission: false,
  },
  answerKey: { partOne: [], partTwo: [], partThree: [] },
  createdBy: { toString: () => "admin-id" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Exam DAO compatibility", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.examInit.mockResolvedValue(undefined);
    mocks.leaseInit.mockResolvedValue(undefined);
    mocks.find.mockReset();
    mocks.findById.mockReset();
    mocks.exists.mockReset();
    mocks.updateOne.mockReset();
    mocks.updateMany.mockReset();
  });

  it("maps a legacy Exam without a Part III mode to BUBBLE", async () => {
    mocks.findById.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(legacyExam) }),
    });

    const exam = await findExamRecordById("legacy-exam-id");

    expect(exam?.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
    expect(exam?.answerKeyRevision).toBe(1);
    expect(exam?.visibilityMode).toBe(EXAM_VISIBILITY_MODE.ALL_STUDENTS);
    expect(exam?.assignedStudentIds).toEqual([]);
    expect(exam?.questionTopicIds).toEqual(createEmptyQuestionTopicIds());
  });

  it("maps the legacy student workspace safely to BUBBLE", async () => {
    const select = vi.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(legacyExam) }),
    });
    mocks.findById.mockReturnValue({ select });

    const exam = await findStudentExamRecordById("legacy-exam-id");

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ part3InputMode: 1 }),
    );
    expect(exam?.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
    expect(exam).not.toHaveProperty("answerKey");
    expect(exam).not.toHaveProperty("questionTopicIds");
  });

  it("scopes published Exams to legacy, all-student, or selected assignments", async () => {
    const studentId = "64b000000000000000000001";
    const exec = vi.fn().mockResolvedValue([]);
    const lean = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ lean });
    const select = vi.fn().mockReturnValue({ sort });
    mocks.find.mockReturnValue({ select });

    await listPublishedStudentExamRecords(studentId);

    expect(mocks.find).toHaveBeenCalledWith({
      status: EXAM_STATUS.PUBLISHED,
      $or: [
        { visibilityMode: { $exists: false } },
        { visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS },
        {
          visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
          assignedStudentIds: studentId,
        },
      ],
    });
  });

  it("rechecks assignment while reserving a new attempt", async () => {
    const studentId = "64b000000000000000000001";
    const session = { id: "session" };
    mocks.updateOne.mockReturnValue({
      exec: () => Promise.resolve({ matchedCount: 1 }),
    });

    await reserveExamForAttemptCreation(
      "64b000000000000000000010",
      studentId,
      session as never,
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "64b000000000000000000010",
        status: EXAM_STATUS.PUBLISHED,
        $or: expect.arrayContaining([
          {
            visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
            assignedStudentIds: studentId,
          },
        ]),
      }),
      expect.anything(),
      expect.objectContaining({ session }),
    );
  });

  it("reports current assignment eligibility without returning Exam metadata", async () => {
    const studentId = "64b000000000000000000001";
    mocks.exists.mockResolvedValue({ _id: "exam-id" });

    await expect(
      isPublishedExamAvailableToStudent("exam-id", studentId),
    ).resolves.toBe(true);
    expect(mocks.exists).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "exam-id",
        status: EXAM_STATUS.PUBLISHED,
      }),
    );
  });

  it("marks retained selected Exams by assignment without returning the ID list", async () => {
    const studentId = "64b000000000000000000001";
    const selectedExam = {
      ...legacyExam,
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: [{ toString: () => studentId }],
    };
    const exec = vi.fn().mockResolvedValue([selectedExam]);
    const lean = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ lean });
    const select = vi.fn().mockReturnValue({ sort });
    mocks.find.mockReturnValue({ select });

    const [assigned] = await listStudentExamRecordsByIds(
      ["legacy-exam-id"],
      studentId,
    );
    const [unassigned] = await listStudentExamRecordsByIds(
      ["legacy-exam-id"],
      "64b000000000000000000002",
    );

    expect(assigned.isAssigned).toBe(true);
    expect(unassigned.isAssigned).toBe(false);
    expect(assigned).not.toHaveProperty("assignedStudentIds");
  });

  it("pulls a deleted student from every Exam assignment in the transaction", async () => {
    const studentId = "64b000000000000000000001";
    const session = { id: "session" };
    mocks.updateMany.mockReturnValue({
      exec: () => Promise.resolve({ modifiedCount: 2 }),
    });

    await expect(
      removeStudentFromExamAssignments(studentId, session as never),
    ).resolves.toBe(2);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      { assignedStudentIds: studentId },
      { $pull: { assignedStudentIds: studentId } },
      { session },
    );
  });
});
