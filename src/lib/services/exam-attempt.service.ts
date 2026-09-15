import "server-only";

import {
  ESSAY_IMAGE_MAX_COUNT,
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
  STUDENT_EXAM_STATE,
  TERMINAL_EXAM_ATTEMPT_STATUSES,
} from "@/lib/constants/exam-attempt";
import { EXAM_STATUS, EXAM_STRUCTURE } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  attachEssayImageToOwnedActiveExamAttempt,
  autoSubmitExpiredExamAttemptRecord,
  createExamAttemptRecord,
  findActiveExamAttemptRecord,
  findExamAttemptRecordById,
  findLatestExamAttemptRecord,
  findOwnedExamAttemptRecord,
  listAllExamAttemptRecordsForStudent,
  removeEssayImageFromOwnedActiveExamAttempt,
  saveOwnedActiveExamAttemptAnswers,
  setTerminalManualEssayGrading,
  setOwnedTerminalExamAttemptGradingForRevision,
  submitOwnedActiveExamAttempt,
  type ExamAttemptPersistenceRecord,
} from "@/lib/db/dao/exam-attempt.dao";
import {
  createEssayImageUploadTicket,
  deleteEssayImage,
  verifyEssayImageAsset,
} from "@/lib/cloudinary/essay-image";
import {
  findExamGradingRecordById,
  findStudentExamRecordById,
  isPublishedExamAvailableToStudent,
  listPublishedStudentExamRecords,
  listStudentExamRecordsByIds,
  markExamAttemptsStarted,
  reserveExamForAttemptCreation,
  reserveExamForAttemptGrading,
  type ExamGradingPersistenceRecord,
  type StudentExamWorkspacePersistenceRecord,
} from "@/lib/db/dao/exam.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import {
  markStudentAttemptsStarted,
  reserveStudentForAttemptCreation,
} from "@/lib/db/dao/user.dao";
import { withMongoTransaction } from "@/lib/db/mongoose";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { examStructureContainsQuestionType } from "@/lib/exam/structure";
import {
  applyManualEssayScores,
  gradeExamAttemptAnswers,
  getCanonicalManualEssayScores,
  hasFinalTotalScore,
  isDynamicAttemptGradingSnapshot,
  regradeExamAttemptAnswersPreservingManualScores,
  scoreHundredthsToPoints,
} from "@/lib/exam/grading";
import {
  createAttemptAnswersSchemaForStructure,
  examAttemptAnswersSchema,
  isDynamicAttemptAnswers,
} from "@/lib/validations/attempt-answers";
import {
  normalizeCanonicalShortAnswer,
  shortAnswerSlotsToDisplayValue,
} from "@/lib/exam/short-answer";
import {
  ExamAttemptConflictError,
  ExamAttemptLockedError,
  ExamAttemptNotFoundError,
  ExamAttemptResultUnavailableError,
  ExamAttemptStateConflictError,
  ExamNotFoundError,
  ExamNotPublishedError,
  ExamRetakeNotAllowedError,
  ForbiddenError,
  EssayImageAlreadyAttachedError,
  EssayImageLimitError,
  EssayImageNotFoundError,
  EssayImageQuestionNotFoundError,
  ManualEssayGradingValidationError,
} from "@/lib/errors/app-error";
import type {
  AttemptPartTwoAnswer,
  DynamicAttemptAnswers,
  DynamicAttemptGradingSnapshot,
  DynamicQuestionAnswerReview,
  ExamAttempt,
  ExamAttemptAnswers,
  ExamAttemptGradingStatus,
  EssayImage,
  EssayImageAnswer,
  EssayImageUploadReference,
  EssayImageUploadTicket,
  StudentExamAttemptContext,
  StudentExamAttemptResult,
  StudentExamList,
  StudentExamAttemptMutationResult,
  StudentExamState,
  StudentExamSummary,
} from "@/types/exam-attempt";
import { isDynamicExamAnswerKey } from "@/lib/exam/answer-key";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type {
  DynamicExamAnswerKey,
  PartOneAnswer,
  PartTwoAnswer,
  ShortAnswerSlots,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
import type { AppUser } from "@/types/user";
import type { EssayImageUploadIntent } from "@/lib/validations/essay-image";
import type { ManualEssayGradingRequest } from "@/lib/validations/attempt-grading";

const ATTEMPT_DURATION_MS = EXAM_STRUCTURE.durationMinutes * 60 * 1000;
const START_ATTEMPT_MAX_RETRIES = 3;
const ESSAY_IMAGE_MUTATION_MAX_RETRIES = 3;

class AttemptFinalizationRaceError extends Error {}
const EXAM_STATE_ORDER: Record<StudentExamState, number> = {
  [STUDENT_EXAM_STATE.IN_PROGRESS]: 0,
  [STUDENT_EXAM_STATE.NOT_STARTED]: 1,
  [STUDENT_EXAM_STATE.COMPLETED]: 2,
};

function assertStudent(actor: AppUser): void {
  if (actor.role !== USER_ROLE.STUDENT) {
    throw new ForbiddenError();
  }
}

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function structureContainsEssayImage(
  structure?: ExamStructureSnapshot,
): boolean {
  return Boolean(
    structure &&
    examStructureContainsQuestionType(
      structure,
      EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
    ),
  );
}

function getGradingStatusForStructure(
  structure?: ExamStructureSnapshot,
): ExamAttemptGradingStatus {
  return structureContainsEssayImage(structure)
    ? EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL
    : EXAM_ATTEMPT_GRADING_STATUS.COMPLETED;
}

export function getExamAttemptGradingStatus(
  attempt: Pick<ExamAttemptPersistenceRecord, "gradingStatus">,
): ExamAttemptGradingStatus {
  return attempt.gradingStatus ?? EXAM_ATTEMPT_GRADING_STATUS.COMPLETED;
}

function getEssayImageQuestionIds(structure?: ExamStructureSnapshot): string[] {
  return (
    structure?.sections.flatMap((section) =>
      section.questions
        .filter(
          (question) =>
            question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        )
        .map((question) => question.id),
    ) ?? []
  );
}

function validateAnswersPreservingEssayImages(
  incomingAnswers: ExamAttemptAnswers,
  persistedAnswers: ExamAttemptAnswers,
  structure?: ExamStructureSnapshot,
): ExamAttemptAnswers {
  const essayQuestionIds = getEssayImageQuestionIds(structure);

  if (
    essayQuestionIds.length === 0 ||
    !isDynamicAttemptAnswers(incomingAnswers) ||
    !isDynamicAttemptAnswers(persistedAnswers)
  ) {
    return createAttemptAnswersSchemaForStructure(structure).parse(
      incomingAnswers,
    ) as ExamAttemptAnswers;
  }

  const answersByQuestionId = {
    ...incomingAnswers.answersByQuestionId,
  };

  for (const questionId of essayQuestionIds) {
    answersByQuestionId[questionId] =
      persistedAnswers.answersByQuestionId[questionId];
  }

  return createAttemptAnswersSchemaForStructure(structure).parse({
    answersByQuestionId,
  }) as ExamAttemptAnswers;
}

function getAttemptAnswers(
  attempt: ExamAttemptPersistenceRecord,
  structure?: ExamStructureSnapshot,
): ExamAttemptAnswers {
  const answers =
    attempt.answers ??
    (structure
      ? createEmptyAttemptAnswers(structure)
      : createEmptyAttemptAnswers());
  if (!structure && isDynamicAttemptAnswers(answers)) {
    return examAttemptAnswersSchema.parse(answers);
  }

  return createAttemptAnswersSchemaForStructure(structure).parse(
    answers,
  ) as ExamAttemptAnswers;
}

function toExamAttempt(
  attempt: ExamAttemptPersistenceRecord,
  structure?: ExamStructureSnapshot,
): ExamAttempt {
  return {
    id: attempt.id,
    examId: attempt.examId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString(),
    lastSavedAt: attempt.lastSavedAt?.toISOString(),
    answers: getAttemptAnswers(attempt, structure),
  };
}

function toAttemptContext(
  exam: StudentExamWorkspacePersistenceRecord,
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
): StudentExamAttemptContext {
  return {
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      pdf: {
        url: exam.pdf.secureUrl,
        filename: exam.pdf.originalFilename,
      },
      durationMinutes: EXAM_STRUCTURE.durationMinutes,
      part3InputMode: exam.part3InputMode,
      ...(exam.structureSnapshot
        ? {
            shortAnswerInputMode: exam.part3InputMode,
            structureSnapshot: exam.structureSnapshot,
          }
        : {}),
    },
    attempt: toExamAttempt(attempt, exam.structureSnapshot),
    serverNow: serverNow.toISOString(),
    canEditAnswers: isValidActiveAttempt(attempt, serverNow),
  };
}

