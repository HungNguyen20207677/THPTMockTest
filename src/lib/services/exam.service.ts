import "server-only";

import type { ClientSession } from "mongoose";

import {
  assertAuthenticExamPdfUploadReference,
  assertValidExamPdfUploadReference,
  createExamPdfUploadTicket,
  deleteExamPdf,
  discardExamPdfUpload,
  verifyExamPdfAsset,
} from "@/lib/cloudinary/exam-pdf";
import { EXAM_STATUS, EXAM_VISIBILITY_MODE } from "@/lib/constants/exam";
import { EXAM_ATTEMPT_GRADING_STATUS } from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { USER_ROLE } from "@/lib/constants/roles";
import { findExamStructureTemplateRecordById } from "@/lib/db/dao/exam-structure-template.dao";
import {
  deleteExamAttemptRecordsByExamId,
  findExamIdsWithAttemptRecords,
  hasExamAttemptRecords,
  listTerminalExamAttemptRegradeSources,
  replaceTerminalExamAttemptGradings,
} from "@/lib/db/dao/exam-attempt.dao";
import {
  acquireExamPdfOperationLease,
  createExamRecord,
  deleteExamRecord,
  findExamRecordById,
  findExamRecordByPdfPublicId,
  listExamRecords,
  releaseExamPdfOperationLease,
  updateExamAnswerKeyRecord,
  updateExamRecord,
  updateExamMetadataRecord,
  updateExamRecordStatus,
  type ExamPdfOperationLease,
  type ExamPersistenceRecord,
  type SaveExamRecordInput,
} from "@/lib/db/dao/exam.dao";
import { reserveTopicRecordsByIds } from "@/lib/db/dao/topic.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { withMongoTransaction } from "@/lib/db/mongoose";
import { reserveStudentsForExamAssignment } from "@/lib/db/dao/user.dao";
import { areExamAnswerKeysEqual } from "@/lib/exam/answer-key";
import {
  hasFinalTotalScore,
  regradeExamAttemptAnswersPreservingManualScores,
} from "@/lib/exam/grading";
import {
  createEmptyQuestionTopicIds,
  getUniqueExamTopicIds,
} from "@/lib/exam/question-topics";
import {
  createExamStructureSnapshot,
  examStructureContainsQuestionType,
} from "@/lib/exam/structure";
import {
  ExamAnswerKeyConfirmationRequiredError,
  ExamConflictError,
  ExamContentLockedError,
  ExamNotFoundError,
  ExamPdfAlreadyAttachedError,
  ExamPdfOperationConflictError,
  ExamPublicationError,
  ExamStructureTemplateNotFoundError,
  ForbiddenError,
  RequestValidationError,
} from "@/lib/errors/app-error";
import {
  createDynamicExamAnswerKeySchema,
  createDynamicExamQuestionTopicsSchema,
  examAnswerKeySchema,
  examPdfSchema,
  part3InputModeSchema,
  type CreateExamInput,
  type UpdateExamInput,
  type UpsertExamInput,
} from "@/lib/validations/exam";
import type {
  AnyExamAnswerKey,
  ExamDetail,
  ExamPdf,
  ExamPdfUploadReference,
  ExamPdfUploadTicket,
  ExamQuestionTopic,
  ExamQuestionTopicIds,
  ExamStatus,
  ExamSummary,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
import type { AppUser } from "@/types/user";
import type { ExamPdfUploadIntent } from "@/lib/validations/exam-pdf";
import { examStructureSnapshotSchema } from "@/lib/validations/exam-structure-template";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toExamSummary(
  exam: ExamPersistenceRecord,
  hasAttempts: boolean,
): ExamSummary {
  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    visibilityMode: exam.visibilityMode,
    assignedStudentCount: exam.assignedStudentIds.length,
    settings: exam.settings,
    hasAttempts: hasAttempts || exam.attemptsStarted,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  };
}

