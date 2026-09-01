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
  deleteExamAttemptRecordsByExamId: vi.fn(),
  listTerminalExamAttemptRegradeSources: vi.fn(),
  replaceTerminalExamAttemptGradings: vi.fn(),
  deleteExamRecord: vi.fn(),
  findExamRecordById: vi.fn(),
  findExamRecordByPdfPublicId: vi.fn(),
  listExamRecords: vi.fn(),
  releaseExamPdfOperationLease: vi.fn(),
  updateExamRecord: vi.fn(),
  updateExamAnswerKeyRecord: vi.fn(),
  updateExamMetadataRecord: vi.fn(),
  updateExamRecordStatus: vi.fn(),
  findExamIdsWithAttemptRecords: vi.fn(),
  reserveStudentsForExamAssignment: vi.fn(),
  hasExamAttemptRecords: vi.fn(),
  transactionSession: { id: "transaction-session" },
  withMongoTransaction: vi.fn(),
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
  updateExamAnswerKeyRecord: mocks.updateExamAnswerKeyRecord,
  updateExamMetadataRecord: mocks.updateExamMetadataRecord,
  updateExamRecordStatus: mocks.updateExamRecordStatus,
}));

vi.mock("@/lib/db/dao/exam-attempt.dao", () => ({
  deleteExamAttemptRecordsByExamId: mocks.deleteExamAttemptRecordsByExamId,
  findExamIdsWithAttemptRecords: mocks.findExamIdsWithAttemptRecords,
  hasExamAttemptRecords: mocks.hasExamAttemptRecords,
  listTerminalExamAttemptRegradeSources:
    mocks.listTerminalExamAttemptRegradeSources,
  replaceTerminalExamAttemptGradings: mocks.replaceTerminalExamAttemptGradings,
}));

vi.mock("@/lib/db/dao/user.dao", () => ({
  reserveStudentsForExamAssignment: mocks.reserveStudentsForExamAssignment,
}));

vi.mock("@/lib/db/mongoose", () => ({
  withMongoTransaction: mocks.withMongoTransaction,
}));