function toAttemptMutationResult(
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
  structure?: ExamStructureSnapshot,
): StudentExamAttemptMutationResult {
  return {
    attempt: toExamAttempt(attempt, structure),
    serverNow: serverNow.toISOString(),
    canEditAnswers: isValidActiveAttempt(attempt, serverNow),
  };
}

export async function resolveAttemptExpiration(
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
  retryCount = 0,
): Promise<ExamAttemptPersistenceRecord> {
  if (
    attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS ||
    serverNow.getTime() < attempt.expiresAt.getTime()
  ) {
    return attempt;
  }

  let autoSubmittedAttempt: ExamAttemptPersistenceRecord | null = null;

  try {
    autoSubmittedAttempt = await withMongoTransaction(async (session) => {
      const exam = await reserveExamForAttemptGrading(attempt.examId, session);

      if (!exam) {
        throw new ExamNotFoundError();
      }

      const grading = gradeExamAttemptAnswers(
        getAttemptAnswers(attempt, exam.structureSnapshot),
        exam.answerKey,
        exam.answerKeyRevision,
        exam.structureSnapshot,
      );
      const gradingStatus = getGradingStatusForStructure(
        exam.structureSnapshot,
      );
      const finalizedAttempt = await autoSubmitExpiredExamAttemptRecord(
        attempt.id,
        attempt.studentId,
        attempt.examId,
        attempt.answerRevision,
        grading,
        gradingStatus,
        serverNow,
        session,
      );

      if (!finalizedAttempt) {
        throw new AttemptFinalizationRaceError();
      }

      return finalizedAttempt;
    });
  } catch (error) {
    if (!(error instanceof AttemptFinalizationRaceError)) {
      throw error;
    }
  }

  if (autoSubmittedAttempt) {
    return autoSubmittedAttempt;
  }

  const currentAttempt = await findExamAttemptRecordById(attempt.id);

  if (
    currentAttempt?.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
    serverNow.getTime() >= currentAttempt.expiresAt.getTime()
  ) {
    if (retryCount >= 2) {
      throw new ExamAttemptStateConflictError();
    }

    return resolveAttemptExpiration(currentAttempt, serverNow, retryCount + 1);
  }

  return currentAttempt ?? attempt;
}

async function toFreshAttemptContext(
  exam: StudentExamWorkspacePersistenceRecord,
  attempt: ExamAttemptPersistenceRecord,
): Promise<StudentExamAttemptContext> {
  const responseNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, responseNow);
  return toAttemptContext(exam, resolvedAttempt, responseNow);
}

async function getExamGradingRecordOrThrow(
  examId: string,
): Promise<ExamGradingPersistenceRecord> {
  const exam = await findExamGradingRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  return exam;
}

function isValidActiveAttempt(
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
): boolean {
  return (
    attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
    serverNow.getTime() < attempt.expiresAt.getTime()
  );
}

export function isTerminalExamAttemptStatus(
  status: ExamAttemptPersistenceRecord["status"],
): boolean {
  return TERMINAL_EXAM_ATTEMPT_STATUSES.some(
    (terminalStatus) => terminalStatus === status,
  );
}

