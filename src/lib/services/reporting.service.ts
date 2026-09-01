import "server-only";

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  countExamAttemptRecordsByStatus,
  findExamAttemptRecordById,
  findLatestExamAttemptRecord,
  listActiveExamAttemptRecords,
  listExpiredExamAttemptRecords,
  listTerminalExamAttemptRecordPage,
  listTerminalExamAttemptRecords,
  type ExamAttemptPersistenceRecord,
  type ExamAttemptReportFilter,
} from "@/lib/db/dao/exam-attempt.dao";
import {
  countExamRecords,
  findExamReportingRecordById,
  findExamReportingRecordsByIds,
  isPublishedExamAvailableToStudent,
  type ExamReportingPersistenceRecord,
} from "@/lib/db/dao/exam.dao";
import {
  countStudentUsers,
  findStudentUsersByIds,
  findUserById,
  type UserAccountRecord,
} from "@/lib/db/dao/user.dao";
import {
  calculatePerformanceStatistics,
  calculateScoreAggregate,
  getAttemptTimeUsedSeconds,
  toScoreStatistics,
  type ScoredAttempt,
} from "@/lib/exam/attempt-statistics";
import { scoreHundredthsToPoints } from "@/lib/exam/grading";
import {
  ExamAttemptNotFoundError,
  ExamAttemptStateConflictError,
  ExamNotFoundError,
  ForbiddenError,
  StudentNotFoundError,
} from "@/lib/errors/app-error";
import {
  buildExamAttemptResult,
  ensureTerminalAttemptGrading,
  isTerminalExamAttemptStatus,
  resolveAttemptExpiration,
} from "@/lib/services/exam-attempt.service";
import type {
  AdminResultQuery,
  PaginationQuery,
} from "@/lib/validations/reporting";
import type { AttemptGradingSnapshot } from "@/types/exam-attempt";
import type {
  AdminAttemptDetail,
  AdminDashboardSummary,
  AdminExamResults,
  AdminResultList,
  AdminResultSummary,
  AdminStudentDetail,
  AttemptScoreSummary,
  PaginationMetadata,
  ReportingExamIdentity,
  ReportingStudentIdentity,
  StudentExamAttemptHistory,
} from "@/types/reporting";
import type { AppUser, StudentAccount } from "@/types/user";

interface PreparedTerminalAttempt extends ExamAttemptPersistenceRecord {
  grading: AttemptGradingSnapshot;
  submittedAt: Date;
}

const REPORTING_WRITE_BATCH_SIZE = 20;
const REPORTING_RECONCILIATION_MAX_RETRIES = 3;

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function assertStudent(actor: AppUser): void {
  if (actor.role !== USER_ROLE.STUDENT) {
    throw new ForbiddenError();
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

async function mapInBatches<TItem, TResult>(
  items: TItem[],
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (
    let index = 0;
    index < items.length;
    index += REPORTING_WRITE_BATCH_SIZE
  ) {
    const batch = items.slice(index, index + REPORTING_WRITE_BATCH_SIZE);
    results.push(...(await Promise.all(batch.map(mapper))));
  }

  return results;
}

function toStudentIdentity(
  student: UserAccountRecord,
): ReportingStudentIdentity {
  return {
    id: student.id,
    username: student.username,
    fullName: student.fullName,
    isActive: student.isActive,
  };
}

function toStudentAccount(student: UserAccountRecord): StudentAccount {
  return {
    ...toStudentIdentity(student),
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  };
}

function toExamIdentity(
  exam: ExamReportingPersistenceRecord,
): ReportingExamIdentity {
  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
  };
}

function toPaginationMetadata(
  query: PaginationQuery,
  totalItems: number,
): PaginationMetadata {
  return {
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / query.pageSize),
  };
}

function toPreparedTerminalAttempt(
  attempt: ExamAttemptPersistenceRecord,
): PreparedTerminalAttempt {
  if (!attempt.grading || !attempt.submittedAt) {
    throw new ExamAttemptStateConflictError();
  }

  return {
    ...attempt,
    grading: attempt.grading,
    submittedAt: attempt.submittedAt,
  };
}

function toScoredAttempt(attempt: PreparedTerminalAttempt): ScoredAttempt {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    grading: attempt.grading,
  };
}

function toAttemptScore(attempt: PreparedTerminalAttempt): AttemptScoreSummary {
  return {
    total: scoreHundredthsToPoints(attempt.grading.totalScoreHundredths),
    sections: {
      partOne: scoreHundredthsToPoints(
        attempt.grading.sectionScoresHundredths.partOne,
      ),
      partTwo: scoreHundredthsToPoints(
        attempt.grading.sectionScoresHundredths.partTwo,
      ),
      partThree: scoreHundredthsToPoints(
        attempt.grading.sectionScoresHundredths.partThree,
      ),
    },
  };
}

