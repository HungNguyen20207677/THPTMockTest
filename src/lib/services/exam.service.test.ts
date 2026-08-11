import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAuthenticExamPdfUploadReference: vi.fn(),
  assertValidExamPdfUploadReference: vi.fn(),
  createExamPdfUploadTicket: vi.fn(),
  verifyExamPdfAsset: vi.fn(),
  discardExamPdfUpload: vi.fn(),
  deleteExamPdf: vi.fn(),
  acquireExamPdfOperationLease: vi.fn(),
  createExamRecord: vi.fn(),
  deleteExamRecord: vi.fn(),
  findExamRecordById: vi.fn(),
  findExamRecordByPdfPublicId: vi.fn(),
  listExamRecords: vi.fn(),
  releaseExamPdfOperationLease: vi.fn(),
  updateExamRecord: vi.fn(),
  updateExamMetadataRecord: vi.fn(),
  updateExamRecordStatus: vi.fn(),
  findExamIdsWithAttemptRecords: vi.fn(),
  hasExamAttemptRecords: vi.fn(),
}));

vi.mock("@/lib/cloudinary/exam-pdf", () => ({
  assertAuthenticExamPdfUploadReference:
    mocks.assertAuthenticExamPdfUploadReference,
  assertValidExamPdfUploadReference: mocks.assertValidExamPdfUploadReference,
  createExamPdfUploadTicket: mocks.createExamPdfUploadTicket,
  verifyExamPdfAsset: mocks.verifyExamPdfAsset,
  discardExamPdfUpload: mocks.discardExamPdfUpload,
  deleteExamPdf: mocks.deleteExamPdf,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  acquireExamPdfOperationLease: mocks.acquireExamPdfOperationLease,
  createExamRecord: mocks.createExamRecord,
  deleteExamRecord: mocks.deleteExamRecord,
  findExamRecordById: mocks.findExamRecordById,
  findExamRecordByPdfPublicId: mocks.findExamRecordByPdfPublicId,
  listExamRecords: mocks.listExamRecords,
  releaseExamPdfOperationLease: mocks.releaseExamPdfOperationLease,
  updateExamRecord: mocks.updateExamRecord,
  updateExamMetadataRecord: mocks.updateExamMetadataRecord,
  updateExamRecordStatus: mocks.updateExamRecordStatus,
}));

vi.mock("@/lib/db/dao/exam-attempt.dao", () => ({
  findExamIdsWithAttemptRecords: mocks.findExamIdsWithAttemptRecords,
  hasExamAttemptRecords: mocks.hasExamAttemptRecords,
}));

import { EXAM_STATUS, EXAM_STRUCTURE } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  changeExamStatus,
  createExam,
  deleteExam,
  editExam,
  issueExamPdfUploadTicket,
  listExams,
} from "@/lib/services/exam.service";
import type { ExamPersistenceRecord } from "@/lib/db/dao/exam.dao";
import type { UpsertExamInput } from "@/lib/validations/exam";
import type { AppUser } from "@/types/user";
import type { ExamPdfUploadReference } from "@/types/exam";

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
  publicId: "thpt-mock-test/exams/123e4567-e89b-42d3-a456-426614174000.pdf",
  secureUrl: "https://res.cloudinary.com/demo/raw/upload/new.pdf",
  originalFilename: "new.pdf",
};

