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
  findExamStructureTemplateRecordById: vi.fn(),
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
  reserveTopicRecordsByIds: vi.fn(),
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

vi.mock("@/lib/db/dao/exam-structure-template.dao", () => ({
  findExamStructureTemplateRecordById:
    mocks.findExamStructureTemplateRecordById,
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

vi.mock("@/lib/db/dao/topic.dao", () => ({
  reserveTopicRecordsByIds: mocks.reserveTopicRecordsByIds,
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
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { EXAM_ATTEMPT_GRADING_STATUS } from "@/lib/constants/exam-attempt";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  changeExamStatus,
  createExam,
  deleteExam,
  editExam,
  issueExamPdfUploadTicket,
  listExams,
} from "@/lib/services/exam.service";
import type {
  ExamPersistenceRecord,
  SaveExamRecordInput,
} from "@/lib/db/dao/exam.dao";
import type { ExamStructureTemplatePersistenceRecord } from "@/lib/db/dao/exam-structure-template.dao";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { isDynamicExamAnswerKey } from "@/lib/exam/answer-key";
import {
  applyManualEssayScores,
  gradeAttemptAnswers,
  gradeDynamicAttemptAnswers,
} from "@/lib/exam/grading";
import {
  createEmptyQuestionTopicIds,
  createEmptyQuestionTopics,
} from "@/lib/exam/question-topics";
import type {
  DynamicExamUpsertInput,
  UpdateExamInput,
  UpsertExamInput,
} from "@/lib/validations/exam";
import type { DynamicAttemptAnswers } from "@/types/exam-attempt";
import type {
  DynamicExamAnswerKey,
  ExamPdfUploadReference,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
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
const firstTopicId = "64b000000000000000000011";
const secondTopicId = "64b000000000000000000012";
const structureTemplateId = "64b000000000000000000021";

function createDynamicStructureSnapshot(): ExamStructureSnapshot {
  return {
    sections: [
      {
        id: "section-z",
        title: "Phần hiển thị thứ nhất",
        questions: [
          {
            id: "question-z-choice",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
            maxScoreHundredths: 250,
          },
          {
            id: "question-a-true-false",
            type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
            maxScoreHundredths: 200,
          },
        ],
      },
      {
        id: "section-a",
        title: "Phần hiển thị thứ hai",
        questions: [
          {
            id: "question-y-short-answer",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
            maxScoreHundredths: 300,
          },
          {
            id: "question-b-choice",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
            maxScoreHundredths: 250,
          },
        ],
      },
    ],
  };
}

function createEssayCorrectionStructureSnapshot(): ExamStructureSnapshot {
  return {
    sections: [
      {
        id: "essay-section",
        title: "Phần hỗn hợp",
        questions: [
          {
            id: "essay-image-question",
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            maxScoreHundredths: 500,
          },
          {
            id: "essay-choice-question",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
            maxScoreHundredths: 500,
          },
        ],
      },
    ],
  };
}

function createDynamicAnswerKey(
  firstChoice: "A" | "B" = "A",
): DynamicExamAnswerKey {
  return {
    answersByQuestionId: {
      "question-z-choice": firstChoice,
      "question-a-true-false": { a: true, b: false, c: true, d: false },
      "question-y-short-answer": "0.5",
      "question-b-choice": "D",
    },
  };
}

function createDynamicInput(
  structure = createDynamicStructureSnapshot(),
): DynamicExamUpsertInput {
  const legacyInput = createValidInput();

  return {
    title: legacyInput.title,
    description: legacyInput.description,
    status: legacyInput.status,
    visibilityMode: legacyInput.visibilityMode,
    assignedStudentIds: legacyInput.assignedStudentIds,
    part3InputMode: legacyInput.part3InputMode,
    settings: legacyInput.settings,
    structureTemplateId,
    answerKey: createDynamicAnswerKey(),
    questionTopics: createEmptyQuestionTopics(structure),
  };
}

function createEssayCorrectionAnswerKey(
  choice: "A" | "B" = "A",
): DynamicExamAnswerKey {
  return {
    answersByQuestionId: {
      "essay-choice-question": choice,
    },
  };
}

function createDynamicUpdateInput(
  currentExam: ExamPersistenceRecord,
  structure: ExamStructureSnapshot,
  answerKey: DynamicExamAnswerKey,
): UpdateExamInput {
  const baseInput = createDynamicInput(structure);

  return {
    title: baseInput.title,
    description: baseInput.description,
    status: baseInput.status,
    visibilityMode: baseInput.visibilityMode,
    assignedStudentIds: baseInput.assignedStudentIds,
    part3InputMode: baseInput.part3InputMode,
    settings: baseInput.settings,
    answerKey,
    questionTopics: baseInput.questionTopics,
    expectedUpdatedAt: currentExam.updatedAt.toISOString(),
  };
}

function createStructureTemplate(
  structure = createDynamicStructureSnapshot(),
): ExamStructureTemplatePersistenceRecord {
  return {
    id: structureTemplateId,
    name: "Mẫu cấu trúc tùy chỉnh",
    isBuiltIn: false,
    sections: structure.sections,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
}

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
    questionTopicIds: createEmptyQuestionTopicIds(),
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
    mocks.findExamStructureTemplateRecordById.mockReset();
    mocks.findExamStructureTemplateRecordById.mockResolvedValue(null);
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
    mocks.reserveTopicRecordsByIds.mockReset();
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
    if (isDynamicExamAnswerKey(draft.answerKey)) {
      throw new Error("Expected a legacy answer key fixture.");
    }
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

  it("rejects question topic IDs that do not exist", async () => {
    const input = createValidInput();
    input.questionTopicIds.partOne[0] = [firstTopicId];
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(0);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      createExam(admin, input, replacementPdfUpload),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [firstTopicId],
      mocks.transactionSession,
    );
    expect(mocks.createExamRecord).not.toHaveBeenCalled();
  });

  it("rejects dynamic question Topic IDs that do not exist", async () => {
    const input = createDynamicInput();
    input.questionTopics[0].topicIds = [firstTopicId];
    mocks.findExamStructureTemplateRecordById.mockResolvedValue(
      createStructureTemplate(),
    );
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(0);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      createExam(admin, input, replacementPdfUpload),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [firstTopicId],
      mocks.transactionSession,
    );
    expect(mocks.createExamRecord).not.toHaveBeenCalled();
  });

  it("snapshots a custom template and persists dynamic Topics in canonical order", async () => {
    const template = createStructureTemplate();
    const expectedSnapshot = structuredClone({ sections: template.sections });
    const input = createDynamicInput();
    input.questionTopics = [
      { questionId: "question-b-choice", topicIds: [secondTopicId] },
      { questionId: "question-z-choice", topicIds: [firstTopicId] },
    ];
    const expectedQuestionTopics = [
      { questionId: "question-z-choice", topicIds: [firstTopicId] },
      { questionId: "question-a-true-false", topicIds: [] },
      { questionId: "question-y-short-answer", topicIds: [] },
      { questionId: "question-b-choice", topicIds: [secondTopicId] },
    ];
    let persistedInput: SaveExamRecordInput | undefined;
    mocks.findExamStructureTemplateRecordById.mockResolvedValue(template);
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(2);
    mocks.createExamRecord.mockImplementation(
      async (examInput: SaveExamRecordInput, createdBy: string) => {
        persistedInput = examInput;
        return createStoredExam({ ...examInput, createdBy });
      },
    );

    const result = await createExam(admin, input, replacementPdfUpload);

    expect(mocks.findExamStructureTemplateRecordById).toHaveBeenCalledWith(
      structureTemplateId,
    );
    expect(mocks.createExamRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        structureTemplateId,
        structureSnapshot: expectedSnapshot,
        questionTopics: expectedQuestionTopics,
      }),
      admin.id,
      mocks.transactionSession,
    );
    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [firstTopicId, secondTopicId],
      mocks.transactionSession,
    );

    template.sections.reverse();
    template.sections[0].title = "Đã thay đổi";
    template.sections[0].questions.reverse();
    template.sections[0].questions[0].id = "mutated-question";

    expect(persistedInput?.structureSnapshot).toEqual(expectedSnapshot);
    expect(persistedInput?.questionTopics).toEqual(expectedQuestionTopics);
    expect(result.structureSnapshot).toEqual(expectedSnapshot);
    expect(result.questionTopics).toEqual(expectedQuestionTopics);
  });

  it("creates an ESSAY_IMAGE Exam without an automatic answer key", async () => {
    const template = createStructureTemplate({
      sections: [
        {
          id: "essay-section",
          title: "Phần tự luận hình ảnh",
          questions: [
            {
              id: "essay-image-question",
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              maxScoreHundredths: 1000,
            },
          ],
        },
      ],
    });
    const input = {
      ...createDynamicInput(template),
      status: EXAM_STATUS.PUBLISHED,
      answerKey: {
        answersByQuestionId: {},
      },
    } satisfies DynamicExamUpsertInput;
    mocks.findExamStructureTemplateRecordById.mockResolvedValue(template);
    mocks.verifyExamPdfAsset.mockResolvedValue(newPdf);
    mocks.createExamRecord.mockImplementation(
      async (examInput: SaveExamRecordInput, createdBy: string) =>
        createStoredExam({ ...examInput, createdBy }),
    );

    const result = await createExam(admin, input, replacementPdfUpload);

    expect(result.structureSnapshot).toEqual({ sections: template.sections });
    expect(result.answerKey).toEqual({ answersByQuestionId: {} });
    expect(mocks.verifyExamPdfAsset).toHaveBeenCalledWith(replacementPdfUpload);
    expect(mocks.createExamRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        structureSnapshot: { sections: template.sections },
        answerKey: { answersByQuestionId: {} },
      }),
      admin.id,
      mocks.transactionSession,
    );
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

  it("does not persist an Exam when Cloudinary PDF verification fails", async () => {
    const verificationError = Object.assign(
      new Error("Could not verify Cloudinary PDF"),
      { code: "PDF_UPLOAD_FAILED", statusCode: 502 },
    );
    mocks.verifyExamPdfAsset.mockRejectedValue(verificationError);
    mocks.discardExamPdfUpload.mockResolvedValue(undefined);

    await expect(
      createExam(admin, createValidInput(), replacementPdfUpload),
    ).rejects.toBe(verificationError);

    expect(mocks.verifyExamPdfAsset).toHaveBeenCalledWith(replacementPdfUpload);
    expect(mocks.withMongoTransaction).not.toHaveBeenCalled();
    expect(mocks.createExamRecord).not.toHaveBeenCalled();
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
      gradingStatus: string;
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
    expect(
      replacements.every(
        (replacement) =>
          replacement.gradingStatus === EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
      ),
    ).toBe(true);
    expect(replacements[0].grading.totalScoreHundredths).toBe(25);
    expect(replacements[1].grading.totalScoreHundredths).toBe(0);
  });

  it("corrects and dynamically regrades ID-keyed answers for a custom Exam", async () => {
    const structureSnapshot = createDynamicStructureSnapshot();
    const currentExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: createDynamicAnswerKey(),
    });
    const correctedAnswerKey = createDynamicAnswerKey("B");
    const correctedExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: correctedAnswerKey,
      answerKeyRevision: 2,
    });
    const answers: DynamicAttemptAnswers = {
      answersByQuestionId: {
        "question-b-choice": "D",
        "question-y-short-answer": ["0", ",", "5", null],
        "question-a-true-false": {
          a: true,
          b: false,
          c: true,
          d: false,
        },
        "question-z-choice": "B",
      },
    };
    const baseInput = createDynamicInput(structureSnapshot);
    const input: UpdateExamInput = {
      title: baseInput.title,
      description: baseInput.description,
      status: baseInput.status,
      visibilityMode: baseInput.visibilityMode,
      assignedStudentIds: baseInput.assignedStudentIds,
      part3InputMode: baseInput.part3InputMode,
      settings: baseInput.settings,
      answerKey: correctedAnswerKey,
      questionTopics: baseInput.questionTopics,
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    };
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockResolvedValue(correctedExam);
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      { id: "dynamic-attempt", answers },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockResolvedValue(1);

    const result = await editExam(
      admin,
      currentExam.id,
      input,
      undefined,
      true,
    );

    expect(result.answerKey).toEqual(correctedAnswerKey);
    expect(mocks.listTerminalExamAttemptRegradeSources).toHaveBeenCalledWith(
      currentExam.id,
      mocks.transactionSession,
      structureSnapshot,
    );
    expect(mocks.replaceTerminalExamAttemptGradings).toHaveBeenCalledWith(
      currentExam.id,
      [
        {
          attemptId: "dynamic-attempt",
          gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
          grading: {
            answerKeyRevision: 2,
            totalScoreHundredths: 1000,
            sectionScoresHundredths: {
              "section-z": 450,
              "section-a": 550,
            },
            questionsById: {
              "question-z-choice": {
                isCorrect: true,
                scoreHundredths: 250,
              },
              "question-a-true-false": {
                correctStatementCount: 4,
                scoreHundredths: 200,
                statements: { a: true, b: true, c: true, d: true },
              },
              "question-y-short-answer": {
                isCorrect: true,
                scoreHundredths: 300,
              },
              "question-b-choice": {
                isCorrect: true,
                scoreHundredths: 250,
              },
            },
          },
        },
      ],
      expect.any(Date),
      mocks.transactionSession,
    );
  });

  it("regrades the objective portion of an ESSAY_IMAGE Exam and keeps manual grading pending", async () => {
    const structureSnapshot = createEssayCorrectionStructureSnapshot();
    const currentAnswerKey = createEssayCorrectionAnswerKey();
    const correctedAnswerKey = createEssayCorrectionAnswerKey("B");
    const currentExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: currentAnswerKey,
    });
    const correctedExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: correctedAnswerKey,
      answerKeyRevision: 2,
    });
    const essayImage = {
      publicId: "essay-image",
      secureUrl:
        "https://res.cloudinary.com/test/image/upload/v1/essay-image.jpg",
      originalFilename: "essay-answer.jpg",
      bytes: 1024,
      format: "jpg" as const,
      width: 1200,
      height: 800,
    };
    const answers: DynamicAttemptAnswers = {
      answersByQuestionId: {
        "essay-image-question": {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: [essayImage],
        },
        "essay-choice-question": "B",
      },
    };
    const originalAnswers = structuredClone(answers);
    const input = createDynamicUpdateInput(
      currentExam,
      structureSnapshot,
      correctedAnswerKey,
    );
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockResolvedValue(correctedExam);
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      {
        id: "essay-attempt",
        answers,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: {
          ...gradeDynamicAttemptAnswers(
            answers,
            currentAnswerKey,
            structureSnapshot,
          ),
          manualEssayScores: [
            { questionId: "essay-image-question", scoreHundredths: 250 },
          ],
        },
      },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockResolvedValue(1);

    const result = await editExam(
      admin,
      currentExam.id,
      input,
      undefined,
      true,
    );

    expect(result.answerKey).toEqual(correctedAnswerKey);
    expect(mocks.updateExamAnswerKeyRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({ answerKey: correctedAnswerKey }),
      currentExam.updatedAt,
      1,
      2,
      mocks.transactionSession,
    );
    expect(mocks.listTerminalExamAttemptRegradeSources).toHaveBeenCalledWith(
      currentExam.id,
      mocks.transactionSession,
      structureSnapshot,
    );
    const replacements = mocks.replaceTerminalExamAttemptGradings.mock
      .calls[0][1] as Array<{
      attemptId: string;
      gradingStatus: string;
      grading: Record<string, unknown>;
    }>;
    expect(replacements).toEqual([
      {
        attemptId: "essay-attempt",
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: {
          answerKeyRevision: 2,
          objectiveScoreHundredths: 500,
          objectiveMaxScoreHundredths: 500,
          sectionScoresHundredths: { "essay-section": 500 },
          questionsById: {
            "essay-choice-question": {
              isCorrect: true,
              scoreHundredths: 500,
            },
          },
          manualEssayScores: [
            { questionId: "essay-image-question", scoreHundredths: 250 },
          ],
        },
      },
    ]);
    expect(replacements[0].grading).not.toHaveProperty("totalScoreHundredths");
    expect(replacements[0]).not.toHaveProperty("answers");
    expect(answers).toEqual(originalAnswers);
    expect(mocks.replaceTerminalExamAttemptGradings).toHaveBeenCalledWith(
      currentExam.id,
      replacements,
      expect.any(Date),
      mocks.transactionSession,
    );
  });

  it("preserves finalized essay scores and recalculates the total after an answer-key correction", async () => {
    const structureSnapshot = createEssayCorrectionStructureSnapshot();
    const currentAnswerKey = createEssayCorrectionAnswerKey();
    const correctedAnswerKey = createEssayCorrectionAnswerKey("B");
    const currentExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: currentAnswerKey,
    });
    const correctedExam = createStoredExam({
      ...currentExam,
      answerKey: correctedAnswerKey,
      answerKeyRevision: 2,
    });
    const answers: DynamicAttemptAnswers = {
      answersByQuestionId: {
        "essay-image-question": {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: [],
        },
        "essay-choice-question": "B",
      },
    };
    const completedGrading = applyManualEssayScores(
      gradeDynamicAttemptAnswers(answers, currentAnswerKey, structureSnapshot),
      structureSnapshot,
      [{ questionId: "essay-image-question", scoreHundredths: 250 }],
      true,
    );
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockResolvedValue(correctedExam);
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      {
        id: "completed-essay-attempt",
        answers,
        grading: completedGrading,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
      },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockResolvedValue(1);

    await editExam(
      admin,
      currentExam.id,
      createDynamicUpdateInput(
        currentExam,
        structureSnapshot,
        correctedAnswerKey,
      ),
      undefined,
      true,
    );

    const replacement =
      mocks.replaceTerminalExamAttemptGradings.mock.calls[0][1][0];
    expect(replacement).toMatchObject({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
      grading: {
        answerKeyRevision: 2,
        totalScoreHundredths: 750,
        manualEssayScores: [
          { questionId: "essay-image-question", scoreHundredths: 250 },
        ],
      },
    });
  });

  it("rolls back the corrected key and regrades when the transaction fails", async () => {
    const structureSnapshot = createEssayCorrectionStructureSnapshot();
    const currentAnswerKey = createEssayCorrectionAnswerKey();
    const correctedAnswerKey = createEssayCorrectionAnswerKey("B");
    const currentExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: currentAnswerKey,
    });
    const input = createDynamicUpdateInput(
      currentExam,
      structureSnapshot,
      correctedAnswerKey,
    );
    const answers: DynamicAttemptAnswers = {
      answersByQuestionId: {
        "essay-image-question": {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: [
            {
              publicId: "essay-image",
              secureUrl:
                "https://res.cloudinary.com/test/image/upload/v1/essay-image.jpg",
              originalFilename: "essay-answer.jpg",
              bytes: 1024,
              format: "jpg",
              width: 1200,
              height: 800,
            },
          ],
        },
        "essay-choice-question": "B",
      },
    };
    const originalGrading = {
      answerKeyRevision: 1,
      objectiveScoreHundredths: 0,
      objectiveMaxScoreHundredths: 500,
      sectionScoresHundredths: { "essay-section": 0 },
      questionsById: {
        "essay-choice-question": {
          isCorrect: false,
          scoreHundredths: 0,
        },
      },
    };
    const databaseState = {
      answerKey: structuredClone(currentExam.answerKey),
      answerKeyRevision: currentExam.answerKeyRevision,
      grading: structuredClone(originalGrading),
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      answers: structuredClone(answers),
    };
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.updateExamAnswerKeyRecord.mockImplementation(async () => {
      databaseState.answerKey = structuredClone(input.answerKey);
      databaseState.answerKeyRevision = 2;
      return createStoredExam({
        structureTemplateId,
        structureSnapshot,
        answerKey: input.answerKey,
        answerKeyRevision: 2,
      });
    });
    mocks.listTerminalExamAttemptRegradeSources.mockResolvedValue([
      {
        id: "submitted-attempt",
        answers,
        grading: originalGrading,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      },
    ]);
    mocks.replaceTerminalExamAttemptGradings.mockImplementation(async () => {
      databaseState.grading = {
        answerKeyRevision: 2,
        objectiveScoreHundredths: 500,
        objectiveMaxScoreHundredths: 500,
        sectionScoresHundredths: { "essay-section": 500 },
        questionsById: {
          "essay-choice-question": {
            isCorrect: true,
            scoreHundredths: 500,
          },
        },
      };
      databaseState.gradingStatus = EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL;
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
          databaseState.grading = snapshot.grading;
          databaseState.gradingStatus = snapshot.gradingStatus;
          databaseState.answers = snapshot.answers;
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
      grading: originalGrading,
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      answers,
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
    delete legacyInput.questionTopicIds;
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
        questionTopicIds: currentExam.questionTopicIds,
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

  it("updates question topics as metadata after attempts without touching grading", async () => {
    const currentExam = createStoredExam();
    const assignedStudentId = "64b000000000000000000001";
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = [firstTopicId, secondTopicId];
    questionTopicIds.partTwo[0] = [secondTopicId];
    questionTopicIds.partThree[0] = [firstTopicId];
    const input = {
      ...createValidInput(),
      title: "Đề thi thử Toán đã đổi tên",
      description: "Mô tả mới",
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: [assignedStudentId],
      questionTopicIds,
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
      questionTopicIds,
      settings: input.settings,
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.hasExamAttemptRecords.mockResolvedValue(true);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(2);
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
      questionTopicIds,
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
        questionTopicIds,
      },
      currentExam.updatedAt,
      mocks.transactionSession,
    );
    expect(mocks.reserveStudentsForExamAssignment).toHaveBeenCalledWith(
      [assignedStudentId],
      mocks.transactionSession,
    );
    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [firstTopicId, secondTopicId],
      mocks.transactionSession,
    );
    expect(mocks.updateExamMetadataRecord.mock.calls[0][1]).not.toHaveProperty(
      "answerKeyRevision",
    );
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.updateExamAnswerKeyRecord).not.toHaveBeenCalled();
    expect(mocks.listTerminalExamAttemptRegradeSources).not.toHaveBeenCalled();
    expect(mocks.replaceTerminalExamAttemptGradings).not.toHaveBeenCalled();
  });

  it("updates dynamic Topics as metadata after attempts without changing grading revision", async () => {
    const structureSnapshot = createDynamicStructureSnapshot();
    const currentExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: createDynamicAnswerKey(),
      questionTopics: createEmptyQuestionTopics(structureSnapshot),
      attemptsStarted: true,
    });
    const baseInput = createDynamicInput(structureSnapshot);
    const input: UpdateExamInput = {
      title: baseInput.title,
      description: baseInput.description,
      status: baseInput.status,
      visibilityMode: baseInput.visibilityMode,
      assignedStudentIds: baseInput.assignedStudentIds,
      part3InputMode: baseInput.part3InputMode,
      settings: baseInput.settings,
      answerKey: baseInput.answerKey,
      questionTopics: [
        { questionId: "question-b-choice", topicIds: [secondTopicId] },
        { questionId: "question-z-choice", topicIds: [firstTopicId] },
      ],
      expectedUpdatedAt: currentExam.updatedAt.toISOString(),
    };
    const expectedQuestionTopics = [
      { questionId: "question-z-choice", topicIds: [firstTopicId] },
      { questionId: "question-a-true-false", topicIds: [] },
      { questionId: "question-y-short-answer", topicIds: [] },
      { questionId: "question-b-choice", topicIds: [secondTopicId] },
    ];
    const updatedExam = createStoredExam({
      structureTemplateId,
      structureSnapshot,
      answerKey: createDynamicAnswerKey(),
      questionTopics: expectedQuestionTopics,
      attemptsStarted: true,
    });
    mocks.findExamRecordById.mockResolvedValue(currentExam);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(2);
    mocks.updateExamMetadataRecord.mockResolvedValue(updatedExam);

    const result = await editExam(admin, currentExam.id, input);

    expect(result.questionTopics).toEqual(expectedQuestionTopics);
    expect(result.hasAttempts).toBe(true);
    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [firstTopicId, secondTopicId],
      mocks.transactionSession,
    );
    expect(mocks.updateExamMetadataRecord).toHaveBeenCalledWith(
      currentExam.id,
      expect.objectContaining({
        questionTopicIds: currentExam.questionTopicIds,
        questionTopics: expectedQuestionTopics,
      }),
      currentExam.updatedAt,
      mocks.transactionSession,
    );
    expect(mocks.updateExamMetadataRecord.mock.calls[0][1]).not.toHaveProperty(
      "answerKeyRevision",
    );
    expect(mocks.updateExamRecord).not.toHaveBeenCalled();
    expect(mocks.updateExamAnswerKeyRecord).not.toHaveBeenCalled();
    expect(mocks.listTerminalExamAttemptRegradeSources).not.toHaveBeenCalled();
    expect(mocks.replaceTerminalExamAttemptGradings).not.toHaveBeenCalled();
  });
});