export async function startOrResumeExamAttempt(
  actor: AppUser,
  examId: string,
  resumeAttemptId?: string,
): Promise<StudentExamAttemptContext> {
  assertStudent(actor);

  if (resumeAttemptId) {
    const exam = await findStudentExamRecordById(examId);

    if (!exam) {
      throw new ExamNotFoundError();
    }

    if (!(await markStudentAttemptsStarted(actor.id))) {
      throw new ForbiddenError("Tài khoản học sinh không còn hoạt động.");
    }

    const attempt = await findOwnedExamAttemptRecord(
      resumeAttemptId,
      examId,
      actor.id,
    );

    if (!attempt) {
      throw new ExamAttemptNotFoundError();
    }

    return toFreshAttemptContext(exam, attempt);
  }

  let exam: StudentExamWorkspacePersistenceRecord | null = null;

  for (let retry = 0; retry < START_ATTEMPT_MAX_RETRIES; retry += 1) {
    const currentExam = await findStudentExamRecordById(examId);

    if (!currentExam) {
      throw new ExamNotFoundError();
    }

    if (currentExam.status !== EXAM_STATUS.PUBLISHED) {
      throw new ExamNotPublishedError();
    }

    if (!(await isPublishedExamAvailableToStudent(examId, actor.id))) {
      throw new ExamNotPublishedError();
    }

    if (
      currentExam.attemptsStarted ||
      (await markExamAttemptsStarted(examId, actor.id, currentExam.updatedAt))
    ) {
      exam = { ...currentExam, attemptsStarted: true };
      break;
    }
  }

  if (!exam) {
    throw new ExamAttemptConflictError();
  }

  if (!(await markStudentAttemptsStarted(actor.id))) {
    throw new ForbiddenError("Tài khoản học sinh không còn hoạt động.");
  }

  for (let retry = 0; retry < START_ATTEMPT_MAX_RETRIES; retry += 1) {
    const serverNow = new Date();
    const activeAttempt = await findActiveExamAttemptRecord(actor.id, examId);

    if (activeAttempt) {
      const resolvedAttempt = await resolveAttemptExpiration(
        activeAttempt,
        serverNow,
      );

      if (isValidActiveAttempt(resolvedAttempt, serverNow)) {
        return toFreshAttemptContext(exam, resolvedAttempt);
      }
    }

    const latestAttempt = await findLatestExamAttemptRecord(actor.id, examId);

    if (latestAttempt && !exam.allowRetake) {
      throw new ExamRetakeNotAllowedError();
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + ATTEMPT_DURATION_MS);

    try {
      const attempt = await withMongoTransaction(async (session) => {
        if (!(await reserveExamForAttemptCreation(examId, actor.id, session))) {
          throw new ExamNotPublishedError();
        }

        if (!(await reserveStudentForAttemptCreation(actor.id, session))) {
          throw new ForbiddenError("Tài khoản học sinh không còn hoạt động.");
        }

        return createExamAttemptRecord(
          {
            examId,
            studentId: actor.id,
            attemptNumber: (latestAttempt?.attemptNumber ?? 0) + 1,
            status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
            startedAt,
            expiresAt,
            ...(exam.structureSnapshot
              ? {
                  answers: createEmptyAttemptAnswers(exam.structureSnapshot),
                }
              : {}),
          },
          session,
        );
      });

      return toFreshAttemptContext(exam, attempt);
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }

      const concurrentAttempt = await findActiveExamAttemptRecord(
        actor.id,
        examId,
      );

      if (concurrentAttempt) {
        const recoveryNow = new Date();
        const resolvedAttempt = await resolveAttemptExpiration(
          concurrentAttempt,
          recoveryNow,
        );

        if (isValidActiveAttempt(resolvedAttempt, recoveryNow)) {
          return toFreshAttemptContext(exam, resolvedAttempt);
        }
      }
    }
  }

  throw new ExamAttemptConflictError();
}

export async function listStudentExams(
  actor: AppUser,
): Promise<StudentExamList> {
  assertStudent(actor);
  const [publishedExams, storedAttempts] = await Promise.all([
    listPublishedStudentExamRecords(actor.id),
    listAllExamAttemptRecordsForStudent(actor.id),
  ]);
  const publishedExamIds = new Set(publishedExams.map((exam) => exam.id));
  const retainedExamIds = [
    ...new Set(
      storedAttempts
        .map((attempt) => attempt.examId)
        .filter((examId) => !publishedExamIds.has(examId)),
    ),
  ];
  const retainedExams = await listStudentExamRecordsByIds(
    retainedExamIds,
    actor.id,
  );
  const storedExams = [...publishedExams, ...retainedExams];
  const serverNow = new Date();
  const attempts = await Promise.all(
    storedAttempts.map((attempt) =>
      attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
      serverNow.getTime() >= attempt.expiresAt.getTime()
        ? resolveAttemptExpiration(attempt, serverNow)
        : attempt,
    ),
  );
  const attemptsByExam = new Map<string, ExamAttemptPersistenceRecord[]>();

  for (const attempt of attempts) {
    const examAttempts = attemptsByExam.get(attempt.examId) ?? [];
    examAttempts.push(attempt);
    attemptsByExam.set(attempt.examId, examAttempts);
  }

  const exams = storedExams.filter(
    (exam) =>
      publishedExamIds.has(exam.id) ||
      ("isAssigned" in exam && exam.isAssigned) ||
      (attemptsByExam.get(exam.id) ?? []).some((attempt) =>
        isValidActiveAttempt(attempt, serverNow),
      ),
  );

  const studentExams: StudentExamSummary[] = exams.map((exam) => {
    const examAttempts = attemptsByExam.get(exam.id) ?? [];
    const activeAttempt = examAttempts.find((attempt) =>
      isValidActiveAttempt(attempt, serverNow),
    );
    const completedAttemptCount = examAttempts.filter((attempt) =>
      isTerminalExamAttemptStatus(attempt.status),
    ).length;
    const latestCompletedAttempt = examAttempts
      .filter((attempt) => isTerminalExamAttemptStatus(attempt.status))
      .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
    const state = activeAttempt
      ? STUDENT_EXAM_STATE.IN_PROGRESS
      : completedAttemptCount > 0
        ? STUDENT_EXAM_STATE.COMPLETED
        : STUDENT_EXAM_STATE.NOT_STARTED;

    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: EXAM_STRUCTURE.durationMinutes,
      allowRetake: exam.allowRetake,
      isAvailable: publishedExamIds.has(exam.id),
      state,
      activeAttemptId: activeAttempt?.id,
      latestCompletedAttemptId: latestCompletedAttempt?.id,
      completedAttemptCount,
      createdAt: exam.createdAt.toISOString(),
    };
  });

  studentExams.sort((left, right) => {
    const stateDifference =
      EXAM_STATE_ORDER[left.state] - EXAM_STATE_ORDER[right.state];

    if (stateDifference !== 0) {
      return stateDifference;
    }

    const dateDifference =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return dateDifference !== 0
      ? dateDifference
      : right.id.localeCompare(left.id);
  });

  return {
    exams: studentExams,
    serverTime: serverNow.toISOString(),
  };
}