const replacementPdfUpload: ExamPdfUploadReference = {
  publicId: "thpt-mock-test/exams/123e4567-e89b-42d3-a456-426614174000.pdf",
  originalFilename: "new.pdf",
  timestamp: 1_786_363_200,
  signature: "a".repeat(40),
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
    mocks.assertAuthenticExamPdfUploadReference.mockReset();
    mocks.assertValidExamPdfUploadReference.mockReset();
    mocks.createExamPdfUploadTicket.mockReset();
    mocks.verifyExamPdfAsset.mockReset();
    mocks.discardExamPdfUpload.mockReset();
    mocks.deleteExamPdf.mockReset();
    mocks.acquireExamPdfOperationLease.mockReset();
    mocks.acquireExamPdfOperationLease.mockImplementation((publicId: string) =>
      Promise.resolve({ publicId, token: `lease-${publicId}` }),
    );
    mocks.createExamRecord.mockReset();
    mocks.deleteExamRecord.mockReset();
    mocks.findExamRecordById.mockReset();
    mocks.findExamRecordByPdfPublicId.mockReset();
    mocks.findExamRecordByPdfPublicId.mockResolvedValue(null);
    mocks.listExamRecords.mockReset();
    mocks.releaseExamPdfOperationLease.mockReset();
    mocks.releaseExamPdfOperationLease.mockResolvedValue(undefined);
    mocks.updateExamRecord.mockReset();
    mocks.updateExamMetadataRecord.mockReset();
    mocks.updateExamRecordStatus.mockReset();
    mocks.findExamIdsWithAttemptRecords.mockReset();
    mocks.findExamIdsWithAttemptRecords.mockResolvedValue(new Set<string>());
    mocks.hasExamAttemptRecords.mockReset();
    mocks.hasExamAttemptRecords.mockResolvedValue(false);
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

  it("allows only an ADMIN to issue a signed PDF upload ticket", () => {
    const intent = {
      name: "de-thi.pdf",
      type: "application/pdf",
      size: 1024,
    };
    const ticket = {
      uploadUrl: "https://api.cloudinary.com/upload",
      apiKey: "api-key",
      signature: "a".repeat(40),
      fields: {
        timestamp: "1786363200",
        public_id: replacementPdfUpload.publicId,
        overwrite: "0" as const,
        allowed_formats: "pdf" as const,
        filename_override: "de-thi.pdf",
        type: "upload" as const,
      },
    };
    mocks.createExamPdfUploadTicket.mockReturnValue(ticket);

    expect(() => issueExamPdfUploadTicket(student, intent)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }),
    );
    expect(mocks.createExamPdfUploadTicket).not.toHaveBeenCalled();
    expect(issueExamPdfUploadTicket(admin, intent)).toEqual(ticket);
    expect(mocks.createExamPdfUploadTicket).toHaveBeenCalledWith(intent);
  });

  it("persists a replacement PDF before cleaning up the old asset", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.updateExamRecord.mockResolvedValue(
      createStoredExam({ ...input, pdf: newPdf }),
    );
    mocks.deleteExamPdf.mockResolvedValue(undefined);

    const result = await editExam(
      admin,
      currentExam.id,
      { ...input, expectedUpdatedAt: currentExam.updatedAt.toISOString() },
      replacementPdfUpload,
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
    expect(
      mocks.acquireExamPdfOperationLease.mock.calls.map(
        ([publicId]) => publicId,
      ),
    ).toEqual([replacementPdfUpload.publicId, oldPdf.publicId].sort());
    expect(mocks.deleteExamPdf.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseExamPdfOperationLease.mock.invocationCallOrder[0],
    );
  });

  it("rejects a stale edit before uploading a replacement PDF", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      editExam(
        admin,
        currentExam.id,
        {
          ...createValidInput(),
          expectedUpdatedAt: "2025-12-31T00:00:00.000Z",
        },
        replacementPdfUpload,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_CONFLICT",
      statusCode: 409,
    });
    expect(mocks.discardExamPdfUpload).toHaveBeenCalledWith(
      replacementPdfUpload,
    );
    expect(mocks.verifyExamPdfAsset).not.toHaveBeenCalled();
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
  });

  it("cleans up a verified replacement when Exam persistence fails", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.updateExamRecord.mockRejectedValue(new Error("Database unavailable"));
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      editExam(
        admin,
        currentExam.id,
        { ...input, expectedUpdatedAt: currentExam.updatedAt.toISOString() },
        replacementPdfUpload,
      ),
    ).rejects.toThrow("Database unavailable");
    expect(mocks.discardExamPdfUpload).toHaveBeenCalledWith(
      replacementPdfUpload,
    );
    expect(mocks.deleteExamPdf).not.toHaveBeenCalledWith(oldPdf.publicId);
  });

  it("cleans up an unclaimed upload when Exam creation fails", async () => {
    const input = createValidInput();
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.createExamRecord.mockRejectedValue(new Error("Database unavailable"));
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      createExam(admin, input, replacementPdfUpload),
    ).rejects.toThrow("Database unavailable");
    expect(mocks.discardExamPdfUpload).toHaveBeenCalledWith(
      replacementPdfUpload,
    );
  });

  it("does not verify or delete an upload reference already owned by an Exam", async () => {
    const owner = createStoredExam({ pdf: newPdf });
    mocks.findExamRecordById.mockResolvedValue(createStoredExam());
    mocks.findExamRecordByPdfPublicId.mockResolvedValue(owner);

    await expect(
      editExam(
        admin,
        "exam-id",
        {
          ...createValidInput(),
          expectedUpdatedAt: "2026-01-02T00:00:00.000Z",
        },
        replacementPdfUpload,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_PDF_ALREADY_ATTACHED",
      statusCode: 409,
    });
    expect(mocks.verifyExamPdfAsset).not.toHaveBeenCalled();
    expect(mocks.discardExamPdfUpload).not.toHaveBeenCalled();
    expect(mocks.deleteExamPdf).not.toHaveBeenCalled();
  });

  it("does not delete the winning asset after a duplicate ownership race", async () => {
    mocks.findExamRecordByPdfPublicId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createStoredExam({ pdf: newPdf }));
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.createExamRecord.mockRejectedValue({ code: 11000 });

    await expect(
      createExam(admin, createValidInput(), replacementPdfUpload),
    ).rejects.toMatchObject({
      code: "EXAM_PDF_ALREADY_ATTACHED",
      statusCode: 409,
    });
    expect(mocks.discardExamPdfUpload).not.toHaveBeenCalled();
    expect(mocks.deleteExamPdf).not.toHaveBeenCalled();
  });

  it("does not finalize or discard while another PDF operation holds the lease", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.acquireExamPdfOperationLease.mockResolvedValue(null);

    await expect(
      editExam(
        admin,
        currentExam.id,
        {
          ...createValidInput(),
          expectedUpdatedAt: currentExam.updatedAt.toISOString(),
        },
        replacementPdfUpload,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_PDF_OPERATION_CONFLICT",
      statusCode: 409,
    });
    expect(mocks.verifyExamPdfAsset).not.toHaveBeenCalled();
    expect(mocks.discardExamPdfUpload).not.toHaveBeenCalled();
    expect(mocks.releaseExamPdfOperationLease).not.toHaveBeenCalled();
  });

  it("holds the stored PDF lease through Exam deletion and asset cleanup", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.deleteExamRecord.mockResolvedValue(currentExam);
    mocks.deleteExamPdf.mockResolvedValue(undefined);

    await deleteExam(
      admin,
      currentExam.id,
      currentExam.updatedAt.toISOString(),
    );

    expect(mocks.acquireExamPdfOperationLease).toHaveBeenCalledWith(
      oldPdf.publicId,
    );
    expect(mocks.deleteExamPdf).toHaveBeenCalledWith(oldPdf.publicId);
    expect(mocks.deleteExamPdf.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseExamPdfOperationLease.mock.invocationCallOrder[0],
    );
  });

  it("rejects a PDF replacement after the Exam has attempts", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      editExam(
        admin,
        currentExam.id,
        {
          ...createValidInput(),
          expectedUpdatedAt: currentExam.updatedAt.toISOString(),
        },
        replacementPdfUpload,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_CONTENT_LOCKED",
      statusCode: 409,
    });
    expect(mocks.verifyExamPdfAsset).not.toHaveBeenCalled();
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.discardExamPdfUpload).toHaveBeenCalledWith(
      replacementPdfUpload,
    );
  });

  it("rejects answer-key changes after the Exam has attempts", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    input.answerKey.partOne[0] = "B";
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);

    await expect(
      editExam(admin, currentExam.id, {
        ...input,
        expectedUpdatedAt: currentExam.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "EXAM_CONTENT_LOCKED",
      statusCode: 409,
    });
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.updateExamMetadataRecord).not.toHaveBeenCalled();
  });

  it("rejects hard deletion after the Exam has attempts", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);

    await expect(
      deleteExam(admin, currentExam.id, currentExam.updatedAt.toISOString()),
    ).rejects.toMatchObject({
      code: "EXAM_HAS_ATTEMPTS",
      statusCode: 409,
    });
    expect(mocks.deleteExamRecord).not.toHaveBeenCalled();
    expect(mocks.deleteExamPdf).not.toHaveBeenCalled();
  });

  it("updates only metadata and settings after the Exam has attempts", async () => {
    const currentExam = createStoredExam();
    const input = {
      ...createValidInput(),
      title: "Đề thi thử Toán đã đổi tên",
      description: "Mô tả mới",
      settings: {
        ...currentExam.settings,
        allowRetake: false,
      },
    };
    const updatedExam = createStoredExam({
      title: input.title,
      description: input.description,
      settings: input.settings,
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamMetadataRecord.mockResolvedValue(updatedExam);

    const result = await editExam(admin, currentExam.id, {
      ...input,
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    });

    expect(result).toMatchObject({
      title: input.title,
      description: input.description,
      settings: input.settings,
      hasAttempts: true,
    });
    expect(mocks.updateExamMetadataRecord).toHaveBeenCalledWith(
      currentExam.id,
      {
        title: input.title,
        description: input.description,
        status: input.status,
        settings: input.settings,
      },
      currentExam.updatedAt,
    );
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
  });
});