function toExamDetail(
  exam: ExamPersistenceRecord,
  hasAttempts: boolean,
): ExamDetail {
  return {
    ...toExamSummary(exam, hasAttempts),
    description: exam.description,
    assignedStudentIds: exam.assignedStudentIds,
    part3InputMode: exam.part3InputMode,
    ...(exam.structureSnapshot
      ? { shortAnswerInputMode: exam.part3InputMode }
      : {}),
    ...(exam.structureTemplateId
      ? { structureTemplateId: exam.structureTemplateId }
      : {}),
    ...(exam.structureSnapshot
      ? { structureSnapshot: exam.structureSnapshot }
      : {}),
    pdf: exam.pdf,
    answerKey: exam.answerKey,
    questionTopicIds: exam.questionTopicIds,
    ...(exam.questionTopics ? { questionTopics: exam.questionTopics } : {}),
  };
}

type ExamAssignment = Pick<
  UpsertExamInput,
  "visibilityMode" | "assignedStudentIds"
>;

function normalizeExamAssignment(
  input: Pick<UpsertExamInput, "visibilityMode" | "assignedStudentIds">,
): ExamAssignment {
  const assignedStudentIds =
    input.visibilityMode === EXAM_VISIBILITY_MODE.SELECTED_STUDENTS
      ? [...new Set(input.assignedStudentIds)]
      : [];

  return {
    visibilityMode: input.visibilityMode,
    assignedStudentIds,
  };
}

async function reserveExamAssignment(
  assignment: ExamAssignment,
  session: ClientSession,
): Promise<void> {
  if (
    assignment.assignedStudentIds.length > 0 &&
    !(await reserveStudentsForExamAssignment(
      assignment.assignedStudentIds,
      session,
    ))
  ) {
    throw new RequestValidationError(
      "Danh sách phân công chỉ được chứa tài khoản học sinh.",
    );
  }
}

async function assertExamTopicsExist(
  source: {
    questionTopicIds: ExamQuestionTopicIds;
    questionTopics?: ExamQuestionTopic[];
    structureSnapshot?: ExamStructureSnapshot;
  },
  session: ClientSession,
): Promise<void> {
  const topicIds = getUniqueExamTopicIds(source);

  if (
    topicIds.length > 0 &&
    (await reserveTopicRecordsByIds(topicIds, session)) !== topicIds.length
  ) {
    throw new RequestValidationError(
      "Một hoặc nhiều chủ đề được chọn không tồn tại.",
    );
  }
}

function normalizeDynamicQuestionTopics(
  questionTopics: ExamQuestionTopic[],
  structure: ExamStructureSnapshot,
): ExamQuestionTopic[] {
  const parsed =
    createDynamicExamQuestionTopicsSchema(structure).safeParse(questionTopics);

  if (!parsed.success) {
    throw new RequestValidationError(
      parsed.error.issues[0]?.message ??
        "Danh sách chủ đề của câu hỏi không hợp lệ.",
    );
  }

  return parsed.data;
}

function getAnswerKeyValidationError(
  answerKey: AnyExamAnswerKey,
  structure?: ExamStructureSnapshot,
): string | null {
  const parsed = structure
    ? createDynamicExamAnswerKeySchema(structure).safeParse(answerKey)
    : examAnswerKeySchema.safeParse(answerKey);
  return parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? "Đáp án đề thi không hợp lệ.");
}

function assertAnswerKeyMatchesStructure(
  answerKey: AnyExamAnswerKey,
  structure?: ExamStructureSnapshot,
): void {
  const validationError = getAnswerKeyValidationError(answerKey, structure);

  if (validationError) {
    throw new RequestValidationError(validationError);
  }
}

