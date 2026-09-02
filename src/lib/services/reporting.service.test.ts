import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countExamAttemptRecordsByStatus: vi.fn(),
  findExamAttemptRecordById: vi.fn(),
  findLatestExamAttemptRecord: vi.fn(),
  listActiveExamAttemptRecords: vi.fn(),
  listExpiredExamAttemptRecords: vi.fn(),
  listTerminalExamAttemptRecordPage: vi.fn(),
  listTerminalExamAttemptRecords: vi.fn(),
  countExamRecords: vi.fn(),
  findExamReportingRecordById: vi.fn(),
  findExamReportingRecordsByIds: vi.fn(),
  isPublishedExamAvailableToStudent: vi.fn(),
  findTopicRecordsByIds: vi.fn(),
  countStudentUsers: vi.fn(),
  findStudentUsersByIds: vi.fn(),
  findUserById: vi.fn(),
  buildExamAttemptResult: vi.fn(),
  ensureTerminalAttemptGrading: vi.fn(),
  isTerminalExamAttemptStatus: vi.fn(),
  resolveAttemptExpiration: vi.fn(),
}));

vi.mock("@/lib/db/dao/exam-attempt.dao", () => ({
  countExamAttemptRecordsByStatus: mocks.countExamAttemptRecordsByStatus,
  findExamAttemptRecordById: mocks.findExamAttemptRecordById,
  findLatestExamAttemptRecord: mocks.findLatestExamAttemptRecord,
  listActiveExamAttemptRecords: mocks.listActiveExamAttemptRecords,
  listExpiredExamAttemptRecords: mocks.listExpiredExamAttemptRecords,
  listTerminalExamAttemptRecordPage: mocks.listTerminalExamAttemptRecordPage,
  listTerminalExamAttemptRecords: mocks.listTerminalExamAttemptRecords,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  countExamRecords: mocks.countExamRecords,
  findExamReportingRecordById: mocks.findExamReportingRecordById,
  findExamReportingRecordsByIds: mocks.findExamReportingRecordsByIds,
  isPublishedExamAvailableToStudent: mocks.isPublishedExamAvailableToStudent,
}));

vi.mock("@/lib/db/dao/topic.dao", () => ({
  findTopicRecordsByIds: mocks.findTopicRecordsByIds,
}));

vi.mock("@/lib/db/dao/user.dao", () => ({
  countStudentUsers: mocks.countStudentUsers,
  findStudentUsersByIds: mocks.findStudentUsersByIds,
  findUserById: mocks.findUserById,
}));

vi.mock("@/lib/services/exam-attempt.service", () => ({
  buildExamAttemptResult: mocks.buildExamAttemptResult,
  ensureTerminalAttemptGrading: mocks.ensureTerminalAttemptGrading,
  isTerminalExamAttemptStatus: mocks.isTerminalExamAttemptStatus,
  resolveAttemptExpiration: mocks.resolveAttemptExpiration,
}));

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { EXAM_STATUS } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import type { ExamAttemptPersistenceRecord } from "@/lib/db/dao/exam-attempt.dao";
import type { ExamReportingPersistenceRecord } from "@/lib/db/dao/exam.dao";
import type { UserAccountRecord } from "@/lib/db/dao/user.dao";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";
import {
  getAdminAttemptDetail,
  getAdminDashboardSummary,
  getAdminExamResults,
  getStudentExamAttemptHistory,
  listAdminResults,
} from "@/lib/services/reporting.service";
import type { AttemptGradingSnapshot } from "@/types/exam-attempt";
import type { ExamAnswerKey } from "@/types/exam";
import type { AppUser } from "@/types/user";

const now = new Date("2026-08-11T03:00:00.000Z");
const admin: AppUser = {
  id: "admin-id",
  username: "admin",
  fullName: "Quan Tri Vien",
  role: USER_ROLE.ADMIN,
};
const studentActor: AppUser = {
  id: "student-id",
  username: "student",
  fullName: "Nguyen Van An",
  role: USER_ROLE.STUDENT,
};

