import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadExamPdf: vi.fn(),
  deleteExamPdf: vi.fn(),
  createExamRecord: vi.fn(),
  deleteExamRecord: vi.fn(),
  findExamRecordById: vi.fn(),
  listExamRecords: vi.fn(),
  updateExamRecord: vi.fn(),
  updateExamRecordStatus: vi.fn(),
}));

vi.mock("@/lib/cloudinary/exam-pdf", () => ({
  uploadExamPdf: mocks.uploadExamPdf,
  deleteExamPdf: mocks.deleteExamPdf,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  createExamRecord: mocks.createExamRecord,
  deleteExamRecord: mocks.deleteExamRecord,
  findExamRecordById: mocks.findExamRecordById,
  listExamRecords: mocks.listExamRecords,
  updateExamRecord: mocks.updateExamRecord,
  updateExamRecordStatus: mocks.updateExamRecordStatus,
}));

import { EXAM_STATUS, EXAM_STRUCTURE } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  changeExamStatus,
  editExam,
  listExams,
} from "@/lib/services/exam.service";
import type { ExamPersistenceRecord } from "@/lib/db/dao/exam.dao";
import type { UpsertExamInput } from "@/lib/validations/exam";
import type { AppUser } from "@/types/user";

const admin: AppUser = {
  id: "admin-id",
  username: "admin",
  fullName: "Quan Tri Vien",
  role: USER_ROLE.ADMIN,
};

const student: AppUser = {
  id: "student-id",
  username: "student",
  fullName: "Hoc Sinh",
  role: USER_ROLE.STUDENT,
};

const oldPdf = {
  publicId: "thpt-mock-test/exams/old.pdf",
  secureUrl: "https://res.cloudinary.com/demo/raw/upload/old.pdf",
  originalFilename: "old.pdf",
};

const newPdf = {
  publicId: "thpt-mock-test/exams/new.pdf",
  secureUrl: "https://res.cloudinary.com/demo/raw/upload/new.pdf",
  originalFilename: "new.pdf",
};

function createValidInput(): UpsertExamInput {
  return {
    title: "Đề thi thử Toán số 1",
    description: "Đề luyện tập",
    status: EXAM_STATUS.DRAFT,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    answerKey: {
      partOne: Array.from(
        { length: EXAM_STRUCTURE.partOneQuestions },
        () => "A" as const,
      ),
      partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
        a: true,
        b: false,
        c: true,
        d: false,
      })),
      partThree: Array.from(
        { length: EXAM_STRUCTURE.partThreeQuestions },
        () => "0.5",
      ),
    },
  };
}

function createStoredExam(
  overrides: Partial<ExamPersistenceRecord> = {},
): ExamPersistenceRecord {
  const input = createValidInput();

  return {
    id: "exam-id",
    ...input,
    pdf: oldPdf,
    createdBy: admin.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("exam service", () => {
  beforeEach(() => {
    mocks.uploadExamPdf.mockReset();
    mocks.deleteExamPdf.mockReset();
    mocks.createExamRecord.mockReset();
    mocks.deleteExamRecord.mockReset();
    mocks.findExamRecordById.mockReset();
    mocks.listExamRecords.mockReset();
    mocks.updateExamRecord.mockReset();
    mocks.updateExamRecordStatus.mockReset();
  });

  it("publishes a complete exam", async () => {
    const draft = createStoredExam();
    const published = createStoredExam({ status: EXAM_STATUS.PUBLISHED });
    mocks.findExamRecordById.mockResolvedValue(draft);
    mocks.updateExamRecordStatus.mockResolvedValue(published);

    const result = await changeExamStatus(
      admin,
      draft.id,
      EXAM_STATUS.PUBLISHED,
      draft.updatedAt.toISOString(),
    );

    expect(result.status).toBe(EXAM_STATUS.PUBLISHED);
    expect(mocks.updateExamRecordStatus).toHaveBeenCalledWith(
      draft.id,
      EXAM_STATUS.PUBLISHED,
      draft.updatedAt,
    );
  });

  it("rejects publication when the stored answer key is incomplete", async () => {
    const draft = createStoredExam();
    const incompleteAnswerKey = {
      ...draft.answerKey,
      partOne: draft.answerKey.partOne.slice(0, 11),
    };
    mocks.findExamRecordById.mockResolvedValue(
      createStoredExam({ answerKey: incompleteAnswerKey }),
    );

    await expect(
      changeExamStatus(
        admin,
        draft.id,
        EXAM_STATUS.PUBLISHED,
        draft.updatedAt.toISOString(),
      ),
    ).rejects.toMatchObject({
      code: "EXAM_NOT_READY",
      statusCode: 422,
    });
    expect(mocks.updateExamRecordStatus).not.toHaveBeenCalled();
  });

  it("rejects exam management from a non-admin", async () => {
    await expect(listExams(student)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(mocks.listExamRecords).not.toHaveBeenCalled();
  });

  it("persists a replacement PDF before cleaning up the old asset", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    const replacementFile = new File(["%PDF-1.7"], "new.pdf", {
      type: "application/pdf",
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.uploadExamPdf.mockResolvedValue(newPdf);
    mocks.updateExamRecord.mockResolvedValue(
      createStoredExam({ ...input, pdf: newPdf }),
    );
    mocks.deleteExamPdf.mockResolvedValue(undefined);

    const result = await editExam(
      admin,
      currentExam.id,
      { ...input, expectedUpdatedAt: currentExam.updatedAt.toISOString() },
      replacementFile,
    );

    expect(result.pdf).toEqual(newPdf);
    expect(mocks.updateExamRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({ pdf: newPdf }),
      currentExam.updatedAt,
    );
    expect(mocks.deleteExamPdf).toHaveBeenCalledWith(oldPdf.publicId);
    expect(mocks.updateExamRecord.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteExamPdf.mock.invocationCallOrder[0],
    );
  });

  it("rejects a stale edit before uploading a replacement PDF", async () => {
    const currentExam = createStoredExam();
    const replacementFile = new File(["%PDF-1.7"], "new.pdf", {
      type: "application/pdf",
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);

    await expect(
      editExam(
        admin,
        currentExam.id,
        {
          ...createValidInput(),
          expectedUpdatedAt: "2025-12-31T00:00:00.000Z",
        },
        replacementFile,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_CONFLICT",
      statusCode: 409,
    });
    expect(mocks.uploadExamPdf).not.toHaveBeenCalled();
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
  });
});