async function getExamMap(
  examIds: string[],
): Promise<Map<string, ExamReportingPersistenceRecord>> {
  const exams = await findExamReportingRecordsByIds(uniqueIds(examIds));
  return new Map(exams.map((exam) => [exam.id, exam]));
}

async function getStudentMap(
  studentIds: string[],
): Promise<Map<string, UserAccountRecord>> {
  const students = await findStudentUsersByIds(uniqueIds(studentIds));
  return new Map(students.map((student) => [student.id, student]));
}

async function reconcileExpiredAttempts(
  now: Date,
  filter: Pick<ExamAttemptReportFilter, "studentId" | "examId"> = {},
  knownExam?: ExamReportingPersistenceRecord,
): Promise<void> {
  const attempts = await listExpiredExamAttemptRecords(now, filter);

  if (attempts.length === 0) {
    return;
  }

  const examMap = knownExam
    ? new Map([[knownExam.id, knownExam]])
    : await getExamMap(attempts.map((attempt) => attempt.examId));

  await mapInBatches(attempts, async (attempt) => {
    const exam = examMap.get(attempt.examId);

    if (!exam) {
      throw new ExamNotFoundError();
    }

    return resolveAttemptExpiration(attempt, now);
  });
}

async function prepareTerminalAttempts(
  attempts: ExamAttemptPersistenceRecord[],
  examMap: Map<string, ExamReportingPersistenceRecord>,
  now: Date,
): Promise<PreparedTerminalAttempt[]> {
  for (
    let retry = 0;
    retry < REPORTING_RECONCILIATION_MAX_RETRIES;
    retry += 1
  ) {
    const prepared = await mapInBatches(attempts, async (attempt) => {
      if (!isTerminalExamAttemptStatus(attempt.status)) {
        throw new ExamAttemptStateConflictError();
      }

      const exam = examMap.get(attempt.examId);

      if (!exam) {
        throw new ExamNotFoundError();
      }

      if (attempt.grading?.answerKeyRevision === exam.answerKeyRevision) {
        return toPreparedTerminalAttempt(attempt);
      }

      const graded = await ensureTerminalAttemptGrading(attempt, exam, now);
      const latestExam = examMap.get(attempt.examId);

      if (
        !latestExam ||
        graded.exam.answerKeyRevision >= latestExam.answerKeyRevision
      ) {
        examMap.set(attempt.examId, graded.exam);
      }

      return toPreparedTerminalAttempt(graded.attempt);
    });
    const isConsistent = prepared.every(
      (attempt) =>
        attempt.grading.answerKeyRevision ===
        examMap.get(attempt.examId)?.answerKeyRevision,
    );

    if (isConsistent) {
      return prepared;
    }
  }

  throw new ExamAttemptStateConflictError();
}

function toAdminResultSummary(
  attempt: PreparedTerminalAttempt,
  studentMap: Map<string, UserAccountRecord>,
  examMap: Map<string, ExamReportingPersistenceRecord>,
): AdminResultSummary {
  const student = studentMap.get(attempt.studentId);
  const exam = examMap.get(attempt.examId);

  return {
    id: attempt.id,
    student: student ? toStudentIdentity(student) : null,
    exam: exam ? toExamIdentity(exam) : null,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt.toISOString(),
    timeUsedSeconds: getAttemptTimeUsedSeconds(attempt),
    score: toAttemptScore(attempt),
  };
}

export async function getAdminDashboardSummary(
  actor: AppUser,
): Promise<AdminDashboardSummary> {
  assertAdmin(actor);
  await reconcileExpiredAttempts(new Date());

  const [studentCounts, examCounts, attemptCounts] = await Promise.all([
    countStudentUsers(),
    countExamRecords(),
    countExamAttemptRecordsByStatus(),
  ]);

  return {
    activeStudentCount: studentCounts.active,
    examCount: examCounts.total,
    publishedExamCount: examCounts.published,
    activeAttemptCount: attemptCounts.inProgress,
    completedAttemptCount:
      attemptCounts.submitted + attemptCounts.autoSubmitted,
  };
}

