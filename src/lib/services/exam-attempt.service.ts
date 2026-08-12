import "server-only";

import {
  EXAM_ATTEMPT_STATUS,
  STUDENT_EXAM_STATE,
  TERMINAL_EXAM_ATTEMPT_STATUSES,
} from "@/lib/constants/exam-attempt";
import { EXAM_STATUS, EXAM_STRUCTURE } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  autoSubmitExpiredExamAttemptRecord,
  createExamAttemptRecord,
  findActiveExamAttemptRecord,
  findExamAttemptRecordById,
  findLatestExamAttemptRecord,
  findOwnedExamAttemptRecord,
  listAllExamAttemptRecordsForStudent,
  saveOwnedActiveExamAttemptAnswers,
  setOwnedTerminalExamAttemptGradingIfMissing,
  submitOwnedActiveExamAttempt,
  type ExamAttemptPersistenceRecord,
} from "@/lib/db/dao/exam-attempt.dao";
import {
  findExamGradingRecordById,
  findStudentExamRecordById,
  listPublishedStudentExamRecords,
  listStudentExamRecordsByIds,
  markExamAttemptsStarted,
  reserveExamForAttemptCreation,
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
import {
  gradeAttemptAnswers,
  scoreHundredthsToPoints,
} from "@/lib/exam/grading";
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
} from "@/lib/errors/app-error";
import type {
  AttemptAnswers,
  ExamAttempt,
  StudentExamAttemptContext,
  StudentExamAttemptResult,
  StudentExamList,
  StudentExamAttemptMutationResult,
  StudentExamState,
  StudentExamSummary,
} from "@/types/exam-attempt";
import type { AppUser } from "@/types/user";

const ATTEMPT_DURATION_MS = EXAM_STRUCTURE.durationMinutes * 60 * 1000;
const START_ATTEMPT_MAX_RETRIES = 3;
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

function toExamAttempt(attempt: ExamAttemptPersistenceRecord): ExamAttempt {
  return {
    id: attempt.id,
    examId: attempt.examId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString(),
    lastSavedAt: attempt.lastSavedAt?.toISOString(),
    answers: attempt.answers ?? createEmptyAttemptAnswers(),
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
    },
    attempt: toExamAttempt(attempt),
    serverNow: serverNow.toISOString(),
    canEditAnswers: isValidActiveAttempt(attempt, serverNow),
  };
}

function toAttemptMutationResult(
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
): StudentExamAttemptMutationResult {
  return {
    attempt: toExamAttempt(attempt),
    serverNow: serverNow.toISOString(),
    canEditAnswers: isValidActiveAttempt(attempt, serverNow),
  };
}