import {
  EXAM_STATUS,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
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
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { gradeAttemptAnswers } from "@/lib/exam/grading";
import type { UpdateExamInput, UpsertExamInput } from "@/lib/validations/exam";
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
    visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
    assignedStudentIds: [],
    part3InputMode: PART3_INPUT_MODE.BUBBLE,
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
    answerKeyRevision: 1,
    createdBy: admin.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
    attemptsStarted: overrides.attemptsStarted ?? false,
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
    mocks.deleteExamAttemptRecordsByExamId.mockReset();
    mocks.deleteExamAttemptRecordsByExamId.mockResolvedValue(0);
    mocks.listTerminalExamAttemptRegradeSources.mockReset();
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([]);
    mocks.replaceTerminalExamAttemptGradings.mockReset();
    mocks.replaceTerminalExamAttemptGradings.mockResolvedValue(0);
    mocks.deleteExamRecord.mockReset();
    mocks.findExamRecordById.mockReset();
    mocks.findExamRecordByPdfPublicId.mockReset();
    mocks.findExamRecordByPdfPublicId.mockResolvedValue(null);
    mocks.listExamRecords.mockReset();
    mocks.releaseExamPdfOperationLease.mockReset();
    mocks.releaseExamPdfOperationLease.mockResolvedValue(undefined);
    mocks.updateExamRecord.mockReset();
    mocks.updateExamAnswerKeyRecord.mockReset();
    mocks.updateExamMetadataRecord.mockReset();
    mocks.updateExamRecordStatus.mockReset();
    mocks.findExamIdsWithAttemptRecords.mockReset();
    mocks.findExamIdsWithAttemptRecords.mockResolvedValue(new Set<string>());
    mocks.reserveStudentsForExamAssignment.mockReset();
    mocks.reserveStudentsForExamAssignment.mockResolvedValue(true);
    mocks.hasExamAttemptRecords.mockReset();
    mocks.hasExamAttemptRecords.mockResolvedValue(false);
    mocks.withMongoTransaction.mockReset();
    mocks.withMongoTransaction.mockImplementation(
      (operation: (session: unknown) => Promise<unknown>) =>
        operation(mocks.transactionSession),
    );
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
      mocks.transactionSession,
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

  it("returns only a compact assignment summary in the ADMIN list", async () => {
    const exam = createStoredExam({
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: ["student-one", "student-two", "student-three"],
    });
    mocks.listExamRecords.mockResolvedValue([exam]);

    const [summary] = await listExams(admin);

    expect(summary).toMatchObject({
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentCount: 3,
    });
    expect(summary).not.toHaveProperty("assignedStudentIds");
  });

  it("rejects a missing or non-student user in an Exam assignment", async () => {
    const input = {
      ...createValidInput(),
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: ["64b000000000000000000099"],
    };
    mocks.reserveStudentsForExamAssignment.mockResolvedValue(false);
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      createExam(admin, input, replacementPdfUpload),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(mocks.reserveStudentsForExamAssignment).toHaveBeenCalledWith(
      input.assignedStudentIds,
      mocks.transactionSession,
    );
    expect(mocks.discardExamPdfUpload).toHaveBeenCalledWith(
      replacementPdfUpload,
    );
    expect(mocks.createExamRecord).not.toHaveBeenCalled();
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
      currentExam.answerKeyRevision,
      mocks.transactionSession,
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

  it("cascades ExamAttempts before deleting an Exam in one transaction", async () => {
    const currentExam = createStoredExam({ attemptsStarted: true });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.deleteExamAttemptRecordsByExamId.mockResolvedValue(3);
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
    expect(mocks.deleteExamAttemptRecordsByExamId).toHaveBeenCalledWith(
      currentExam.id,
      mocks.transactionSession,
    );
    expect(mocks.deleteExamRecord).toHaveBeenCalledWith(
      currentExam.id,
      currentExam.updatedAt,
      mocks.transactionSession,
    );
    expect(
      mocks.deleteExamAttemptRecordsByExamId.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.deleteExamRecord.mock.invocationCallOrder[0]);
    expect(mocks.deleteExamRecord.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteExamPdf.mock.invocationCallOrder[0],
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

  it("honors the atomic attempt-start guard before the first attempt insert finishes", async () => {
    const currentExam = createStoredExam({ attemptsStarted: true });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
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
    ).rejects.toMatchObject({ code: "EXAM_CONTENT_LOCKED" });
    expect(mocks.hasExamAttemptRecords).not.toHaveBeenCalled();
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before changing an answer key after attempts", async () => {
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
      code: "ANSWER_KEY_CORRECTION_CONFIRMATION_REQUIRED",
      statusCode: 409,
    });
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.updateExamMetadataRecord).not.toHaveBeenCalled();
  });

  it("atomically corrects the answer key and regrades all terminal attempts", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    input.answerKey.partOne[0] = "B";
    const correctedExam = createStoredExam({
      answerKey: input.answerKey,
      answerKeyRevision: 2,
    });
    const submittedAnswers = createEmptyAttemptAnswers();
    submittedAnswers.partOne[0] = "B";
    const autoSubmittedAnswers = createEmptyAttemptAnswers();
    autoSubmittedAnswers.partOne[0] = "A";
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockResolvedValue(correctedExam);
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      { id: "submitted-attempt", answers: submittedAnswers },
      { id: "auto-submitted-attempt", answers: autoSubmittedAnswers },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockResolvedValue(2);

    const result = await editExam(
      admin,
      currentExam.id,
      { ...input, expectedUpdatedAt: currentExam.updatedAt.toISOString() },
      undefined,
      true,
    );

    expect(result.answerKey).toEqual(input.answerKey);
    expect(mocks.updateExamAnswerKeyRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({ answerKey: input.answerKey }),
      currentExam.updatedAt,
      1,
      2,
      mocks.transactionSession,
    );
    expect(mocks.listTerminalExamAttemptRegradeSources).toHaveBeenCalledWith(
      currentExam.id,
      mocks.transactionSession,
    );
    const replacements = mocks.replaceTerminalExamAttemptGradings.mock
      .calls[0][1] as Array<{
      attemptId: string;
      grading: ReturnType<typeof gradeAttemptAnswers>;
    }>;
    expect(replacements.map((replacement) => replacement.attemptId)).toEqual([
      "submitted-attempt",
      "auto-submitted-attempt",
    ]);
    expect(
      replacements.every(
        (replacement) => replacement.grading.answerKeyRevision === 2,
      ),
    ).toBe(true);
    expect(replacements[0].grading.totalScoreHundredths).toBe(25);
    expect(replacements[1].grading.totalScoreHundredths).toBe(0);
  });

  it("rolls back the corrected key and regrades when the transaction fails", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    input.answerKey.partOne[0] = "B";
    const answers = createEmptyAttemptAnswers();
    const databaseState = {
      answerKey: structuredClone(currentExam.answerKey),
      answerKeyRevision: currentExam.answerKeyRevision,
      gradingRevision: currentExam.answerKeyRevision,
    };
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockImplementation(async () => {
      databaseState.answerKey = structuredClone(input.answerKey);
      databaseState.answerKeyRevision = 2;
      return createStoredExam({
        answerKey: input.answerKey,
        answerKeyRevision: 2,
      });
    });
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      { id: "submitted-attempt", answers },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockImplementation(async () => {
      databaseState.gradingRevision = 2;
      throw new Error("Regrade failed");
    });
    mocks.withMongoTransaction.mockImplementation(
      async (operation: (session: unknown) => Promise<unknown>) => {
        const snapshot = structuredClone(databaseState);

        try {
          return await operation(mocks.transactionSession);
        } catch (error) {
          databaseState.answerKey = snapshot.answerKey;
          databaseState.answerKeyRevision = snapshot.answerKeyRevision;
          databaseState.gradingRevision = snapshot.gradingRevision;
          throw error;
        }
      },
    );

    await expect(
      editExam(
        admin,
        currentExam.id,
        { ...input, expectedUpdatedAt: currentExam.updatedAt.toISOString() },
        undefined,
        true,
      ),
    ).rejects.toThrow("Regrade failed");
    expect(databaseState).toEqual({
      answerKey: currentExam.answerKey,
      answerKeyRevision: 1,
      gradingRevision: 1,
    });
  });

  it("increments the answer-key revision before attempts exist", async () => {
    const currentExam = createStoredExam();
    const input = createValidInput();
    input.answerKey.partOne[0] = "B";
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.updateExamRecord.mockResolvedValue(
      createStoredExam({ answerKey: input.answerKey, answerKeyRevision: 2 }),
    );

    await editExam(admin, currentExam.id, {
      ...input,
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    });

    expect(mocks.updateExamRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({ answerKey: input.answerKey }),
      currentExam.updatedAt,
      2,
      mocks.transactionSession,
    );
  });

  it("allows changing the Part III input mode before attempts exist", async () => {
    const currentExam = createStoredExam();
    const input = {
      ...createValidInput(),
      part3InputMode: PART3_INPUT_MODE.TEXT,
    };
    const updatedExam = createStoredExam({
      part3InputMode: PART3_INPUT_MODE.TEXT,
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.updateExamRecord.mockResolvedValue(updatedExam);

    const result = await editExam(admin, currentExam.id, {
      ...input,
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    });

    expect(result.part3InputMode).toBe(PART3_INPUT_MODE.TEXT);
    expect(mocks.updateExamRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({
        part3InputMode: PART3_INPUT_MODE.TEXT,
      }),
      currentExam.updatedAt,
      currentExam.answerKeyRevision,
      mocks.transactionSession,
    );
  });

  it("preserves assignment when a legacy update omits the new fields", async () => {
    const currentExam = createStoredExam({
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: ["64b000000000000000000001"],
    });
    const legacyInput: Partial<UpsertExamInput> = { ...createValidInput() };
    delete legacyInput.visibilityMode;
    delete legacyInput.assignedStudentIds;
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.updateExamRecord.mockResolvedValue(currentExam);

    await editExam(admin, currentExam.id, {
      ...legacyInput,
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    } as UpdateExamInput);

    expect(mocks.updateExamRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({
        visibilityMode: currentExam.visibilityMode,
        assignedStudentIds: currentExam.assignedStudentIds,
      }),
      currentExam.updatedAt,
      currentExam.answerKeyRevision,
      mocks.transactionSession,
    );
  });

  it("rejects changing the Part III input mode after any attempt exists", async () => {
    const currentExam = createStoredExam();
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);

    await expect(
      editExam(admin, currentExam.id, {
        ...createValidInput(),
        part3InputMode: PART3_INPUT_MODE.TEXT,
        expectedUpdatedAt: currentExam.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "EXAM_CONTENT_LOCKED",
      statusCode: 409,
    });
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.updateExamMetadataRecord).not.toHaveBeenCalled();
  });

  it("does not leave partially deleted Exam data when the transaction fails", async () => {
    const currentExam = createStoredExam({ attemptsStarted: true });
    const databaseState = {
      examExists: true,
      attemptIds: ["in-progress-attempt", "submitted-attempt"],
    };
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.deleteExamAttemptRecordsByExamId.mockImplementation(async () => {
      databaseState.attemptIds = [];
      return 2;
    });
    mocks.deleteExamRecord.mockRejectedValue(new Error("Exam delete failed"));
    mocks.withMongoTransaction.mockImplementation(
      async (operation: (session: unknown) => Promise<unknown>) => {
        const snapshot = structuredClone(databaseState);

        try {
          return await operation(mocks.transactionSession);
        } catch (error) {
          databaseState.examExists = snapshot.examExists;
          databaseState.attemptIds = snapshot.attemptIds;
          throw error;
        }
      },
    );

    await expect(
      deleteExam(admin, currentExam.id, currentExam.updatedAt.toISOString()),
    ).rejects.toThrow("Exam delete failed");
    expect(databaseState).toEqual({
      examExists: true,
      attemptIds: ["in-progress-attempt", "submitted-attempt"],
    });
    expect(mocks.deleteExamPdf).not.toHaveBeenCalled();
  });

  it("cleans up the Exam PDF only after the database transaction commits", async () => {
    const currentExam = createStoredExam();
    let finishCommit: (() => void) | undefined;
    const commit = new Promise<void>((resolve) => {
      finishCommit = resolve;
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.deleteExamRecord.mockResolvedValue(currentExam);
    mocks.deleteExamPdf.mockResolvedValue(undefined);
    mocks.withMongoTransaction.mockImplementation(
      async (operation: (session: unknown) => Promise<unknown>) => {
        const result = await operation(mocks.transactionSession);
        await commit;
        return result;
      },
    );

    const deletion = deleteExam(
      admin,
      currentExam.id,
      currentExam.updatedAt.toISOString(),
    );

    await vi.waitFor(() => expect(mocks.deleteExamRecord).toHaveBeenCalled());
    expect(mocks.deleteExamPdf).not.toHaveBeenCalled();
    finishCommit?.();
    await deletion;
    expect(mocks.deleteExamPdf).toHaveBeenCalledWith(oldPdf.publicId);
  });

  it("keeps the committed Exam deletion when Cloudinary cleanup fails", async () => {
    const currentExam = createStoredExam();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.deleteExamRecord.mockResolvedValue(currentExam);
    mocks.deleteExamPdf.mockRejectedValue(new Error("Cloudinary unavailable"));

    await expect(
      deleteExam(admin, currentExam.id, currentExam.updatedAt.toISOString()),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Could not delete a Cloudinary PDF.",
      { publicId: oldPdf.publicId, errorName: "Error" },
    );
    expect(mocks.releaseExamPdfOperationLease).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("updates assignment as metadata after attempts without touching grading", async () => {
    const currentExam = createStoredExam();
    const assignedStudentId = "64b000000000000000000001";
    const input = {
      ...createValidInput(),
      title: "Đề thi thử Toán đã đổi tên",
      description: "Mô tả mới",
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: [assignedStudentId],
      settings: {
        ...currentExam.settings,
        allowRetake: false,
      },
    };
    const updatedExam = createStoredExam({
      title: input.title,
      description: input.description,
      visibilityMode: input.visibilityMode,
      assignedStudentIds: input.assignedStudentIds,
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
      visibilityMode: input.visibilityMode,
      assignedStudentIds: input.assignedStudentIds,
      hasAttempts: true,
    });
    expect(mocks.updateExamMetadataRecord).toHaveBeenCalledWith(
      currentExam.id,
      {
        title: input.title,
        description: input.description,
        status: input.status,
        visibilityMode: input.visibilityMode,
        assignedStudentIds: input.assignedStudentIds,
        settings: input.settings,
      },
      currentExam.updatedAt,
      mocks.transactionSession,
    );
    expect(mocks.reserveStudentsForExamAssignment).toHaveBeenCalledWith(
      [assignedStudentId],
      mocks.transactionSession,
    );
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.listTerminalExamAttemptRegradeSources).not.toHaveBeenCalled();
    expect(mocks.replaceTerminalExamAttemptGradings).not.toHaveBeenCalled();
  });
});