export async function getOwnedExamAttemptContext(
  actor: AppUser,
  examId: string,
  attemptId: string,
): Promise<StudentExamAttemptContext> {
  assertStudent(actor);
  const attempt = await findOwnedExamAttemptRecord(attemptId, examId, actor.id);

  if (!attempt) {
    throw new ExamAttemptNotFoundError();
  }

  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);
  const exam = await findStudentExamRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  return toFreshAttemptContext(exam, resolvedAttempt);
}

async function getOwnedAttemptOrThrow(
  actor: AppUser,
  examId: string,
  attemptId: string,
): Promise<ExamAttemptPersistenceRecord> {
  const attempt = await findOwnedExamAttemptRecord(attemptId, examId, actor.id);

  if (!attempt) {
    throw new ExamAttemptNotFoundError();
  }

  return attempt;
}

async function resolveMutationRace(
  actor: AppUser,
  examId: string,
  attemptId: string,
): Promise<ExamAttemptPersistenceRecord> {
  const currentAttempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  return resolveAttemptExpiration(currentAttempt, new Date());
}

export async function saveExamAttemptAnswers(
  actor: AppUser,
  examId: string,
  attemptId: string,
  answers: ExamAttemptAnswers,
): Promise<StudentExamAttemptMutationResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  if (!isValidActiveAttempt(resolvedAttempt, serverNow)) {
    throw new ExamAttemptLockedError();
  }

  const exam = await findStudentExamRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  const persistedAnswers = getAttemptAnswers(
    resolvedAttempt,
    exam.structureSnapshot,
  );
  const validatedAnswers = validateAnswersPreservingEssayImages(
    answers,
    persistedAnswers,
    exam.structureSnapshot,
  );
  const essayQuestionIds = getEssayImageQuestionIds(exam.structureSnapshot);

  const savedAttempt = await saveOwnedActiveExamAttemptAnswers({
    attemptId,
    examId,
    studentId: actor.id,
    answers: validatedAnswers,
    now: serverNow,
    ...(essayQuestionIds.length > 0 ? { essayQuestionIds } : {}),
  });

  if (savedAttempt) {
    return toAttemptMutationResult(
      savedAttempt,
      serverNow,
      exam.structureSnapshot,
    );
  }

  const currentAttempt = await resolveMutationRace(actor, examId, attemptId);

  if (currentAttempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    throw new ExamAttemptLockedError();
  }

  throw new ExamAttemptStateConflictError();
}

interface EssayImageAttemptContext {
  attempt: ExamAttemptPersistenceRecord;
  exam: StudentExamWorkspacePersistenceRecord;
}

async function getEssayImageAttemptContext(
  actor: AppUser,
  examId: string,
  attemptId: string,
  questionId: string,
): Promise<EssayImageAttemptContext> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();

  if (!isValidActiveAttempt(attempt, serverNow)) {
    throw new ExamAttemptLockedError();
  }

  const exam = await findStudentExamRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  const question = exam.structureSnapshot?.sections
    .flatMap((section) => section.questions)
    .find((candidate) => candidate.id === questionId);

  if (question?.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
    throw new EssayImageQuestionNotFoundError();
  }

  return { attempt, exam };
}

function getEssayImageAnswer(
  attempt: ExamAttemptPersistenceRecord,
  structure: ExamStructureSnapshot,
  questionId: string,
): { answers: DynamicAttemptAnswers; answer: EssayImageAnswer } {
  const answers = getAttemptAnswers(attempt, structure);

  if (!isDynamicAttemptAnswers(answers)) {
    throw new ExamAttemptStateConflictError();
  }

  const answer = answers.answersByQuestionId[questionId];

  if (
    !answer ||
    typeof answer !== "object" ||
    Array.isArray(answer) ||
    !("type" in answer) ||
    answer.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE
  ) {
    throw new ExamAttemptStateConflictError();
  }

  return { answers, answer };
}

function withAttachedEssayImage(
  attempt: ExamAttemptPersistenceRecord,
  structure: ExamStructureSnapshot,
  questionId: string,
  image: EssayImage,
): DynamicAttemptAnswers {
  const { answers, answer } = getEssayImageAnswer(
    attempt,
    structure,
    questionId,
  );

  if (
    answer.images.some((candidate) => candidate.publicId === image.publicId)
  ) {
    throw new EssayImageAlreadyAttachedError();
  }

  if (answer.images.length >= ESSAY_IMAGE_MAX_COUNT) {
    throw new EssayImageLimitError();
  }

  return {
    answersByQuestionId: {
      ...answers.answersByQuestionId,
      [questionId]: {
        type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        images: [...answer.images, image],
      },
    },
  };
}