export async function listAdminResults(
  actor: AppUser,
  query: AdminResultQuery,
): Promise<AdminResultList> {
  assertAdmin(actor);
  const now = new Date();
  const filter: ExamAttemptReportFilter = {
    studentId: query.studentId,
    examId: query.examId,
    status: query.status,
  };
  await reconcileExpiredAttempts(now, filter);
  const page = await listTerminalExamAttemptRecordPage(
    filter,
    query.page,
    query.pageSize,
  );
  const [examMap, studentMap] = await Promise.all([
    getExamMap(page.attempts.map((attempt) => attempt.examId)),
    getStudentMap(page.attempts.map((attempt) => attempt.studentId)),
  ]);
  const attempts = await prepareTerminalAttempts(page.attempts, examMap, now);

  return {
    results: attempts.map((attempt) =>
      toAdminResultSummary(attempt, studentMap, examMap),
    ),
    pagination: toPaginationMetadata(query, page.totalItems),
  };
}

export async function getAdminAttemptDetail(
  actor: AppUser,
  attemptId: string,
): Promise<AdminAttemptDetail> {
  assertAdmin(actor);
  const storedAttempt = await findExamAttemptRecordById(attemptId);

  if (!storedAttempt) {
    throw new ExamAttemptNotFoundError();
  }

  const now = new Date();
  const exam = await findExamReportingRecordById(storedAttempt.examId);
  const resolvedAttempt =
    storedAttempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
    now.getTime() >= storedAttempt.expiresAt.getTime()
      ? await resolveAttemptExpiration(storedAttempt, now)
      : storedAttempt;
  const studentMap = await getStudentMap([resolvedAttempt.studentId]);
  const student = studentMap.get(resolvedAttempt.studentId);
  const detail: AdminAttemptDetail = {
    student: student ? toStudentIdentity(student) : null,
    exam: exam ? toExamIdentity(exam) : null,
    attempt: {
      id: resolvedAttempt.id,
      attemptNumber: resolvedAttempt.attemptNumber,
      status: resolvedAttempt.status,
      startedAt: resolvedAttempt.startedAt.toISOString(),
      expiresAt: resolvedAttempt.expiresAt.toISOString(),
      submittedAt: resolvedAttempt.submittedAt?.toISOString(),
    },
  };

  if (!isTerminalExamAttemptStatus(resolvedAttempt.status)) {
    return detail;
  }

  if (!exam) {
    throw new ExamNotFoundError();
  }

  const graded = await ensureTerminalAttemptGrading(resolvedAttempt, exam, now);
  const preparedAttempt = toPreparedTerminalAttempt(graded.attempt);
  const result = buildExamAttemptResult(preparedAttempt, graded.exam, {
    score: true,
    answers: true,
  });

  detail.attempt = result.attempt;
  detail.exam = toExamIdentity(graded.exam);
  detail.score = result.score;
  detail.answerReview = result.answerReview;
  return detail;
}

export async function getAdminStudentDetail(
  actor: AppUser,
  studentId: string,
): Promise<AdminStudentDetail> {
  assertAdmin(actor);
  const student = await findUserById(studentId);

  if (!student || student.role !== USER_ROLE.STUDENT) {
    throw new StudentNotFoundError();
  }

  const now = new Date();
  await reconcileExpiredAttempts(now, { studentId });
  const [storedTerminalAttempts, activeAttempts] = await Promise.all([
    listTerminalExamAttemptRecords({ studentId }),
    listActiveExamAttemptRecords({ studentId }),
  ]);
  const examIds = uniqueIds([
    ...storedTerminalAttempts.map((attempt) => attempt.examId),
    ...activeAttempts.map((attempt) => attempt.examId),
  ]);
  const examMap = await getExamMap(examIds);
  const terminalAttempts = await prepareTerminalAttempts(
    storedTerminalAttempts,
    examMap,
    now,
  );
  const terminalByExam = new Map<string, PreparedTerminalAttempt[]>();
  const activeCountByExam = new Map<string, number>();

  for (const attempt of terminalAttempts) {
    const attempts = terminalByExam.get(attempt.examId) ?? [];
    attempts.push(attempt);
    terminalByExam.set(attempt.examId, attempts);
  }

  for (const attempt of activeAttempts) {
    activeCountByExam.set(
      attempt.examId,
      (activeCountByExam.get(attempt.examId) ?? 0) + 1,
    );
  }

  const exams = examIds.map((examId) => {
    const exam = examMap.get(examId);
    const attempts = terminalByExam.get(examId) ?? [];

    return {
      exam: exam ? toExamIdentity(exam) : null,
      activeAttemptCount: activeCountByExam.get(examId) ?? 0,
      statistics: calculatePerformanceStatistics(attempts.map(toScoredAttempt)),
    };
  });
  exams.sort((left, right) => {
    if (!left.exam) return 1;
    if (!right.exam) return -1;
    return left.exam.title.localeCompare(right.exam.title, "vi");
  });
  const overallStatistics = calculatePerformanceStatistics(
    terminalAttempts.map(toScoredAttempt),
  );

  return {
    student: toStudentAccount(student),
    activeAttemptCount: activeAttempts.length,
    distinctExamCount: examIds.length,
    statistics: {
      completedAttemptCount: overallStatistics.completedAttemptCount,
      average: overallStatistics.average,
      best: overallStatistics.best,
      latest: overallStatistics.latest,
    },
    exams,
  };
}