function createAnswerKey(): ExamAnswerKey {
  return {
    partOne: Array.from({ length: 12 }, () => "A" as const),
    partTwo: Array.from({ length: 4 }, () => ({
      a: true,
      b: false,
      c: true,
      d: false,
    })),
    partThree: ["1", "2", "3", "4", "5", "6"],
  };
}

function createGrading(score = 750): AttemptGradingSnapshot {
  return {
    answerKeyRevision: 1,
    totalScoreHundredths: score,
    sectionScoresHundredths: {
      partOne: Math.min(score, 300),
      partTwo: Math.min(Math.max(score - 300, 0), 400),
      partThree: Math.min(Math.max(score - 700, 0), 300),
    },
    partOne: Array.from({ length: 12 }, () => ({ isCorrect: false })),
    partTwo: Array.from({ length: 4 }, () => ({
      correctStatementCount: 0,
      scoreHundredths: 0,
      statements: { a: false, b: false, c: false, d: false },
    })),
    partThree: Array.from({ length: 6 }, () => ({ isCorrect: false })),
  };
}

function createFirstQuestionGrading(
  isCorrect: boolean,
  answerKeyRevision = 1,
): AttemptGradingSnapshot {
  const grading = createGrading(isCorrect ? 25 : 0);
  grading.answerKeyRevision = answerKeyRevision;
  grading.partOne[0] = { isCorrect };
  return grading;
}

function createExam(
  overrides: Partial<ExamReportingPersistenceRecord> = {},
): ExamReportingPersistenceRecord {
  return {
    id: "exam-id",
    title: "Đề thi thử Toán số 1",
    status: EXAM_STATUS.PUBLISHED,
    answerKey: createAnswerKey(),
    answerKeyRevision: 1,
    settings: {
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: true,
    },
    questionTopicIds: createEmptyQuestionTopicIds(),
    ...overrides,
  };
}