function withoutEssayImage(
  attempt: ExamAttemptPersistenceRecord,
  structure: ExamStructureSnapshot,
  questionId: string,
  publicId: string,
): { answers: DynamicAttemptAnswers; removedImage: EssayImage } {
  const { answers, answer } = getEssayImageAnswer(
    attempt,
    structure,
    questionId,
  );
  const removedImage = answer.images.find(
    (candidate) => candidate.publicId === publicId,
  );

  if (!removedImage) {
    throw new EssayImageNotFoundError();
  }

  return {
    answers: {
      answersByQuestionId: {
        ...answers.answersByQuestionId,
        [questionId]: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: answer.images.filter(
            (candidate) => candidate.publicId !== publicId,
          ),
        },
      },
    },
    removedImage,
  };
}

export async function issueEssayImageUploadTicket(
  actor: AppUser,
  examId: string,
  attemptId: string,
  questionId: string,
  intent: EssayImageUploadIntent,
): Promise<EssayImageUploadTicket> {
  const { attempt, exam } = await getEssayImageAttemptContext(
    actor,
    examId,
    attemptId,
    questionId,
  );
  const structure = exam.structureSnapshot;

  if (!structure) {
    throw new EssayImageQuestionNotFoundError();
  }

  if (
    getEssayImageAnswer(attempt, structure, questionId).answer.images.length >=
    ESSAY_IMAGE_MAX_COUNT
  ) {
    throw new EssayImageLimitError();
  }

  return createEssayImageUploadTicket(
    { studentId: actor.id, attemptId, questionId },
    intent,
  );
}

export async function attachEssayImage(
  actor: AppUser,
  examId: string,
  attemptId: string,
  questionId: string,
  upload: EssayImageUploadReference,
): Promise<StudentExamAttemptMutationResult> {
  const { attempt, exam } = await getEssayImageAttemptContext(
    actor,
    examId,
    attemptId,
    questionId,
  );
  const structure = exam.structureSnapshot;

  if (!structure) {
    throw new EssayImageQuestionNotFoundError();
  }

  const currentAnswer = getEssayImageAnswer(
    attempt,
    structure,
    questionId,
  ).answer;

  if (
    currentAnswer.images.some((image) => image.publicId === upload.publicId)
  ) {
    throw new EssayImageAlreadyAttachedError();
  }
  if (currentAnswer.images.length >= ESSAY_IMAGE_MAX_COUNT) {
    throw new EssayImageLimitError();
  }

  const image = await verifyEssayImageAsset(upload, {
    studentId: actor.id,
    attemptId,
    questionId,
  });
  let currentAttempt = attempt;

  for (let retry = 0; retry < ESSAY_IMAGE_MUTATION_MAX_RETRIES; retry += 1) {
    const mutationNow = new Date();

    if (!isValidActiveAttempt(currentAttempt, mutationNow)) {
      throw new ExamAttemptLockedError();
    }

    const answers = withAttachedEssayImage(
      currentAttempt,
      structure,
      questionId,
      image,
    );
    const savedAttempt = await attachEssayImageToOwnedActiveExamAttempt({
      attemptId,
      examId,
      studentId: actor.id,
      answers,
      expectedAnswerRevision: currentAttempt.answerRevision,
      now: mutationNow,
    });

    if (savedAttempt) {
      return toAttemptMutationResult(savedAttempt, mutationNow, structure);
    }

    currentAttempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  }

  if (!isValidActiveAttempt(currentAttempt, new Date())) {
    throw new ExamAttemptLockedError();
  }

  throw new ExamAttemptStateConflictError();
}

export async function removeEssayImage(
  actor: AppUser,
  examId: string,
  attemptId: string,
  questionId: string,
  publicId: string,
): Promise<StudentExamAttemptMutationResult> {
  const { attempt, exam } = await getEssayImageAttemptContext(
    actor,
    examId,
    attemptId,
    questionId,
  );
  const structure = exam.structureSnapshot;

  if (!structure) {
    throw new EssayImageQuestionNotFoundError();
  }

  let currentAttempt = attempt;

  for (let retry = 0; retry < ESSAY_IMAGE_MUTATION_MAX_RETRIES; retry += 1) {
    const mutationNow = new Date();

    if (!isValidActiveAttempt(currentAttempt, mutationNow)) {
      throw new ExamAttemptLockedError();
    }

    const { answers, removedImage } = withoutEssayImage(
      currentAttempt,
      structure,
      questionId,
      publicId,
    );
    const savedAttempt = await removeEssayImageFromOwnedActiveExamAttempt({
      attemptId,
      examId,
      studentId: actor.id,
      answers,
      expectedAnswerRevision: currentAttempt.answerRevision,
      now: mutationNow,
    });

    if (savedAttempt) {
      try {
        await deleteEssayImage(removedImage.publicId);
      } catch (error) {
        console.error("Could not delete a Cloudinary essay image.", {
          publicId: removedImage.publicId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }

      return toAttemptMutationResult(savedAttempt, mutationNow, structure);
    }

    currentAttempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  }

  if (!isValidActiveAttempt(currentAttempt, new Date())) {
    throw new ExamAttemptLockedError();
  }

  throw new ExamAttemptStateConflictError();
}

export async function submitExamAttempt(
  actor: AppUser,
  examId: string,
  attemptId: string,
  answers: ExamAttemptAnswers,
): Promise<StudentExamAttemptMutationResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  if (resolvedAttempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    return toAttemptMutationResult(resolvedAttempt, serverNow);
  }

  let submittedAttempt: ExamAttemptPersistenceRecord | null = null;

  try {
    submittedAttempt = await withMongoTransaction(async (session) => {
      const exam = await reserveExamForAttemptGrading(examId, session);

      if (!exam) {
        throw new ExamNotFoundError();
      }

      const validatedAnswers = validateAnswersPreservingEssayImages(
        answers,
        getAttemptAnswers(resolvedAttempt, exam.structureSnapshot),
        exam.structureSnapshot,
      );
      const essayQuestionIds = getEssayImageQuestionIds(exam.structureSnapshot);
      const grading = gradeExamAttemptAnswers(
        validatedAnswers,
        exam.answerKey,
        exam.answerKeyRevision,
        exam.structureSnapshot,
      );
      const gradingStatus = getGradingStatusForStructure(
        exam.structureSnapshot,
      );
      const finalizedAttempt = await submitOwnedActiveExamAttempt(
        {
          attemptId,
          examId,
          studentId: actor.id,
          answers: validatedAnswers,
          grading,
          gradingStatus,
          ...(essayQuestionIds.length > 0 ? { essayQuestionIds } : {}),
          now: serverNow,
        },
        session,
      );

      if (!finalizedAttempt) {
        throw new AttemptFinalizationRaceError();
      }

      return finalizedAttempt;
    });
  } catch (error) {
    if (!(error instanceof AttemptFinalizationRaceError)) {
      throw error;
    }
  }

  if (submittedAttempt) {
    return toAttemptMutationResult(submittedAttempt, serverNow);
  }

  const currentAttempt = await resolveMutationRace(actor, examId, attemptId);

  if (currentAttempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    return toAttemptMutationResult(currentAttempt, new Date());
  }

  throw new ExamAttemptStateConflictError();
}

export async function finalizeExpiredExamAttempt(
  actor: AppUser,
  examId: string,
  attemptId: string,
): Promise<StudentExamAttemptMutationResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  return toAttemptMutationResult(resolvedAttempt, serverNow);
}

