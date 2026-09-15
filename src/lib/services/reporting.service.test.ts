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

import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STATUS } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
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
  getAdminStudentDetail,
  getStudentExamAttemptHistory,
  listAdminResults,
} from "@/lib/services/reporting.service";
import type {
  AttemptGradingSnapshot,
  DynamicAttemptGradingSnapshot,
} from "@/types/exam-attempt";
import type { ExamAnswerKey } from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
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
const dynamicStructure: ExamStructureSnapshot = {
  sections: [
    {
      id: "section-z",
      title: "Section Z",
      questions: [
        {
          id: "choice-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 150,
        },
        {
          id: "true-false-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          maxScoreHundredths: 300,
        },
      ],
    },
    {
      id: "section-a",
      title: "Section A",
      questions: [
        {
          id: "short-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          maxScoreHundredths: 550,
        },
      ],
    },
  ],
};
const essayReportingStructure: ExamStructureSnapshot = {
  sections: [
    {
      id: "essay-section",
      title: "Essay section",
      questions: [
        {
          id: "essay-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          maxScoreHundredths: 400,
        },
        {
          id: "essay-choice",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 100,
        },
        {
          id: "essay-true-false",
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          maxScoreHundredths: 200,
        },
        {
          id: "essay-short",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          maxScoreHundredths: 300,
        },
      ],
    },
  ],
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

function createDynamicExam(
  overrides: Partial<ExamReportingPersistenceRecord> = {},
): ExamReportingPersistenceRecord {
  return createExam({
    answerKey: {
      answersByQuestionId: {
        "choice-question": "A",
        "true-false-question": { a: true, b: true, c: true, d: true },
        "short-question": "1",
      },
    },
    structureSnapshot: dynamicStructure,
    questionTopics: dynamicStructure.sections.flatMap((section) =>
      section.questions.map((question) => ({
        questionId: question.id,
        topicIds: [],
      })),
    ),
    ...overrides,
  });
}

function createDynamicGrading({
  answerKeyRevision = 1,
  choiceCorrect = true,
  trueFalseScoreHundredths = 150,
  trueFalseCorrectStatementCount = 3,
  shortCorrect = false,
}: {
  answerKeyRevision?: number;
  choiceCorrect?: boolean;
  trueFalseScoreHundredths?: number;
  trueFalseCorrectStatementCount?: number;
  shortCorrect?: boolean;
} = {}): DynamicAttemptGradingSnapshot {
  const choiceScoreHundredths = choiceCorrect ? 150 : 0;
  const shortScoreHundredths = shortCorrect ? 550 : 0;

  return {
    answerKeyRevision,
    totalScoreHundredths:
      choiceScoreHundredths + trueFalseScoreHundredths + shortScoreHundredths,
    sectionScoresHundredths: {
      "section-z": choiceScoreHundredths + trueFalseScoreHundredths,
      "section-a": shortScoreHundredths,
    },
    questionsById: {
      "choice-question": {
        isCorrect: choiceCorrect,
        scoreHundredths: choiceScoreHundredths,
      },
      "true-false-question": {
        correctStatementCount: trueFalseCorrectStatementCount,
        scoreHundredths: trueFalseScoreHundredths,
        statements: {
          a: trueFalseCorrectStatementCount >= 1,
          b: trueFalseCorrectStatementCount >= 2,
          c: trueFalseCorrectStatementCount >= 3,
          d: trueFalseCorrectStatementCount >= 4,
        },
      },
      "short-question": {
        isCorrect: shortCorrect,
        scoreHundredths: shortScoreHundredths,
      },
    },
  };
}

function createEssayReportingExam(
  overrides: Partial<ExamReportingPersistenceRecord> = {},
): ExamReportingPersistenceRecord {
  return createExam({
    answerKey: {
      answersByQuestionId: {
        "essay-choice": "A",
        "essay-true-false": { a: true, b: false, c: true, d: false },
        "essay-short": "1",
      },
    },
    structureSnapshot: essayReportingStructure,
    questionTopics: [
      {
        questionId: "essay-question",
        topicIds: ["shared-topic", "essay-only-topic"],
      },
      { questionId: "essay-choice", topicIds: ["shared-topic"] },
      { questionId: "essay-true-false", topicIds: ["objective-topic"] },
      { questionId: "essay-short", topicIds: ["objective-topic"] },
    ],
    ...overrides,
  });
}

function createPendingEssayGrading(): DynamicAttemptGradingSnapshot {
  return {
    answerKeyRevision: 1,
    objectiveScoreHundredths: 200,
    objectiveMaxScoreHundredths: 600,
    sectionScoresHundredths: { "essay-section": 200 },
    questionsById: {
      "essay-choice": { isCorrect: true, scoreHundredths: 100 },
      "essay-true-false": {
        correctStatementCount: 3,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: false },
      },
      "essay-short": { isCorrect: false, scoreHundredths: 0 },
    },
  };
}