function createStudent(
  overrides: Partial<UserAccountRecord> = {},
): UserAccountRecord {
  return {
    id: studentActor.id,
    username: studentActor.username,
    fullName: studentActor.fullName,
    role: USER_ROLE.STUDENT,
    isActive: true,
    sessionVersion: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createAttempt(
  overrides: Partial<ExamAttemptPersistenceRecord> = {},
): ExamAttemptPersistenceRecord {
  return {
    id: "attempt-id",
    examId: "exam-id",
    studentId: studentActor.id,
    attemptNumber: 1,
    status: EXAM_ATTEMPT_STATUS.SUBMITTED,
    startedAt: new Date("2026-08-11T01:00:00.000Z"),
    expiresAt: new Date("2026-08-11T02:30:00.000Z"),
    submittedAt: new Date("2026-08-11T02:00:00.000Z"),
    answers: createEmptyAttemptAnswers(),
    answerRevision: 0,
    grading: createGrading(),
    gradedAt: new Date("2026-08-11T02:00:00.000Z"),
    createdAt: new Date("2026-08-11T01:00:00.000Z"),
    updatedAt: new Date("2026-08-11T02:00:00.000Z"),
    ...overrides,
  };
}

describe("reporting service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.listExpiredExamAttemptRecords.mockResolvedValue([]);
    mocks.listActiveExamAttemptRecords.mockResolvedValue([]);
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([]);
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [],
      totalItems: 0,
    });
    mocks.findExamAttemptRecordById.mockResolvedValue(null);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(null);
    mocks.findExamReportingRecordById.mockResolvedValue(createExam());
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(true);
    mocks.findExamReportingRecordsByIds.mockImplementation(
      (examIds: string[]) =>
        Promise.resolve(examIds.map((id) => createExam({ id }))),
    );
    mocks.findTopicRecordsByIds.mockImplementation((topicIds: string[]) =>
      Promise.resolve(
        topicIds.map((id) => ({
          id,
          name: id,
          normalizedName: id,
          createdAt: now,
          updatedAt: now,
        })),
      ),
    );
    mocks.findStudentUsersByIds.mockImplementation((studentIds: string[]) =>
      Promise.resolve(studentIds.map((id) => createStudent({ id }))),
    );
    mocks.countStudentUsers.mockResolvedValue({ total: 3, active: 2 });
    mocks.countExamRecords.mockResolvedValue({ total: 4, published: 3 });
    mocks.countExamAttemptRecordsByStatus.mockResolvedValue({
      inProgress: 1,
      submitted: 5,
      autoSubmitted: 2,
    });
    mocks.isTerminalExamAttemptStatus.mockImplementation(
      (status: string) => status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    );
    mocks.resolveAttemptExpiration.mockImplementation(
      (attempt: ExamAttemptPersistenceRecord) => Promise.resolve(attempt),
    );
    mocks.ensureTerminalAttemptGrading.mockImplementation(
      (
        attempt: ExamAttemptPersistenceRecord,
        exam: ExamReportingPersistenceRecord,
      ) => Promise.resolve({ attempt, exam }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a STUDENT before reading ADMIN dashboard data", async () => {
    await expect(getAdminDashboardSummary(studentActor)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(mocks.listExpiredExamAttemptRecords).not.toHaveBeenCalled();
  });

  it("reconciles expired attempts before returning dashboard counts", async () => {
    const expiredAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      submittedAt: undefined,
      grading: undefined,
      expiresAt: new Date("2026-08-11T02:59:00.000Z"),
    });
    mocks.listExpiredExamAttemptRecords.mockResolvedValue([expiredAttempt]);

    const summary = await getAdminDashboardSummary(admin);

    expect(mocks.findExamReportingRecordsByIds).toHaveBeenCalledWith([
      expiredAttempt.examId,
    ]);
    expect(mocks.resolveAttemptExpiration).toHaveBeenCalledWith(
      expiredAttempt,
      now,
    );
    expect(summary).toEqual({
      activeStudentCount: 2,
      examCount: 4,
      publishedExamCount: 3,
      activeAttemptCount: 1,
      completedAttemptCount: 7,
    });
  });

  it("returns paginated result DTOs with batched identities and immutable grading", async () => {
    const attempts = [
      createAttempt({ id: "attempt-one" }),
      createAttempt({ id: "attempt-two", attemptNumber: 2 }),
    ];
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts,
      totalItems: 22,
    });

    const result = await listAdminResults(admin, {
      page: 2,
      pageSize: 20,
    });

    expect(mocks.findExamReportingRecordsByIds).toHaveBeenCalledWith([
      "exam-id",
    ]);
    expect(mocks.findStudentUsersByIds).toHaveBeenCalledWith([studentActor.id]);
    expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 22,
      totalPages: 2,
    });
    expect(result.results[0]).toMatchObject({
      id: "attempt-one",
      student: { id: studentActor.id, fullName: studentActor.fullName },
      exam: { id: "exam-id", title: "Đề thi thử Toán số 1" },
      score: { total: 7.5 },
    });
    expect(JSON.stringify(result)).not.toContain("answerKey");
    expect(JSON.stringify(result)).not.toContain('"answers"');
    expect(JSON.stringify(result)).not.toContain("scoreHundredths");
  });

  it("counts submitted and auto-submitted retakes but excludes active attempts", async () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["algebra-topic"];
    const submittedAttempt = createAttempt({
      id: "submitted-attempt",
      grading: createFirstQuestionGrading(true),
    });
    const autoSubmittedAttempt = createAttempt({
      id: "auto-submitted-attempt",
      attemptNumber: 2,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      grading: createFirstQuestionGrading(false),
    });
    const activeAttempt = createAttempt({
      id: "active-attempt",
      attemptNumber: 3,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      submittedAt: undefined,
      grading: undefined,
      gradedAt: undefined,
    });
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([
      submittedAttempt,
      autoSubmittedAttempt,
    ]);
    mocks.listActiveExamAttemptRecords.mockResolvedValue([activeAttempt]);
    mocks.findExamReportingRecordById.mockResolvedValue(
      createExam({ questionTopicIds }),
    );

    const report = await getAdminExamResults(admin, "exam-id");

    expect(mocks.listTerminalExamAttemptRecords).toHaveBeenCalledWith({
      examId: "exam-id",
    });
    expect(report).toMatchObject({
      activeAttemptCount: 1,
      completedAttemptCount: 2,
      distinctStudentCount: 1,
      submittedAttemptCount: 1,
      autoSubmittedAttemptCount: 1,
    });
    expect(report.questionStatistics.partOne[0]).toEqual({
      questionNumber: 1,
      completedAttemptCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      correctRatePercent: 50,
    });
    expect(report.topicStatistics).toEqual([
      {
        topicId: "algebra-topic",
        topicName: "algebra-topic",
        taggedQuestionCount: 1,
        observationCount: 2,
        averagePerformancePercent: 50,
      },
    ]);
    expect(mocks.findTopicRecordsByIds).toHaveBeenCalledTimes(1);
    expect(mocks.findTopicRecordsByIds).toHaveBeenCalledWith(["algebra-topic"]);
  });

  it("returns ordered zero-attempt question statistics safely", async () => {
    const report = await getAdminExamResults(admin, "exam-id");

    expect(report.completedAttemptCount).toBe(0);
    expect(report.questionStatistics.partOne).toHaveLength(12);
    expect(report.questionStatistics.partTwo).toHaveLength(4);
    expect(report.questionStatistics.partThree).toHaveLength(6);
    expect(report.questionStatistics.partOne[0]).toEqual({
      questionNumber: 1,
      completedAttemptCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      correctRatePercent: null,
    });
    expect(report.questionStatistics.partTwo[0]).toEqual({
      questionNumber: 1,
      completedAttemptCount: 0,
      fullCorrectCount: 0,
      fullCorrectRatePercent: null,
      averageScoreHundredths: null,
      statements: {
        a: { correctCount: 0, correctRatePercent: null },
        b: { correctCount: 0, correctRatePercent: null },
        c: { correctCount: 0, correctRatePercent: null },
        d: { correctCount: 0, correctRatePercent: null },
      },
    });
    expect(report.questionStatistics.partThree[5].questionNumber).toBe(6);
  });

  it("reflects a reconciled grading snapshot instead of the stored answers", async () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["algebra-topic"];
    const currentExam = createExam({
      answerKeyRevision: 2,
      questionTopicIds,
    });
    const staleAttempt = createAttempt({
      grading: createFirstQuestionGrading(false, 1),
    });
    const revisedAttempt = createAttempt({
      grading: createFirstQuestionGrading(true, 2),
    });
    mocks.findExamReportingRecordById.mockResolvedValue(currentExam);
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([staleAttempt]);
    mocks.ensureTerminalAttemptGrading.mockResolvedValue({
      attempt: revisedAttempt,
      exam: currentExam,
    });

    const report = await getAdminExamResults(admin, currentExam.id);

    expect(mocks.ensureTerminalAttemptGrading).toHaveBeenCalledWith(
      staleAttempt,
      currentExam,
      now,
    );
    expect(report.questionStatistics.partOne[0]).toMatchObject({
      correctCount: 1,
      incorrectCount: 0,
      correctRatePercent: 100,
    });
    expect(report.topicStatistics[0]).toMatchObject({
      topicId: "algebra-topic",
      observationCount: 1,
      averagePerformancePercent: 100,
    });
  });

  it("keeps concurrently refreshed grading and topic metadata consistent", async () => {
    const initialTopicIds = createEmptyQuestionTopicIds();
    initialTopicIds.partOne[0] = ["algebra-topic"];
    const refreshedTopicIds = createEmptyQuestionTopicIds();
    refreshedTopicIds.partOne[1] = ["algebra-topic"];
    const initialExam = createExam({
      answerKeyRevision: 2,
      questionTopicIds: initialTopicIds,
    });
    const refreshedExam = createExam({
      answerKeyRevision: 3,
      questionTopicIds: refreshedTopicIds,
    });
    const refreshedGrading = createGrading(25);
    refreshedGrading.answerKeyRevision = 3;
    refreshedGrading.partOne[1] = { isCorrect: true };
    const staleAttempt = createAttempt({
      grading: createFirstQuestionGrading(false, 1),
    });
    const refreshedAttempt = createAttempt({ grading: refreshedGrading });
    mocks.findExamReportingRecordById.mockResolvedValue(initialExam);
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([staleAttempt]);
    mocks.ensureTerminalAttemptGrading.mockResolvedValue({
      attempt: refreshedAttempt,
      exam: refreshedExam,
    });

    const report = await getAdminExamResults(admin, initialExam.id);

    expect(report.topicStatistics[0]).toMatchObject({
      taggedQuestionCount: 1,
      observationCount: 1,
      averagePerformancePercent: 100,
    });
  });

  it("uses current topic assignments without regrading existing attempts", async () => {
    const originalTopicIds = createEmptyQuestionTopicIds();
    originalTopicIds.partOne[0] = ["algebra-topic"];
    const updatedTopicIds = createEmptyQuestionTopicIds();
    updatedTopicIds.partOne[1] = ["algebra-topic"];
    const grading = createFirstQuestionGrading(true);
    const attempt = createAttempt({ grading });
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([attempt]);
    mocks.findExamReportingRecordById
      .mockResolvedValueOnce(createExam({ questionTopicIds: originalTopicIds }))
      .mockResolvedValueOnce(createExam({ questionTopicIds: updatedTopicIds }));

    const originalReport = await getAdminExamResults(admin, "exam-id");
    const updatedReport = await getAdminExamResults(admin, "exam-id");

    expect(originalReport.topicStatistics[0].averagePerformancePercent).toBe(
      100,
    );
    expect(updatedReport.topicStatistics[0]).toMatchObject({
      taggedQuestionCount: 1,
      observationCount: 1,
      averagePerformancePercent: 0,
    });
    expect(attempt.grading).toBe(grading);
    expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
  });

  it("backfills only a missing legacy grading snapshot", async () => {
    const legacyAttempt = createAttempt({
      grading: undefined,
      gradedAt: undefined,
    });
    const gradedAttempt = createAttempt();
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [legacyAttempt],
      totalItems: 1,
    });
    mocks.ensureTerminalAttemptGrading.mockResolvedValue({
      attempt: gradedAttempt,
      exam: createExam(),
    });

    const result = await listAdminResults(admin, { page: 1, pageSize: 20 });

    expect(mocks.ensureTerminalAttemptGrading).toHaveBeenCalledWith(
      legacyAttempt,
      expect.objectContaining({ id: legacyAttempt.examId }),
      now,
    );
    expect(mocks.ensureTerminalAttemptGrading).toHaveBeenCalledTimes(1);
    expect(result.results[0].score.total).toBe(7.5);
  });

  it("uses refreshed visibility settings with a concurrently revised grading", async () => {
    const initialExam = createExam({
      title: "Tên đề cũ",
      answerKeyRevision: 1,
      settings: {
        showScoreAfterSubmission: true,
        showAnswersAfterSubmission: false,
      },
    });
    const correctedExam = createExam({
      title: "Tên đề đã sửa",
      answerKeyRevision: 2,
      settings: {
        showScoreAfterSubmission: false,
        showAnswersAfterSubmission: false,
      },
    });
    const revisedGrading = createGrading();
    revisedGrading.answerKeyRevision = 2;
    const revisedAttempt = createAttempt({ grading: revisedGrading });
    mocks.findExamReportingRecordById.mockResolvedValue(initialExam);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(revisedAttempt);
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [revisedAttempt],
      totalItems: 1,
    });
    mocks.ensureTerminalAttemptGrading.mockResolvedValue({
      attempt: revisedAttempt,
      exam: correctedExam,
    });

    const history = await getStudentExamAttemptHistory(
      studentActor,
      initialExam.id,
      { page: 1, pageSize: 20 },
    );

    expect(history.exam.title).toBe(correctedExam.title);
    expect(history.visibility).toEqual({ score: false, answers: false });
    expect(history.attempts[0]).not.toHaveProperty("score");
  });

  it("does not expose answers for an unexpired active ADMIN detail", async () => {
    const activeAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      submittedAt: undefined,
      grading: undefined,
      gradedAt: undefined,
      expiresAt: new Date("2026-08-11T04:00:00.000Z"),
    });
    mocks.findExamAttemptRecordById.mockResolvedValue(activeAttempt);

    const detail = await getAdminAttemptDetail(admin, activeAttempt.id);

    expect(detail.attempt.status).toBe(EXAM_ATTEMPT_STATUS.IN_PROGRESS);
    expect(detail).not.toHaveProperty("score");
    expect(detail).not.toHaveProperty("answerReview");
    expect(JSON.stringify(detail)).not.toContain('"answers"');
    expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
    expect(mocks.buildExamAttemptResult).not.toHaveBeenCalled();
  });

  it("gives ADMIN a terminal review regardless of student visibility settings", async () => {
    const attempt = createAttempt();
    const exam = createExam({
      settings: {
        showScoreAfterSubmission: false,
        showAnswersAfterSubmission: false,
      },
    });
    mocks.findExamAttemptRecordById.mockResolvedValue(attempt);
    mocks.findExamReportingRecordById.mockResolvedValue(exam);
    mocks.buildExamAttemptResult.mockReturnValue({
      exam: { id: exam.id, title: exam.title },
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        timeUsedSeconds: 3600,
      },
      visibility: { score: true, answers: true },
      score: {
        total: 7.5,
        sections: { partOne: 3, partTwo: 4, partThree: 0.5 },
      },
      answerReview: { partOne: [], partTwo: [], partThree: [] },
    });

    const detail = await getAdminAttemptDetail(admin, attempt.id);

    expect(mocks.buildExamAttemptResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: attempt.id }),
      exam,
      { score: true, answers: true },
    );
    expect(detail.score?.total).toBe(7.5);
    expect(detail.answerReview).toEqual({
      partOne: [],
      partTwo: [],
      partThree: [],
    });
  });

  it("honors current score visibility in a student's hidden-Exam history", async () => {
    const attempt = createAttempt();
    const hiddenExam = createExam({
      status: EXAM_STATUS.HIDDEN,
      settings: {
        showScoreAfterSubmission: false,
        showAnswersAfterSubmission: false,
      },
    });
    mocks.findExamReportingRecordById.mockResolvedValue(hiddenExam);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(attempt);
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [attempt],
      totalItems: 1,
    });

    const history = await getStudentExamAttemptHistory(
      studentActor,
      hiddenExam.id,
      { page: 1, pageSize: 20 },
    );

    expect(history.visibility).toEqual({ score: false, answers: false });
    expect(history.attempts[0]).not.toHaveProperty("score");
    expect(JSON.stringify(history)).not.toContain("totalScoreHundredths");
    expect(mocks.findLatestExamAttemptRecord).toHaveBeenCalledWith(
      studentActor.id,
      hiddenExam.id,
    );
  });

  it("keeps owned history accessible after the student is unassigned", async () => {
    const attempt = createAttempt();
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(false);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(attempt);
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [attempt],
      totalItems: 1,
    });

    const history = await getStudentExamAttemptHistory(
      studentActor,
      attempt.examId,
      { page: 1, pageSize: 20 },
    );

    expect(history.attempts).toHaveLength(1);
    expect(mocks.isPublishedExamAvailableToStudent).not.toHaveBeenCalled();
  });

  it("does not expose an unassigned Exam through history without ownership", async () => {
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(false);

    await expect(
      getStudentExamAttemptHistory(studentActor, "exam-id", {
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ code: "EXAM_NOT_FOUND", statusCode: 404 });
    expect(mocks.listTerminalExamAttemptRecordPage).not.toHaveBeenCalled();
  });
});