export async function updateManualEssayGrading(
  actor: AppUser,
  attemptId: string,
  input: ManualEssayGradingRequest,
): Promise<ExamAttemptPersistenceRecord> {
  assertAdmin(actor);
  const storedAttempt = await findExamAttemptRecordById(attemptId);

  if (!storedAttempt) {
    throw new ExamAttemptNotFoundError();
  }

  if (!isTerminalExamAttemptStatus(storedAttempt.status)) {
    throw new ExamAttemptStateConflictError();
  }

  return withMongoTransaction(async (session) => {
    const exam = await reserveExamForAttemptGrading(
      storedAttempt.examId,
      session,
    );

    if (!exam) {
      throw new ExamNotFoundError();
    }

    const currentAttempt = await findExamAttemptRecordById(attemptId, session);

    if (!currentAttempt) {
      throw new ExamAttemptNotFoundError();
    }

    if (
      !isTerminalExamAttemptStatus(currentAttempt.status) ||
      !exam.structureSnapshot ||
      !structureContainsEssayImage(exam.structureSnapshot)
    ) {
      throw new ExamAttemptStateConflictError();
    }

    const expectedGradingStatus =
      input.action === "CORRECT"
        ? EXAM_ATTEMPT_GRADING_STATUS.COMPLETED
        : EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL;

    if (getExamAttemptGradingStatus(currentAttempt) !== expectedGradingStatus) {
      throw new ExamAttemptStateConflictError();
    }

    const objectiveGrading = gradeExamAttemptAnswers(
      getAttemptAnswers(currentAttempt, exam.structureSnapshot),
      exam.answerKey,
      exam.answerKeyRevision,
      exam.structureSnapshot,
    );

    if (!isDynamicAttemptGradingSnapshot(objectiveGrading)) {
      throw new ExamAttemptStateConflictError();
    }

    const shouldFinalize = input.action !== "SAVE_DRAFT";
    let grading: DynamicAttemptGradingSnapshot;

    try {
      grading = shouldFinalize
        ? applyManualEssayScores(
            objectiveGrading,
            exam.structureSnapshot,
            input.manualEssayScores,
            true,
          )
        : applyManualEssayScores(
            objectiveGrading,
            exam.structureSnapshot,
            input.manualEssayScores,
            false,
          );
    } catch (error) {
      throw new ManualEssayGradingValidationError(
        error instanceof Error ? error.message : "Điểm tự luận không hợp lệ.",
      );
    }

    const updatedAttempt = await setTerminalManualEssayGrading(
      {
        attemptId,
        examId: currentAttempt.examId,
        expectedRevision: input.expectedRevision,
        expectedGradingStatus,
        grading,
        gradingStatus: shouldFinalize
          ? EXAM_ATTEMPT_GRADING_STATUS.COMPLETED
          : EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        gradedAt: new Date(),
      },
      session,
    );

    if (!updatedAttempt) {
      throw new ExamAttemptStateConflictError();
    }

    return updatedAttempt;
  });
}

export async function ensureTerminalAttemptGrading(
  attempt: ExamAttemptPersistenceRecord,
  exam: ExamGradingPersistenceRecord,
  serverNow: Date,
): Promise<{
  attempt: ExamAttemptPersistenceRecord;
  exam: ExamGradingPersistenceRecord;
}> {
  if (attempt.grading?.answerKeyRevision === exam.answerKeyRevision) {
    return { attempt, exam };
  }

  return withMongoTransaction(async (session) => {
    const currentExam = await reserveExamForAttemptGrading(
      attempt.examId,
      session,
    );

    if (!currentExam) {
      throw new ExamNotFoundError();
    }

    const grading = regradeExamAttemptAnswersPreservingManualScores(
      getAttemptAnswers(attempt, currentExam.structureSnapshot),
      currentExam.answerKey,
      currentExam.answerKeyRevision,
      currentExam.structureSnapshot,
      attempt.grading,
      getExamAttemptGradingStatus(attempt) ===
        EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
    );
    const gradingStatus = structureContainsEssayImage(
      currentExam.structureSnapshot,
    )
      ? getExamAttemptGradingStatus(attempt)
      : EXAM_ATTEMPT_GRADING_STATUS.COMPLETED;
    const gradedAttempt = await setOwnedTerminalExamAttemptGradingForRevision(
      attempt.id,
      attempt.examId,
      attempt.studentId,
      grading,
      gradingStatus,
      serverNow,
      session,
    );

    if (gradedAttempt?.grading) {
      return { attempt: gradedAttempt, exam: currentExam };
    }

    const currentAttempt = await findOwnedExamAttemptRecord(
      attempt.id,
      attempt.examId,
      attempt.studentId,
      session,
    );

    if (
      !currentAttempt?.grading ||
      currentAttempt.grading.answerKeyRevision !== currentExam.answerKeyRevision
    ) {
      throw new ExamAttemptStateConflictError();
    }

    return { attempt: currentAttempt, exam: currentExam };
  });
}