export function assertExamCanBePublished(input: {
  title: string;
  part3InputMode: ExamPersistenceRecord["part3InputMode"];
  pdf: ExamPdf;
  answerKey: ExamPersistenceRecord["answerKey"];
  structureSnapshot?: ExamStructureSnapshot;
}): void {
  const baseIsValid =
    typeof input.title === "string" &&
    input.title.trim().length >= 3 &&
    input.title.trim().length <= 150 &&
    part3InputModeSchema.safeParse(input.part3InputMode).success &&
    examPdfSchema.safeParse(input.pdf).success;
  const answerKeyIsValid =
    getAnswerKeyValidationError(input.answerKey, input.structureSnapshot) ===
    null;

  if (!baseIsValid || !answerKeyIsValid) {
    throw new ExamPublicationError();
  }
}

async function deletePdfBestEffort(publicId: string): Promise<void> {
  try {
    await deleteExamPdf(publicId);
  } catch (error) {
    console.error("Could not delete a Cloudinary PDF.", {
      publicId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function assertPdfUploadIsUnclaimed(
  reference: ExamPdfUploadReference,
): Promise<void> {
  if (await findExamRecordByPdfPublicId(reference.publicId)) {
    throw new ExamPdfAlreadyAttachedError();
  }
}

async function acquirePdfOperationLeases(
  publicIds: string[],
): Promise<ExamPdfOperationLease[]> {
  const leases: ExamPdfOperationLease[] = [];

  try {
    for (const publicId of [...new Set(publicIds)].sort()) {
      const lease = await acquireExamPdfOperationLease(publicId);

      if (!lease) {
        throw new ExamPdfOperationConflictError();
      }

      leases.push(lease);
    }

    return leases;
  } catch (error) {
    await releasePdfOperationLeasesBestEffort(leases);
    throw error;
  }
}

async function acquirePdfUploadLeases(
  reference: ExamPdfUploadReference,
  additionalPublicIds: string[] = [],
): Promise<ExamPdfOperationLease[]> {
  assertAuthenticExamPdfUploadReference(reference);
  return acquirePdfOperationLeases([
    reference.publicId,
    ...additionalPublicIds,
  ]);
}

async function releasePdfOperationLeasesBestEffort(
  leases: ExamPdfOperationLease[],
): Promise<void> {
  for (const lease of [...leases].reverse()) {
    try {
      await releaseExamPdfOperationLease(lease);
    } catch {
      // The lease expires automatically if MongoDB cannot release it now.
    }
  }
}

async function discardPdfUploadWhileLeasedBestEffort(
  reference: ExamPdfUploadReference,
): Promise<void> {
  try {
    if (!(await findExamRecordByPdfPublicId(reference.publicId))) {
      await discardExamPdfUpload(reference);
    }
  } catch {
    // Cleanup must not replace the original validation or persistence error.
  }
}

async function discardUnclaimedExamPdfUploadRecord(
  reference: ExamPdfUploadReference,
): Promise<void> {
  assertAuthenticExamPdfUploadReference(reference);
  const leases = await acquirePdfOperationLeases([reference.publicId]);

  try {
    if (await findExamRecordByPdfPublicId(reference.publicId)) {
      return;
    }

    await discardExamPdfUpload(reference);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}

export async function discardUnclaimedExamPdfUpload(
  actor: AppUser,
  reference: ExamPdfUploadReference,
): Promise<void> {
  assertAdmin(actor);
  await discardUnclaimedExamPdfUploadRecord(reference);
}

async function discardPdfUploadBestEffort(
  reference: ExamPdfUploadReference,
): Promise<void> {
  try {
    await discardUnclaimedExamPdfUploadRecord(reference);
  } catch {
    // Cleanup must not replace the original validation or persistence error.
  }
}

function normalizePdfOwnershipError(error: unknown): unknown {
  return isMongoDuplicateKeyError(error)
    ? new ExamPdfAlreadyAttachedError()
    : error;
}

export async function listExams(actor: AppUser): Promise<ExamSummary[]> {
  assertAdmin(actor);
  const exams = await listExamRecords();
  const examIdsWithAttempts = await findExamIdsWithAttemptRecords(
    exams.map((exam) => exam.id),
  );
  return exams.map((exam) =>
    toExamSummary(exam, examIdsWithAttempts.has(exam.id)),
  );
}

export async function getExam(
  actor: AppUser,
  examId: string,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const exam = await findExamRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  return toExamDetail(exam, await hasExamAttemptRecords(examId));
}

export function issueExamPdfUploadTicket(
  actor: AppUser,
  intent: ExamPdfUploadIntent,
): ExamPdfUploadTicket {
  assertAdmin(actor);
  return createExamPdfUploadTicket(intent);
}

export async function createExam(
  actor: AppUser,
  input: CreateExamInput,
  pdfUpload: ExamPdfUploadReference,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const leases = await acquirePdfUploadLeases(pdfUpload);

  try {
    assertValidExamPdfUploadReference(pdfUpload);
    await assertPdfUploadIsUnclaimed(pdfUpload);
    let structureSnapshot: ExamStructureSnapshot | undefined;

    if ("structureTemplateId" in input) {
      const template = await findExamStructureTemplateRecordById(
        input.structureTemplateId,
      );

      if (!template) {
        throw new ExamStructureTemplateNotFoundError();
      }

      structureSnapshot = examStructureSnapshotSchema.parse(
        createExamStructureSnapshot(template),
      );
    }

    assertAnswerKeyMatchesStructure(input.answerKey, structureSnapshot);
    let examInput: Omit<SaveExamRecordInput, "pdf">;

    if ("structureTemplateId" in input) {
      if (!structureSnapshot) {
        throw new ExamStructureTemplateNotFoundError();
      }

      examInput = {
        ...input,
        ...normalizeExamAssignment(input),
        questionTopicIds: createEmptyQuestionTopicIds(),
        questionTopics: normalizeDynamicQuestionTopics(
          input.questionTopics,
          structureSnapshot,
        ),
        structureSnapshot,
      };
    } else {
      examInput = {
        ...input,
        ...normalizeExamAssignment(input),
      };
    }
    const pdf = await verifyExamPdfAsset(pdfUpload);

    if (examInput.status === EXAM_STATUS.PUBLISHED) {
      assertExamCanBePublished({
        title: examInput.title,
        part3InputMode: examInput.part3InputMode,
        pdf,
        answerKey: examInput.answerKey,
        structureSnapshot,
      });
    }

    const exam = await withMongoTransaction(async (session) => {
      await reserveExamAssignment(examInput, session);
      await assertExamTopicsExist(examInput, session);
      return createExamRecord({ ...examInput, pdf }, actor.id, session);
    });
    return toExamDetail(exam, false);
  } catch (error) {
    await discardPdfUploadWhileLeasedBestEffort(pdfUpload);
    throw normalizePdfOwnershipError(error);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}

export async function editExam(
  actor: AppUser,
  examId: string,
  input: UpdateExamInput,
  replacementPdfUpload?: ExamPdfUploadReference,
  confirmAnswerKeyCorrection = false,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    if (replacementPdfUpload) {
      await discardPdfUploadBestEffort(replacementPdfUpload);
    }

    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    if (replacementPdfUpload) {
      await discardPdfUploadBestEffort(replacementPdfUpload);
    }

    throw new ExamConflictError();
  }

  const answerKeyValidationError = getAnswerKeyValidationError(
    input.answerKey,
    currentExam.structureSnapshot,
  );

  if (answerKeyValidationError) {
    if (replacementPdfUpload) {
      await discardPdfUploadBestEffort(replacementPdfUpload);
    }

    throw new RequestValidationError(answerKeyValidationError);
  }

  const hasAttempts =
    currentExam.attemptsStarted || (await hasExamAttemptRecords(examId));
  const answerKeyChanged = !areExamAnswerKeysEqual(
    currentExam.answerKey,
    input.answerKey,
  );
  const part3InputModeChanged =
    currentExam.part3InputMode !== input.part3InputMode;

  if (hasAttempts && (replacementPdfUpload || part3InputModeChanged)) {
    if (replacementPdfUpload) {
      await discardPdfUploadBestEffort(replacementPdfUpload);
    }

    throw new ExamContentLockedError();
  }

  if (hasAttempts && answerKeyChanged && !confirmAnswerKeyCorrection) {
    throw new ExamAnswerKeyConfirmationRequiredError();
  }

  const requestedAssignment =
    input.visibilityMode === undefined && input.assignedStudentIds === undefined
      ? {
          visibilityMode: currentExam.visibilityMode,
          assignedStudentIds: currentExam.assignedStudentIds,
        }
      : {
          visibilityMode: input.visibilityMode ?? currentExam.visibilityMode,
          assignedStudentIds: input.assignedStudentIds ?? [],
        };
  const assignment = normalizeExamAssignment(requestedAssignment);
  let questionTopicIds = currentExam.questionTopicIds;
  let questionTopics = currentExam.questionTopics;

  if (currentExam.structureSnapshot) {
    if (input.questionTopicIds !== undefined) {
      throw new RequestValidationError(
        "Đề thi động phải gắn chủ đề theo mã câu hỏi.",
      );
    }

    questionTopics = normalizeDynamicQuestionTopics(
      input.questionTopics ?? questionTopics ?? [],
      currentExam.structureSnapshot,
    );
  } else {
    if (input.questionTopics !== undefined) {
      throw new RequestValidationError(
        "Đề thi cũ phải gắn chủ đề theo cấu trúc cố định.",
      );
    }

    questionTopicIds = input.questionTopicIds ?? questionTopicIds;
  }

  const topicMetadata = currentExam.structureSnapshot
    ? { questionTopicIds, questionTopics }
    : { questionTopicIds };

  const examInput = {
    title: input.title,
    description: input.description,
    status: input.status,
    ...assignment,
    part3InputMode: input.part3InputMode,
    settings: input.settings,
    answerKey: input.answerKey,
    ...topicMetadata,
  };
  const replacementLeases = replacementPdfUpload
    ? await acquirePdfUploadLeases(replacementPdfUpload, [
        currentExam.pdf.publicId,
      ])
    : [];

  try {
    if (replacementPdfUpload) {
      assertValidExamPdfUploadReference(replacementPdfUpload);
      await assertPdfUploadIsUnclaimed(replacementPdfUpload);
    }

    const newPdf = replacementPdfUpload
      ? await verifyExamPdfAsset(replacementPdfUpload)
      : currentExam.pdf;

    if (examInput.status === EXAM_STATUS.PUBLISHED) {
      assertExamCanBePublished({
        title: examInput.title,
        part3InputMode: examInput.part3InputMode,
        pdf: newPdf,
        answerKey: examInput.answerKey,
        structureSnapshot: currentExam.structureSnapshot,
      });
    }

    const nextAnswerKeyRevision = answerKeyChanged
      ? currentExam.answerKeyRevision + 1
      : currentExam.answerKeyRevision;
    const updatedExam = await withMongoTransaction(async (session) => {
      await reserveExamAssignment(assignment, session);
      await assertExamTopicsExist(
        {
          ...topicMetadata,
          structureSnapshot: currentExam.structureSnapshot,
        },
        session,
      );

      if (hasAttempts && answerKeyChanged) {
        const correctedExam = await updateExamAnswerKeyRecord(
          examId,
          {
            title: examInput.title,
            description: examInput.description,
            status: examInput.status,
            visibilityMode: examInput.visibilityMode,
            assignedStudentIds: examInput.assignedStudentIds,
            settings: examInput.settings,
            answerKey: examInput.answerKey,
            ...topicMetadata,
          },
          currentExam.updatedAt,
          currentExam.answerKeyRevision,
          nextAnswerKeyRevision,
          session,
        );

        if (!correctedExam) {
          throw new ExamConflictError();
        }

        const regradeSources = currentExam.structureSnapshot
          ? await listTerminalExamAttemptRegradeSources(
              examId,
              session,
              currentExam.structureSnapshot,
            )
          : await listTerminalExamAttemptRegradeSources(examId, session);
        const gradedAt = new Date();
        const hasEssayImage = Boolean(
          correctedExam.structureSnapshot &&
          examStructureContainsQuestionType(
            correctedExam.structureSnapshot,
            EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          ),
        );
        const replacements = regradeSources.map((attempt) => {
          const previousGradingStatus =
            attempt.gradingStatus ??
            (attempt.grading && hasFinalTotalScore(attempt.grading)
              ? EXAM_ATTEMPT_GRADING_STATUS.COMPLETED
              : hasEssayImage
                ? EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL
                : EXAM_ATTEMPT_GRADING_STATUS.COMPLETED);

          return {
            attemptId: attempt.id,
            gradingStatus: hasEssayImage
              ? previousGradingStatus
              : EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
            grading: regradeExamAttemptAnswersPreservingManualScores(
              attempt.answers,
              correctedExam.answerKey,
              correctedExam.answerKeyRevision,
              correctedExam.structureSnapshot,
              attempt.grading,
              hasEssayImage &&
                previousGradingStatus === EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
            ),
          };
        });
        const matchedCount = await replaceTerminalExamAttemptGradings(
          examId,
          replacements,
          gradedAt,
          session,
        );

        if (matchedCount !== replacements.length) {
          throw new ExamConflictError();
        }

        return correctedExam;
      }

      if (hasAttempts) {
        return updateExamMetadataRecord(
          examId,
          {
            title: examInput.title,
            description: examInput.description,
            status: examInput.status,
            visibilityMode: examInput.visibilityMode,
            assignedStudentIds: examInput.assignedStudentIds,
            settings: examInput.settings,
            ...topicMetadata,
          },
          currentExam.updatedAt,
          session,
        );
      }

      return updateExamRecord(
        examId,
        { ...examInput, pdf: newPdf },
        currentExam.updatedAt,
        nextAnswerKeyRevision,
        session,
      );
    });

    if (!updatedExam) {
      throw new ExamConflictError();
    }

    if (replacementPdfUpload && currentExam.pdf.publicId !== newPdf.publicId) {
      await deletePdfBestEffort(currentExam.pdf.publicId);
    }

    return toExamDetail(updatedExam, hasAttempts);
  } catch (error) {
    if (replacementPdfUpload) {
      await discardPdfUploadWhileLeasedBestEffort(replacementPdfUpload);
    }

    throw normalizePdfOwnershipError(error);
  } finally {
    await releasePdfOperationLeasesBestEffort(replacementLeases);
  }
}

export async function changeExamStatus(
  actor: AppUser,
  examId: string,
  status: ExamStatus,
  expectedUpdatedAt: string,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new ExamConflictError();
  }

  if (status === EXAM_STATUS.PUBLISHED) {
    assertExamCanBePublished(currentExam);
  }

  const updatedExam = await withMongoTransaction(async (session) => {
    if (status === EXAM_STATUS.PUBLISHED) {
      await reserveExamAssignment(currentExam, session);
    }

    return updateExamRecordStatus(
      examId,
      status,
      currentExam.updatedAt,
      session,
    );
  });

  if (!updatedExam) {
    throw new ExamConflictError();
  }

  return toExamDetail(
    updatedExam,
    updatedExam.attemptsStarted || (await hasExamAttemptRecords(examId)),
  );
}

export async function deleteExam(
  actor: AppUser,
  examId: string,
  expectedUpdatedAt: string,
): Promise<void> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new ExamConflictError();
  }

  const leases = await acquirePdfOperationLeases([currentExam.pdf.publicId]);

  try {
    const deletedExam = await withMongoTransaction(async (session) => {
      await deleteExamAttemptRecordsByExamId(examId, session);
      const deleted = await deleteExamRecord(
        examId,
        currentExam.updatedAt,
        session,
      );

      if (!deleted) {
        throw new ExamConflictError();
      }

      return deleted;
    });

    await deletePdfBestEffort(deletedExam.pdf.publicId);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}