export async function getAdminExamResults(
  actor: AppUser,
  examId: string,
): Promise<AdminExamResults> {
  assertAdmin(actor);
  const exam = await findExamReportingRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  const now = new Date();
  await reconcileExpiredAttempts(now, { examId }, exam);
  const [storedTerminalAttempts, activeAttempts] = await Promise.all([
    listTerminalExamAttemptRecords({ examId }),
    listActiveExamAttemptRecords({ examId }),
  ]);
  const examMap = new Map([[exam.id, exam]]);
  const terminalAttempts = await prepareTerminalAttempts(
    storedTerminalAttempts,
    examMap,
    now,
  );
  const studentMap = await getStudentMap(
    terminalAttempts.map((attempt) => attempt.studentId),
  );
  const attemptsByStudent = new Map<string, PreparedTerminalAttempt[]>();

  for (const attempt of terminalAttempts) {
    const attempts = attemptsByStudent.get(attempt.studentId) ?? [];
    attempts.push(attempt);
    attemptsByStudent.set(attempt.studentId, attempts);
  }

  const students = [...attemptsByStudent.entries()].map(
    ([studentId, attempts]) => {
      const student = studentMap.get(studentId);
      return {
        student: student ? toStudentIdentity(student) : null,
        statistics: calculatePerformanceStatistics(
          attempts.map(toScoredAttempt),
        ),
      };
    },
  );
  students.sort((left, right) => {
    if (!left.student) return 1;
    if (!right.student) return -1;
    return left.student.fullName.localeCompare(right.student.fullName, "vi");
  });
  const submittedAttemptCount = terminalAttempts.filter(
    (attempt) => attempt.status === EXAM_ATTEMPT_STATUS.SUBMITTED,
  ).length;
  const autoSubmittedAttemptCount = terminalAttempts.filter(
    (attempt) => attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
  ).length;

  const currentExam = examMap.get(exam.id) ?? exam;

  return {
    exam: toExamIdentity(currentExam),
    activeAttemptCount: activeAttempts.length,
    completedAttemptCount: terminalAttempts.length,
    distinctStudentCount: attemptsByStudent.size,
    submittedAttemptCount,
    autoSubmittedAttemptCount,
    statistics: toScoreStatistics(
      calculateScoreAggregate(terminalAttempts.map(toScoredAttempt)),
    ),
    students,
  };
}

export async function getStudentExamAttemptHistory(
  actor: AppUser,
  examId: string,
  query: PaginationQuery,
): Promise<StudentExamAttemptHistory> {
  assertStudent(actor);
  const [exam, latestAttempt] = await Promise.all([
    findExamReportingRecordById(examId),
    findLatestExamAttemptRecord(actor.id, examId),
  ]);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  if (
    !latestAttempt &&
    !(await isPublishedExamAvailableToStudent(examId, actor.id))
  ) {
    throw new ExamNotFoundError();
  }

  const now = new Date();
  const filter = { studentId: actor.id, examId };
  await reconcileExpiredAttempts(now, filter, exam);
  const page = await listTerminalExamAttemptRecordPage(
    filter,
    query.page,
    query.pageSize,
  );
  const examMap = new Map([[exam.id, exam]]);
  const attempts = await prepareTerminalAttempts(page.attempts, examMap, now);
  const currentExam = examMap.get(exam.id) ?? exam;

  return {
    exam: {
      id: currentExam.id,
      title: currentExam.title,
    },
    visibility: {
      score: currentExam.settings.showScoreAfterSubmission,
      answers: currentExam.settings.showAnswersAfterSubmission,
    },
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt.toISOString(),
      timeUsedSeconds: getAttemptTimeUsedSeconds(attempt),
      ...(currentExam.settings.showScoreAfterSubmission
        ? {
            score: scoreHundredthsToPoints(
              attempt.grading.totalScoreHundredths,
            ),
          }
        : {}),
    })),
    pagination: toPaginationMetadata(query, page.totalItems),
  };
}