function getCorrectPartThreeDisplayAnswer(answer: string): string {
  const normalizedAnswer = normalizeCanonicalShortAnswer(answer);

  if (!normalizedAnswer) {
    throw new Error("Cannot display a malformed Part III answer key.");
  }

  return normalizedAnswer.replace(".", ",");
}

function buildDynamicAnswerReview(
  answers: DynamicAttemptAnswers,
  answerKey: DynamicExamAnswerKey,
  grading: DynamicAttemptGradingSnapshot,
  structure: ExamStructureSnapshot,
  showScores: boolean,
): NonNullable<StudentExamAttemptResult["dynamicAnswerReview"]> {
  const manualEssayScoreByQuestionId = new Map(
    getEssayImageQuestionIds(structure).length > 0
      ? getCanonicalManualEssayScores(grading, structure).map((score) => [
          score.questionId,
          score.scoreHundredths,
        ])
      : [],
  );
  const entries = structure.sections.flatMap((section) =>
    section.questions.map((question) => {
      const studentAnswer = answers.answersByQuestionId[question.id];
      const correctAnswer = answerKey.answersByQuestionId[question.id];
      const questionGrading = grading.questionsById[question.id];
      let review: DynamicQuestionAnswerReview;

      if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
        if (
          !studentAnswer ||
          typeof studentAnswer !== "object" ||
          !("type" in studentAnswer) ||
          studentAnswer.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE
        ) {
          throw new ExamAttemptStateConflictError();
        }

        review = {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          studentAnswer: studentAnswer as EssayImageAnswer,
          ...(showScores && hasFinalTotalScore(grading)
            ? {
                score: scoreHundredthsToPoints(
                  manualEssayScoreByQuestionId.get(question.id) ?? 0,
                ),
              }
            : {}),
        };
      } else if (!questionGrading) {
        throw new ExamAttemptStateConflictError();
      } else if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE) {
        if (!("isCorrect" in questionGrading)) {
          throw new ExamAttemptStateConflictError();
        }

        review = {
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          studentAnswer: studentAnswer as PartOneAnswer | null,
          correctAnswer: correctAnswer as PartOneAnswer,
          isCorrect: questionGrading.isCorrect,
        };
      } else if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
        if (!("correctStatementCount" in questionGrading)) {
          throw new ExamAttemptStateConflictError();
        }

        const studentStatements = studentAnswer as AttemptPartTwoAnswer;
        const correctStatements = correctAnswer as PartTwoAnswer;
        review = {
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          studentAnswer: studentStatements,
          correctAnswer: correctStatements,
          correctStatementCount: questionGrading.correctStatementCount,
          statements: {
            a: {
              studentAnswer: studentStatements.a,
              correctAnswer: correctStatements.a,
              isCorrect: questionGrading.statements.a,
            },
            b: {
              studentAnswer: studentStatements.b,
              correctAnswer: correctStatements.b,
              isCorrect: questionGrading.statements.b,
            },
            c: {
              studentAnswer: studentStatements.c,
              correctAnswer: correctStatements.c,
              isCorrect: questionGrading.statements.c,
            },
            d: {
              studentAnswer: studentStatements.d,
              correctAnswer: correctStatements.d,
              isCorrect: questionGrading.statements.d,
            },
          },
          ...(showScores
            ? {
                score: scoreHundredthsToPoints(questionGrading.scoreHundredths),
              }
            : {}),
        };
      } else if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER) {
        if (!("isCorrect" in questionGrading)) {
          throw new ExamAttemptStateConflictError();
        }

        const studentSlots = studentAnswer as ShortAnswerSlots;
        review = {
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          studentAnswer: studentSlots,
          studentDisplayAnswer: shortAnswerSlotsToDisplayValue(studentSlots),
          correctDisplayAnswer: getCorrectPartThreeDisplayAnswer(
            correctAnswer as string,
          ),
          isCorrect: questionGrading.isCorrect,
        };
      } else {
        throw new ExamAttemptStateConflictError();
      }

      return [question.id, review] as const;
    }),
  );

  return { questionsById: Object.fromEntries(entries) };
}