function createCompletedEssayGrading(
  essayScoreHundredths: number,
): DynamicAttemptGradingSnapshot {
  return {
    answerKeyRevision: 1,
    totalScoreHundredths: 200 + essayScoreHundredths,
    sectionScoresHundredths: {
      "essay-section": 200 + essayScoreHundredths,
    },
    questionsById: {
      "essay-choice": { isCorrect: true, scoreHundredths: 100 },
      "essay-true-false": {
        correctStatementCount: 3,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: false },
      },
      "essay-short": { isCorrect: false, scoreHundredths: 0 },
    },
    manualEssayScores: [
      { questionId: "essay-question", scoreHundredths: essayScoreHundredths },
    ],
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
    mocks.findUserById.mockResolvedValue(createStudent());
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

  it("aggregates one student's terminal topic observations across current Exams", async () => {
    const firstExamTopicIds = createEmptyQuestionTopicIds();
    firstExamTopicIds.partOne[0] = ["shared-topic"];
    firstExamTopicIds.partTwo[0] = ["shared-topic", "partial-topic"];
    const secondExamTopicIds = createEmptyQuestionTopicIds();
    secondExamTopicIds.partThree[0] = ["shared-topic"];
    const firstGrading = createGrading(0);
    firstGrading.partOne[0] = { isCorrect: true };
    firstGrading.partTwo[0] = {
      correctStatementCount: 2,
      scoreHundredths: 25,
      statements: { a: true, b: true, c: false, d: false },
    };
    const retakeGrading = createGrading(0);
    retakeGrading.partTwo[0] = {
      correctStatementCount: 3,
      scoreHundredths: 50,
      statements: { a: true, b: true, c: true, d: false },
    };
    const secondExamGrading = createGrading(0);
    secondExamGrading.partThree[0] = { isCorrect: true };
    const terminalAttempts = [
      createAttempt({
        id: "first-exam-attempt",
        examId: "exam-one",
        grading: firstGrading,
      }),
      createAttempt({
        id: "first-exam-retake",
        examId: "exam-one",
        attemptNumber: 2,
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
        grading: retakeGrading,
      }),
      createAttempt({
        id: "hidden-exam-attempt",
        examId: "exam-two",
        grading: secondExamGrading,
      }),
    ];
    const activeAttempt = createAttempt({
      id: "active-attempt",
      examId: "exam-one",
      attemptNumber: 3,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      submittedAt: undefined,
      grading: undefined,
      gradedAt: undefined,
    });
    mocks.listTerminalExamAttemptRecords.mockResolvedValue(terminalAttempts);
    mocks.listActiveExamAttemptRecords.mockResolvedValue([activeAttempt]);
    mocks.findExamReportingRecordsByIds.mockResolvedValue([
      createExam({
        id: "exam-one",
        title: "Exam one",
        questionTopicIds: firstExamTopicIds,
      }),
      createExam({
        id: "exam-two",
        title: "Hidden exam",
        status: EXAM_STATUS.HIDDEN,
        questionTopicIds: secondExamTopicIds,
      }),
    ]);

    const detail = await getAdminStudentDetail(admin, studentActor.id);

    expect(detail.topicStatistics).toEqual([
      {
        topicId: "shared-topic",
        topicName: "shared-topic",
        observationCount: 5,
        averagePerformancePercent: 55,
      },
      {
        topicId: "partial-topic",
        topicName: "partial-topic",
        observationCount: 2,
        averagePerformancePercent: 37.5,
      },
    ]);
    expect(mocks.listTerminalExamAttemptRecords).toHaveBeenCalledWith({
      studentId: studentActor.id,
    });
    expect(mocks.listActiveExamAttemptRecords).toHaveBeenCalledWith({
      studentId: studentActor.id,
    });
    expect(mocks.findExamReportingRecordsByIds).toHaveBeenCalledWith([
      "exam-one",
      "exam-two",
    ]);
    expect(mocks.findTopicRecordsByIds).toHaveBeenCalledTimes(1);
    expect(mocks.findTopicRecordsByIds).toHaveBeenCalledWith([
      "shared-topic",
      "partial-topic",
    ]);
  });

  it("applies current topic assignments to historical student snapshots", async () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[1] = ["current-topic"];
    const historicalGrading = createFirstQuestionGrading(true);
    const attempt = createAttempt({ grading: historicalGrading });
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([attempt]);
    mocks.findExamReportingRecordsByIds.mockResolvedValue([
      createExam({ questionTopicIds }),
    ]);

    const detail = await getAdminStudentDetail(admin, studentActor.id);

    expect(detail.topicStatistics).toEqual([
      {
        topicId: "current-topic",
        topicName: "current-topic",
        observationCount: 1,
        averagePerformancePercent: 0,
      },
    ]);
    expect(attempt.grading).toBe(historicalGrading);
    expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
  });

  it("uses an updated persisted grading snapshot in student topic analytics", async () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["corrected-topic"];
    const currentExam = createExam({
      answerKeyRevision: 2,
      questionTopicIds,
    });
    const updatedAttempt = createAttempt({
      grading: createFirstQuestionGrading(true, 2),
    });
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([updatedAttempt]);
    mocks.findExamReportingRecordsByIds.mockResolvedValue([currentExam]);

    const detail = await getAdminStudentDetail(admin, studentActor.id);

    expect(detail.topicStatistics[0]).toMatchObject({
      topicId: "corrected-topic",
      observationCount: 1,
      averagePerformancePercent: 100,
    });
    expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
  });

  it("returns empty student topic analytics when completed Exams have no topics", async () => {
    mocks.listTerminalExamAttemptRecords.mockResolvedValue([createAttempt()]);

    const detail = await getAdminStudentDetail(admin, studentActor.id);

    expect(detail.topicStatistics).toEqual([]);
  });

  it("returns empty student topic analytics without completed attempts", async () => {
    const detail = await getAdminStudentDetail(admin, studentActor.id);

    expect(detail.topicStatistics).toEqual([]);
  });

  describe("Phase 2B dynamic reporting", () => {
    it("returns ordered dynamic Exam question and Topic analytics from persisted grading", async () => {
      const exam = createDynamicExam({
        questionTopics: [
          { questionId: "choice-question", topicIds: ["shared-topic"] },
          {
            questionId: "true-false-question",
            topicIds: ["shared-topic"],
          },
          { questionId: "short-question", topicIds: ["short-topic"] },
        ],
      });
      const attempts = [
        createAttempt({
          id: "dynamic-attempt-one",
          grading: createDynamicGrading(),
        }),
        createAttempt({
          id: "dynamic-attempt-two",
          studentId: "student-two",
          status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
          grading: createDynamicGrading({
            choiceCorrect: false,
            trueFalseScoreHundredths: 300,
            trueFalseCorrectStatementCount: 4,
            shortCorrect: true,
          }),
        }),
      ];
      mocks.findExamReportingRecordById.mockResolvedValue(exam);
      mocks.listTerminalExamAttemptRecords.mockResolvedValue(attempts);

      const report = await getAdminExamResults(admin, exam.id);

      expect(
        report.dynamicQuestionStatistics?.sections.map((section) => ({
          sectionId: section.sectionId,
          questionIds: section.questions.map((question) => question.questionId),
          questionNumbers: section.questions.map(
            (question) => question.questionNumber,
          ),
        })),
      ).toEqual([
        {
          sectionId: "section-z",
          questionIds: ["choice-question", "true-false-question"],
          questionNumbers: [1, 2],
        },
        {
          sectionId: "section-a",
          questionIds: ["short-question"],
          questionNumbers: [1],
        },
      ]);
      expect(
        report.dynamicQuestionStatistics?.sections[0].questions[0],
      ).toEqual({
        sectionId: "section-z",
        sectionTitle: "Section Z",
        questionId: "choice-question",
        questionNumber: 1,
        questionType: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
        completedAttemptCount: 2,
        correctCount: 1,
        incorrectCount: 1,
        correctRatePercent: 50,
      });
      expect(
        report.dynamicQuestionStatistics?.sections[0].questions[1],
      ).toEqual({
        sectionId: "section-z",
        sectionTitle: "Section Z",
        questionId: "true-false-question",
        questionNumber: 2,
        questionType: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
        completedAttemptCount: 2,
        fullCorrectCount: 1,
        fullCorrectRatePercent: 50,
        averageScoreHundredths: 225,
        statements: {
          a: { correctCount: 2, correctRatePercent: 100 },
          b: { correctCount: 2, correctRatePercent: 100 },
          c: { correctCount: 2, correctRatePercent: 100 },
          d: { correctCount: 1, correctRatePercent: 50 },
        },
      });
      expect(report.topicStatistics).toEqual([
        {
          topicId: "shared-topic",
          topicName: "shared-topic",
          taggedQuestionCount: 2,
          observationCount: 4,
          averagePerformancePercent: 62.5,
        },
        {
          topicId: "short-topic",
          topicName: "short-topic",
          taggedQuestionCount: 1,
          observationCount: 2,
          averagePerformancePercent: 50,
        },
      ]);
      expect(report.questionStatistics).toEqual({
        partOne: [],
        partTwo: [],
        partThree: [],
      });
      expect(mocks.findStudentUsersByIds).toHaveBeenCalledTimes(1);
      expect(mocks.findStudentUsersByIds).toHaveBeenCalledWith([
        studentActor.id,
        "student-two",
      ]);
      expect(mocks.findTopicRecordsByIds).toHaveBeenCalledTimes(1);
      expect(mocks.findTopicRecordsByIds).toHaveBeenCalledWith([
        "shared-topic",
        "short-topic",
      ]);
      expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
    });

    it("applies current dynamic Topic edits to historical persisted grading without regrading", async () => {
      const originalExam = createDynamicExam({
        questionTopics: [
          { questionId: "choice-question", topicIds: ["edited-topic"] },
          { questionId: "true-false-question", topicIds: [] },
          { questionId: "short-question", topicIds: [] },
        ],
      });
      const editedExam = createDynamicExam({
        questionTopics: [
          { questionId: "choice-question", topicIds: [] },
          { questionId: "true-false-question", topicIds: [] },
          { questionId: "short-question", topicIds: ["edited-topic"] },
        ],
      });
      const grading = createDynamicGrading();
      const attempt = createAttempt({ grading });
      mocks.listTerminalExamAttemptRecords.mockResolvedValue([attempt]);
      mocks.findExamReportingRecordById
        .mockResolvedValueOnce(originalExam)
        .mockResolvedValueOnce(editedExam);

      const originalReport = await getAdminExamResults(admin, originalExam.id);
      const editedReport = await getAdminExamResults(admin, editedExam.id);

      expect(originalReport.topicStatistics[0]).toMatchObject({
        topicId: "edited-topic",
        averagePerformancePercent: 100,
      });
      expect(editedReport.topicStatistics[0]).toMatchObject({
        topicId: "edited-topic",
        averagePerformancePercent: 0,
      });
      expect(attempt.grading).toBe(grading);
      expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
    });

    it("uses a reconciled dynamic grading snapshot for question and Topic analytics", async () => {
      const exam = createDynamicExam({
        answerKeyRevision: 2,
        questionTopics: [
          { questionId: "choice-question", topicIds: ["updated-topic"] },
          { questionId: "true-false-question", topicIds: [] },
          { questionId: "short-question", topicIds: [] },
        ],
      });
      const staleAttempt = createAttempt({
        grading: createDynamicGrading({
          answerKeyRevision: 1,
          choiceCorrect: false,
        }),
      });
      const revisedAttempt = createAttempt({
        grading: createDynamicGrading({
          answerKeyRevision: 2,
          choiceCorrect: true,
        }),
      });
      mocks.findExamReportingRecordById.mockResolvedValue(exam);
      mocks.listTerminalExamAttemptRecords.mockResolvedValue([staleAttempt]);
      mocks.ensureTerminalAttemptGrading.mockResolvedValue({
        attempt: revisedAttempt,
        exam,
      });

      const report = await getAdminExamResults(admin, exam.id);

      expect(mocks.ensureTerminalAttemptGrading).toHaveBeenCalledWith(
        staleAttempt,
        exam,
        now,
      );
      expect(
        report.dynamicQuestionStatistics?.sections[0].questions[0],
      ).toMatchObject({
        questionId: "choice-question",
        correctCount: 1,
        incorrectCount: 0,
        correctRatePercent: 100,
      });
      expect(report.topicStatistics[0]).toMatchObject({
        topicId: "updated-topic",
        observationCount: 1,
        averagePerformancePercent: 100,
      });
    });

    it("merges one student's legacy and dynamic Topic analytics through batched lookups", async () => {
      const legacyTopicIds = createEmptyQuestionTopicIds();
      legacyTopicIds.partOne[0] = ["shared-topic", "legacy-topic"];
      const legacyExam = createExam({
        id: "legacy-exam",
        title: "Legacy Exam",
        questionTopicIds: legacyTopicIds,
      });
      const hiddenDynamicExam = createDynamicExam({
        id: "hidden-dynamic-exam",
        title: "Hidden dynamic Exam",
        status: EXAM_STATUS.HIDDEN,
        questionTopics: [
          { questionId: "choice-question", topicIds: [] },
          {
            questionId: "true-false-question",
            topicIds: ["shared-topic", "dynamic-topic"],
          },
          { questionId: "short-question", topicIds: [] },
        ],
      });
      const allAttempts = [
        createAttempt({
          id: "requested-legacy-attempt",
          examId: legacyExam.id,
          grading: createFirstQuestionGrading(true),
        }),
        createAttempt({
          id: "requested-dynamic-attempt",
          examId: hiddenDynamicExam.id,
          grading: createDynamicGrading(),
        }),
        createAttempt({
          id: "other-student-attempt",
          examId: "other-student-exam",
          studentId: "other-student",
          grading: createDynamicGrading({
            trueFalseScoreHundredths: 300,
            trueFalseCorrectStatementCount: 4,
          }),
        }),
      ];
      const examsById = new Map([
        [legacyExam.id, legacyExam],
        [hiddenDynamicExam.id, hiddenDynamicExam],
      ]);
      mocks.listTerminalExamAttemptRecords.mockImplementation(
        ({ studentId }: { studentId?: string }) =>
          Promise.resolve(
            allAttempts.filter((attempt) => attempt.studentId === studentId),
          ),
      );
      mocks.findExamReportingRecordsByIds.mockImplementation(
        (examIds: string[]) =>
          Promise.resolve(
            examIds.flatMap((examId) => {
              const exam = examsById.get(examId);
              return exam ? [exam] : [];
            }),
          ),
      );

      const detail = await getAdminStudentDetail(admin, studentActor.id);

      expect(detail).toMatchObject({
        distinctExamCount: 2,
        statistics: { completedAttemptCount: 2 },
      });
      expect(detail.topicStatistics).toEqual([
        {
          topicId: "shared-topic",
          topicName: "shared-topic",
          observationCount: 2,
          averagePerformancePercent: 75,
        },
        {
          topicId: "dynamic-topic",
          topicName: "dynamic-topic",
          observationCount: 1,
          averagePerformancePercent: 50,
        },
        {
          topicId: "legacy-topic",
          topicName: "legacy-topic",
          observationCount: 1,
          averagePerformancePercent: 100,
        },
      ]);
      expect(detail.exams).toContainEqual(
        expect.objectContaining({
          exam: expect.objectContaining({
            id: hiddenDynamicExam.id,
            status: EXAM_STATUS.HIDDEN,
          }),
          statistics: expect.objectContaining({ completedAttemptCount: 1 }),
        }),
      );
      expect(mocks.listTerminalExamAttemptRecords).toHaveBeenCalledWith({
        studentId: studentActor.id,
      });
      expect(mocks.listActiveExamAttemptRecords).toHaveBeenCalledWith({
        studentId: studentActor.id,
      });
      expect(mocks.findExamReportingRecordById).not.toHaveBeenCalled();
      expect(mocks.findExamReportingRecordsByIds).toHaveBeenCalledTimes(1);
      expect(mocks.findExamReportingRecordsByIds).toHaveBeenCalledWith([
        legacyExam.id,
        hiddenDynamicExam.id,
      ]);
      expect(mocks.findTopicRecordsByIds).toHaveBeenCalledTimes(1);
      expect(mocks.findTopicRecordsByIds).toHaveBeenCalledWith([
        "shared-topic",
        "legacy-topic",
        "dynamic-topic",
      ]);
      expect(mocks.ensureTerminalAttemptGrading).not.toHaveBeenCalled();
    });

    it("reports pending objective analytics without treating ESSAY_IMAGE as incorrect", async () => {
      const exam = createEssayReportingExam();
      const pendingAttempt = createAttempt({
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: createPendingEssayGrading(),
      });
      mocks.findExamReportingRecordById.mockResolvedValue(exam);
      mocks.listTerminalExamAttemptRecords.mockResolvedValue([pendingAttempt]);

      const report = await getAdminExamResults(admin, exam.id);

      expect(report).toMatchObject({
        completedAttemptCount: 1,
        submittedAttemptCount: 1,
        autoSubmittedAttemptCount: 0,
        statistics: { average: null, highest: null, lowest: null },
        students: [
          {
            statistics: {
              completedAttemptCount: 1,
              average: null,
              highest: null,
              lowest: null,
              first: null,
              latest: null,
              best: null,
              improvement: null,
            },
          },
        ],
      });
      expect(
        report.dynamicQuestionStatistics?.sections[0].questions.map(
          (question) => ({
            questionId: question.questionId,
            questionNumber: question.questionNumber,
            completedAttemptCount: question.completedAttemptCount,
          }),
        ),
      ).toEqual([
        {
          questionId: "essay-question",
          questionNumber: 1,
          completedAttemptCount: undefined,
        },
        {
          questionId: "essay-choice",
          questionNumber: 2,
          completedAttemptCount: 1,
        },
        {
          questionId: "essay-true-false",
          questionNumber: 3,
          completedAttemptCount: 1,
        },
        {
          questionId: "essay-short",
          questionNumber: 4,
          completedAttemptCount: 1,
        },
      ]);
      expect(
        report.dynamicQuestionStatistics?.sections[0].questions[0],
      ).toEqual({
        sectionId: "essay-section",
        sectionTitle: "Essay section",
        questionId: "essay-question",
        questionNumber: 1,
        questionType: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        gradedAttemptCount: 0,
        averageScoreHundredths: null,
        averagePerformancePercent: null,
      });
      expect(report.topicStatistics).toEqual([
        {
          topicId: "objective-topic",
          topicName: "objective-topic",
          taggedQuestionCount: 2,
          observationCount: 2,
          averagePerformancePercent: 25,
        },
        {
          topicId: "shared-topic",
          topicName: "shared-topic",
          taggedQuestionCount: 2,
          observationCount: 1,
          averagePerformancePercent: 100,
        },
        {
          topicId: "essay-only-topic",
          topicName: "essay-only-topic",
          taggedQuestionCount: 1,
          observationCount: 0,
          averagePerformancePercent: null,
        },
      ]);
    });

    it("updates finalized essay reporting while excluding pending draft scores", async () => {
      const exam = createEssayReportingExam();
      const pendingAttempt = createAttempt({
        id: "pending-essay-attempt",
        attemptNumber: 3,
        submittedAt: new Date("2026-08-11T02:30:00.000Z"),
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: {
          ...createPendingEssayGrading(),
          manualEssayScores: [
            { questionId: "essay-question", scoreHundredths: 350 },
          ],
        },
      });
      const firstCompletedAttempt = createAttempt({
        id: "first-completed-essay-attempt",
        attemptNumber: 1,
        submittedAt: new Date("2026-08-11T01:30:00.000Z"),
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
        grading: createCompletedEssayGrading(100),
      });
      const correctedAttempt = createAttempt({
        id: "corrected-essay-attempt",
        attemptNumber: 2,
        submittedAt: new Date("2026-08-11T02:00:00.000Z"),
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
        grading: createCompletedEssayGrading(200),
        manualGradingRevision: 1,
      });
      const attempts = [
        pendingAttempt,
        firstCompletedAttempt,
        correctedAttempt,
      ];
      mocks.findExamReportingRecordById.mockResolvedValue(exam);
      mocks.listTerminalExamAttemptRecords.mockResolvedValue(attempts);
      mocks.findExamReportingRecordsByIds.mockResolvedValue([exam]);

      const reportBeforeCorrection = await getAdminExamResults(admin, exam.id);
      const studentBeforeCorrection = await getAdminStudentDetail(
        admin,
        studentActor.id,
      );

      expect(reportBeforeCorrection.statistics).toEqual({
        average: 3.5,
        highest: 4,
        lowest: 3,
      });
      expect(reportBeforeCorrection.students[0].statistics).toMatchObject({
        completedAttemptCount: 3,
        average: 3.5,
        first: 3,
        latest: 4,
        best: 4,
        improvement: 1,
      });
      expect(
        reportBeforeCorrection.dynamicQuestionStatistics?.sections[0].questions.find(
          (question) => question.questionId === "essay-question",
        ),
      ).toMatchObject({
        gradedAttemptCount: 2,
        averageScoreHundredths: 150,
        averagePerformancePercent: 37.5,
      });
      expect(
        reportBeforeCorrection.topicStatistics.find(
          (topic) => topic.topicId === "essay-only-topic",
        ),
      ).toMatchObject({
        observationCount: 2,
        averagePerformancePercent: 37.5,
      });
      expect(studentBeforeCorrection.statistics).toEqual({
        completedAttemptCount: 3,
        average: 3.5,
        best: 4,
        latest: 4,
      });
      expect(
        studentBeforeCorrection.topicStatistics.find(
          (topic) => topic.topicId === "essay-only-topic",
        ),
      ).toMatchObject({
        observationCount: 2,
        averagePerformancePercent: 37.5,
      });

      correctedAttempt.grading = createCompletedEssayGrading(400);
      correctedAttempt.manualGradingRevision = 2;

      const reportAfterCorrection = await getAdminExamResults(admin, exam.id);
      const studentAfterCorrection = await getAdminStudentDetail(
        admin,
        studentActor.id,
      );

      expect(reportAfterCorrection.statistics).toEqual({
        average: 4.5,
        highest: 6,
        lowest: 3,
      });
      expect(reportAfterCorrection.students[0].statistics).toMatchObject({
        average: 4.5,
        first: 3,
        latest: 6,
        best: 6,
        improvement: 3,
      });
      expect(
        reportAfterCorrection.dynamicQuestionStatistics?.sections[0].questions.find(
          (question) => question.questionId === "essay-question",
        ),
      ).toMatchObject({
        gradedAttemptCount: 2,
        averageScoreHundredths: 250,
        averagePerformancePercent: 62.5,
      });
      expect(
        reportAfterCorrection.topicStatistics.find(
          (topic) => topic.topicId === "essay-only-topic",
        ),
      ).toMatchObject({
        observationCount: 2,
        averagePerformancePercent: 62.5,
      });
      expect(studentAfterCorrection.statistics).toEqual({
        completedAttemptCount: 3,
        average: 4.5,
        best: 6,
        latest: 6,
      });
      expect(
        studentAfterCorrection.topicStatistics.find(
          (topic) => topic.topicId === "essay-only-topic",
        ),
      ).toMatchObject({
        observationCount: 2,
        averagePerformancePercent: 62.5,
      });
    });

    it("merges pending objective and legacy Student Topics without adding an essay observation", async () => {
      const legacyTopicIds = createEmptyQuestionTopicIds();
      legacyTopicIds.partOne[0] = ["shared-topic"];
      const legacyExam = createExam({
        id: "legacy-exam",
        title: "Legacy Exam",
        questionTopicIds: legacyTopicIds,
      });
      const essayExam = createEssayReportingExam({
        id: "essay-exam",
        title: "Essay Exam",
      });
      const completedAttempt = createAttempt({
        id: "legacy-attempt",
        examId: legacyExam.id,
        grading: createFirstQuestionGrading(true),
      });
      const pendingAttempt = createAttempt({
        id: "essay-attempt",
        examId: essayExam.id,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: createPendingEssayGrading(),
        submittedAt: new Date("2026-08-11T02:30:00.000Z"),
      });
      mocks.listTerminalExamAttemptRecords.mockResolvedValue([
        completedAttempt,
        pendingAttempt,
      ]);
      mocks.findExamReportingRecordsByIds.mockResolvedValue([
        legacyExam,
        essayExam,
      ]);

      const detail = await getAdminStudentDetail(admin, studentActor.id);

      expect(detail.statistics).toEqual({
        completedAttemptCount: 2,
        average: 0.25,
        best: 0.25,
        latest: 0.25,
      });
      expect(
        detail.exams.find((item) => item.exam?.id === essayExam.id)?.statistics,
      ).toEqual({
        completedAttemptCount: 1,
        average: null,
        highest: null,
        lowest: null,
        first: null,
        latest: null,
        best: null,
        improvement: null,
      });
      expect(detail.topicStatistics).toEqual([
        {
          topicId: "objective-topic",
          topicName: "objective-topic",
          observationCount: 2,
          averagePerformancePercent: 25,
        },
        {
          topicId: "shared-topic",
          topicName: "shared-topic",
          observationCount: 2,
          averagePerformancePercent: 100,
        },
      ]);
      expect(JSON.stringify(detail.topicStatistics)).not.toContain(
        "essay-only-topic",
      );
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
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
      score: { total: 7.5 },
    });
    expect(JSON.stringify(result)).not.toContain("answerKey");
    expect(JSON.stringify(result)).not.toContain('"answers"');
    expect(JSON.stringify(result)).not.toContain("scoreHundredths");
  });

  it("returns pending ADMIN result rows with an objective score and no final score", async () => {
    const exam = createEssayReportingExam();
    const attempt = createAttempt({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      grading: createPendingEssayGrading(),
    });
    mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
      attempts: [attempt],
      totalItems: 1,
    });
    mocks.findExamReportingRecordsByIds.mockResolvedValue([exam]);

    const result = await listAdminResults(admin, { page: 1, pageSize: 20 });

    expect(result.results[0]).toMatchObject({
      id: attempt.id,
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      objectiveScore: { earned: 2, maximum: 6 },
    });
    expect(result.results[0]).not.toHaveProperty("score");
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
    expect(result.results[0].score?.total).toBe(7.5);
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

  it("gives ADMIN pending objective grading and submitted essay images without a final score", async () => {
    const attempt = createAttempt({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      grading: createPendingEssayGrading(),
    });
    const exam = createEssayReportingExam({
      settings: {
        showScoreAfterSubmission: false,
        showAnswersAfterSubmission: false,
      },
    });
    const essayImage = {
      publicId: "essay-image",
      secureUrl:
        "https://res.cloudinary.com/test/image/upload/v1/essay-image.jpg",
      originalFilename: "essay-answer.jpg",
      bytes: 1024,
      format: "jpg",
      width: 1200,
      height: 800,
    };
    mocks.findExamAttemptRecordById.mockResolvedValue(attempt);
    mocks.findExamReportingRecordById.mockResolvedValue(exam);
    mocks.buildExamAttemptResult.mockReturnValue({
      exam: {
        id: exam.id,
        title: exam.title,
        structureSnapshot: essayReportingStructure,
      },
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
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      objectiveScore: { earned: 2, maximum: 6 },
      dynamicAnswerReview: {
        questionsById: {
          "essay-question": {
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            studentAnswer: {
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              images: [essayImage],
            },
          },
        },
      },
    });

    const detail = await getAdminAttemptDetail(admin, attempt.id);

    expect(mocks.buildExamAttemptResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: attempt.id }),
      exam,
      { score: true, answers: true },
    );
    expect(detail).toMatchObject({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      objectiveScore: { earned: 2, maximum: 6 },
      dynamicAnswerReview: {
        questionsById: {
          "essay-question": {
            studentAnswer: { images: [essayImage] },
          },
        },
      },
    });
    expect(detail.score).toBeUndefined();
    expect(JSON.stringify(detail)).not.toContain('"score":');
  });

  it("reads draft essay scores back in canonical order with ungraded scores null", async () => {
    const structure = structuredClone(essayReportingStructure);
    structure.sections[0].questions[0].maxScoreHundredths = 200;
    structure.sections[0].questions.splice(1, 0, {
      id: "essay-question-two",
      type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
      maxScoreHundredths: 200,
    });
    const exam = createEssayReportingExam({
      structureSnapshot: structure,
      questionTopics: [
        ...(createEssayReportingExam().questionTopics ?? []),
        { questionId: "essay-question-two", topicIds: [] },
      ],
    });
    const attempt = createAttempt({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      grading: {
        ...createPendingEssayGrading(),
        manualEssayScores: [
          { questionId: "essay-question-two", scoreHundredths: null },
          { questionId: "essay-question", scoreHundredths: 125 },
        ],
      },
      manualGradingRevision: 4,
    });
    mocks.findExamAttemptRecordById.mockResolvedValue(attempt);
    mocks.findExamReportingRecordById.mockResolvedValue(exam);
    mocks.buildExamAttemptResult.mockReturnValue({
      exam: {
        id: exam.id,
        title: exam.title,
        structureSnapshot: structure,
      },
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
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      objectiveScore: { earned: 2, maximum: 6 },
      dynamicAnswerReview: { questionsById: {} },
    });

    const detail = await getAdminAttemptDetail(admin, attempt.id);

    expect(detail.manualGrading).toEqual({
      revision: 4,
      manualEssayScores: [
        { questionId: "essay-question", scoreHundredths: 125 },
        { questionId: "essay-question-two", scoreHundredths: null },
      ],
      essayMaxScoreHundredths: 400,
    });
    expect(detail.score).toBeUndefined();
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

  it.each([true, false])(
    "uses showScoreAfterSubmission=%s for a pending objective history score",
    async (showScoreAfterSubmission) => {
      const exam = createEssayReportingExam({
        settings: {
          showScoreAfterSubmission,
          showAnswersAfterSubmission: false,
        },
      });
      const attempt = createAttempt({
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        grading: createPendingEssayGrading(),
      });
      mocks.findExamReportingRecordById.mockResolvedValue(exam);
      mocks.findLatestExamAttemptRecord.mockResolvedValue(attempt);
      mocks.listTerminalExamAttemptRecordPage.mockResolvedValue({
        attempts: [attempt],
        totalItems: 1,
      });

      const history = await getStudentExamAttemptHistory(
        studentActor,
        exam.id,
        { page: 1, pageSize: 20 },
      );

      expect(history.attempts[0].gradingStatus).toBe(
        EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      );
      expect(history.attempts[0]).not.toHaveProperty("score");
      if (showScoreAfterSubmission) {
        expect(history.attempts[0].objectiveScore).toEqual({
          earned: 2,
          maximum: 6,
        });
      } else {
        expect(history.attempts[0]).not.toHaveProperty("objectiveScore");
      }
    },
  );

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