export async function resolveAttemptExpiration(
  attempt: ExamAttemptPersistenceRecord,
  serverNow: Date,
  retryCount = 0,
  reportingExam?: ExamGradingPersistenceRecord,
): Promise<ExamAttemptPersistenceRecord> {
  if (
    attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS ||
    serverNow.getTime() < attempt.expiresAt.getTime()
  ) {
    return attempt;
  }

  const exam =
    reportingExam ?? (await getExamGradingRecordOrThrow(attempt.examId));
  const grading = gradeAttemptAnswers(
    attempt.answers ?? createEmptyAttemptAnswers(),
    exam.answerKey,
  );

  const autoSubmittedAttempt = await autoSubmitExpiredExamAttemptRecord(
    attempt.id,
    attempt.studentId,
    attempt.examId,
    attempt.answerRevision,
    grading,
    serverNow,
  );

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

    return resolveAttemptExpiration(
      currentAttempt,
      serverNow,
      retryCount + 1,
      exam,
    );
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
): Promise<StudentExamAttemptContext> {
  assertStudent(actor);
  let exam: StudentExamWorkspacePersistenceRecord | null = null;

  for (let retry = 0; retry < START_ATTEMPT_MAX_RETRIES; retry += 1) {
    const currentExam = await findStudentExamRecordById(examId);

    if (!currentExam) {
      throw new ExamNotFoundError();
    }

    if (currentExam.status !== EXAM_STATUS.PUBLISHED) {
      throw new ExamNotPublishedError();
    }

    if (
      currentExam.attemptsStarted ||
      (await markExamAttemptsStarted(examId, currentExam.updatedAt))
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
        if (!(await reserveExamForAttemptCreation(examId, session))) {
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
    listPublishedStudentExamRecords(),
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
  const retainedExams = await listStudentExamRecordsByIds(retainedExamIds);
  const exams = [...publishedExams, ...retainedExams];
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
      isAvailable: exam.status === EXAM_STATUS.PUBLISHED,
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
  answers: AttemptAnswers,
): Promise<StudentExamAttemptMutationResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  if (!isValidActiveAttempt(resolvedAttempt, serverNow)) {
    throw new ExamAttemptLockedError();
  }

  const savedAttempt = await saveOwnedActiveExamAttemptAnswers({
    attemptId,
    examId,
    studentId: actor.id,
    answers,
    now: serverNow,
  });

  if (savedAttempt) {
    return toAttemptMutationResult(savedAttempt, serverNow);
  }

  const currentAttempt = await resolveMutationRace(actor, examId, attemptId);

  if (currentAttempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    throw new ExamAttemptLockedError();
  }

  throw new ExamAttemptStateConflictError();
}

export async function submitExamAttempt(
  actor: AppUser,
  examId: string,
  attemptId: string,
  answers: AttemptAnswers,
): Promise<StudentExamAttemptMutationResult> {
  assertStudent(actor);
  const attempt = await getOwnedAttemptOrThrow(actor, examId, attemptId);
  const serverNow = new Date();
  const resolvedAttempt = await resolveAttemptExpiration(attempt, serverNow);

  if (resolvedAttempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    return toAttemptMutationResult(resolvedAttempt, serverNow);
  }

  const exam = await getExamGradingRecordOrThrow(examId);
  const grading = gradeAttemptAnswers(answers, exam.answerKey);

  const submittedAttempt = await submitOwnedActiveExamAttempt({
    attemptId,
    examId,
    studentId: actor.id,
    answers,
    grading,
    now: serverNow,
  });

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

export async function ensureTerminalAttemptGrading(
  attempt: ExamAttemptPersistenceRecord,
  exam: ExamGradingPersistenceRecord,
  serverNow: Date,
): Promise<ExamAttemptPersistenceRecord> {
  if (attempt.grading) {
    return attempt;
  }

  const grading = gradeAttemptAnswers(
    attempt.answers ?? createEmptyAttemptAnswers(),
    exam.answerKey,
  );
  const gradedAttempt = await setOwnedTerminalExamAttemptGradingIfMissing(
    attempt.id,
    attempt.examId,
    attempt.studentId,
    grading,
    serverNow,
  );

  if (gradedAttempt?.grading) {
    return gradedAttempt;
  }

  const currentAttempt = await findOwnedExamAttemptRecord(
    attempt.id,
    attempt.examId,
    attempt.studentId,
  );

  if (!currentAttempt?.grading) {
    throw new ExamAttemptStateConflictError();
  }

  return currentAttempt;
}

function getCorrectPartThreeDisplayAnswer(answer: string): string {
  const normalizedAnswer = normalizeCanonicalShortAnswer(answer);

  if (!normalizedAnswer) {
    throw new Error("Cannot display a malformed Part III answer key.");
  }

  return normalizedAnswer.replace(".", ",");
}

export function buildExamAttemptResult(
  attempt: ExamAttemptPersistenceRecord,
  exam: ExamGradingPersistenceRecord,
  visibility: StudentExamAttemptResult["visibility"],
): StudentExamAttemptResult {
  const grading = attempt.grading;
  const submittedAt = attempt.submittedAt;

  if (!grading || !submittedAt) {
    throw new ExamAttemptStateConflictError();
  }

  const result: StudentExamAttemptResult = {
    exam: {
      id: exam.id,
      title: exam.title,
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
  };

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
    const answers = attempt.answers ?? createEmptyAttemptAnswers();

    result.answerReview = {
      partOne: grading.partOne.map((item, index) => ({
        studentAnswer: answers.partOne[index],
        correctAnswer: exam.answerKey.partOne[index],
        isCorrect: item.isCorrect,
      })),
      partTwo: grading.partTwo.map((item, questionIndex) => {
        const studentAnswer = answers.partTwo[questionIndex];
        const correctAnswer = exam.answerKey.partTwo[questionIndex];
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
          exam.answerKey.partThree[index],
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
  const gradedAttempt = await ensureTerminalAttemptGrading(
    resolvedAttempt,
    exam,
    serverNow,
  );
  return buildExamAttemptResult(gradedAttempt, exam, {
    score: exam.settings.showScoreAfterSubmission,
    answers: exam.settings.showAnswersAfterSubmission,
  });
}