export function buildExamAttemptResult(
  attempt: ExamAttemptPersistenceRecord,
  exam: ExamGradingPersistenceRecord,
  visibility: StudentExamAttemptResult["visibility"],
): StudentExamAttemptResult {
  const grading = attempt.grading;
  const submittedAt = attempt.submittedAt;

  if (!submittedAt) {
    throw new ExamAttemptStateConflictError();
  }

  const gradingStatus = getExamAttemptGradingStatus(attempt);
  const containsEssayImage = structureContainsEssayImage(
    exam.structureSnapshot,
  );

  const result: StudentExamAttemptResult = {
    exam: {
      id: exam.id,
      title: exam.title,
      ...(exam.structureSnapshot
        ? { structureSnapshot: exam.structureSnapshot }
        : {}),
    },
    attempt: {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      submittedAt: submittedAt.toISOString(),
      timeUsedSeconds: Math.max(
        0,
        Math.round(
          ((attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
            ? attempt.expiresAt
            : submittedAt
          ).getTime() -
            attempt.startedAt.getTime()) /
            1000,
        ),
      ),
    },
    visibility,
    gradingStatus,
  };

  if (!grading || grading.answerKeyRevision !== exam.answerKeyRevision) {
    throw new ExamAttemptStateConflictError();
  }

  const answers = getAttemptAnswers(attempt, exam.structureSnapshot);
  const answerKey = exam.answerKey;

  if (exam.structureSnapshot) {
    if (
      !isDynamicAttemptGradingSnapshot(grading) ||
      !isDynamicAttemptAnswers(answers) ||
      !isDynamicExamAnswerKey(answerKey)
    ) {
      throw new ExamAttemptStateConflictError();
    }

    if (gradingStatus === EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL) {
      if (
        !containsEssayImage ||
        hasFinalTotalScore(grading) ||
        !("objectiveScoreHundredths" in grading)
      ) {
        throw new ExamAttemptStateConflictError();
      }

      if (visibility.score) {
        result.objectiveScore = {
          earned: scoreHundredthsToPoints(grading.objectiveScoreHundredths),
          maximum: scoreHundredthsToPoints(grading.objectiveMaxScoreHundredths),
        };
      }

      if (visibility.answers) {
        result.dynamicAnswerReview = buildDynamicAnswerReview(
          answers,
          answerKey,
          grading,
          exam.structureSnapshot,
          visibility.score,
        );
      }

      return result;
    }

    if (!hasFinalTotalScore(grading)) {
      throw new ExamAttemptStateConflictError();
    }

    if (visibility.score) {
      const manualEssayScores = containsEssayImage
        ? getCanonicalManualEssayScores(grading, exam.structureSnapshot)
        : [];
      result.score = {
        total: scoreHundredthsToPoints(grading.totalScoreHundredths),
        sectionsById: Object.fromEntries(
          Object.entries(grading.sectionScoresHundredths).map(
            ([sectionId, score]) => [sectionId, scoreHundredthsToPoints(score)],
          ),
        ),
      };
      if (manualEssayScores.length > 0) {
        result.essayScores = exam.structureSnapshot.sections.flatMap(
          (section) =>
            section.questions.flatMap((question) => {
              if (question.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
                return [];
              }

              const score = manualEssayScores.find(
                (item) => item.questionId === question.id,
              )?.scoreHundredths;

              if (score === null || score === undefined) {
                throw new ExamAttemptStateConflictError();
              }

              return [
                {
                  questionId: question.id,
                  score: scoreHundredthsToPoints(score),
                  maximum: scoreHundredthsToPoints(question.maxScoreHundredths),
                },
              ];
            }),
        );
      }
    }

    if (visibility.answers) {
      result.dynamicAnswerReview = buildDynamicAnswerReview(
        answers,
        answerKey,
        grading,
        exam.structureSnapshot,
        visibility.score,
      );
    }

    return result;
  }

  if (
    isDynamicAttemptGradingSnapshot(grading) ||
    isDynamicAttemptAnswers(answers) ||
    isDynamicExamAnswerKey(answerKey)
  ) {
    throw new ExamAttemptStateConflictError();
  }

  if (
    gradingStatus !== EXAM_ATTEMPT_GRADING_STATUS.COMPLETED ||
    !hasFinalTotalScore(grading)
  ) {
    throw new ExamAttemptStateConflictError();
  }

  if (visibility.score) {
    result.score = {
      total: scoreHundredthsToPoints(grading.totalScoreHundredths),
      sections: {
        partOne: scoreHundredthsToPoints(
          grading.sectionScoresHundredths.partOne,
        ),
        partTwo: scoreHundredthsToPoints(
          grading.sectionScoresHundredths.partTwo,
        ),
        partThree: scoreHundredthsToPoints(
          grading.sectionScoresHundredths.partThree,
        ),
      },
    };
  }

  if (visibility.answers) {
    result.answerReview = {
      partOne: grading.partOne.map((item, index) => ({
        studentAnswer: answers.partOne[index],
        correctAnswer: answerKey.partOne[index],
        isCorrect: item.isCorrect,
      })),
      partTwo: grading.partTwo.map((item, questionIndex) => {
        const studentAnswer = answers.partTwo[questionIndex];
        const correctAnswer = answerKey.partTwo[questionIndex];
        const questionReview: NonNullable<
          StudentExamAttemptResult["answerReview"]
        >["partTwo"][number] = {
          studentAnswer,
          correctAnswer,
          correctStatementCount: item.correctStatementCount,
          statements: {
            a: {
              studentAnswer: studentAnswer.a,
              correctAnswer: correctAnswer.a,
              isCorrect: item.statements.a,
            },
            b: {
              studentAnswer: studentAnswer.b,
              correctAnswer: correctAnswer.b,
              isCorrect: item.statements.b,
            },
            c: {
              studentAnswer: studentAnswer.c,
              correctAnswer: correctAnswer.c,
              isCorrect: item.statements.c,
            },
            d: {
              studentAnswer: studentAnswer.d,
              correctAnswer: correctAnswer.d,
              isCorrect: item.statements.d,
            },
          },
        };

        if (visibility.score) {
          questionReview.score = scoreHundredthsToPoints(item.scoreHundredths);
        }

        return questionReview;
      }),
      partThree: grading.partThree.map((item, index) => ({
        studentAnswer: answers.partThree[index],
        studentDisplayAnswer: shortAnswerSlotsToDisplayValue(
          answers.partThree[index],
        ),
        correctDisplayAnswer: getCorrectPartThreeDisplayAnswer(
          answerKey.partThree[index],
        ),
        isCorrect: item.isCorrect,
      })),
    };
  }

  return result;
}

export async function getStudentExamAttemptResult(
  actor: AppUser,
  examId: string,
  attemptId: string,
): Promise<StudentExamAttemptResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  if (!isTerminalExamAttemptStatus(resolvedAttempt.status)) {
    throw new ExamAttemptResultUnavailableError();
  }

  const exam = await getExamGradingRecordOrThrow(examId);
  const graded = await ensureTerminalAttemptGrading(
    resolvedAttempt,
    exam,
    serverNow,
  );
  return buildExamAttemptResult(graded.attempt, graded.exam, {
    score: graded.exam.settings.showScoreAfterSubmission,
    answers: graded.exam.settings.showAnswersAfterSubmission,
  });
}
