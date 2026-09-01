import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoSubmitExpiredExamAttemptRecord: vi.fn(),
  createExamAttemptRecord: vi.fn(),
  findActiveExamAttemptRecord: vi.fn(),
  findExamAttemptRecordById: vi.fn(),
  findLatestExamAttemptRecord: vi.fn(),
  findOwnedExamAttemptRecord: vi.fn(),
  listAllExamAttemptRecordsForStudent: vi.fn(),
  saveOwnedActiveExamAttemptAnswers: vi.fn(),
  setOwnedTerminalExamAttemptGradingForRevision: vi.fn(),
  submitOwnedActiveExamAttempt: vi.fn(),
  findExamGradingRecordById: vi.fn(),
  findStudentExamRecordById: vi.fn(),
  isPublishedExamAvailableToStudent: vi.fn(),
  listPublishedStudentExamRecords: vi.fn(),
  listStudentExamRecordsByIds: vi.fn(),
  markExamAttemptsStarted: vi.fn(),
  markStudentAttemptsStarted: vi.fn(),
  reserveExamForAttemptCreation: vi.fn(),
  reserveExamForAttemptGrading: vi.fn(),
  reserveStudentForAttemptCreation: vi.fn(),
  transactionSession: { id: "transaction-session" },
  withMongoTransaction: vi.fn(),
}));

vi.mock("@/lib/db/dao/exam-attempt.dao", () => ({
  autoSubmitExpiredExamAttemptRecord: mocks.autoSubmitExpiredExamAttemptRecord,
  createExamAttemptRecord: mocks.createExamAttemptRecord,
  findActiveExamAttemptRecord: mocks.findActiveExamAttemptRecord,
  findExamAttemptRecordById: mocks.findExamAttemptRecordById,
  findLatestExamAttemptRecord: mocks.findLatestExamAttemptRecord,
  findOwnedExamAttemptRecord: mocks.findOwnedExamAttemptRecord,
  listAllExamAttemptRecordsForStudent:
    mocks.listAllExamAttemptRecordsForStudent,
  saveOwnedActiveExamAttemptAnswers: mocks.saveOwnedActiveExamAttemptAnswers,
  setOwnedTerminalExamAttemptGradingForRevision:
    mocks.setOwnedTerminalExamAttemptGradingForRevision,
  submitOwnedActiveExamAttempt: mocks.submitOwnedActiveExamAttempt,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  findExamGradingRecordById: mocks.findExamGradingRecordById,
  findStudentExamRecordById: mocks.findStudentExamRecordById,
  isPublishedExamAvailableToStudent: mocks.isPublishedExamAvailableToStudent,
  listPublishedStudentExamRecords: mocks.listPublishedStudentExamRecords,
  listStudentExamRecordsByIds: mocks.listStudentExamRecordsByIds,
  markExamAttemptsStarted: mocks.markExamAttemptsStarted,
  reserveExamForAttemptCreation: mocks.reserveExamForAttemptCreation,
  reserveExamForAttemptGrading: mocks.reserveExamForAttemptGrading,
}));

vi.mock("@/lib/db/dao/user.dao", () => ({
  markStudentAttemptsStarted: mocks.markStudentAttemptsStarted,
  reserveStudentForAttemptCreation: mocks.reserveStudentForAttemptCreation,
}));

vi.mock("@/lib/db/mongoose", () => ({
  withMongoTransaction: mocks.withMongoTransaction,
}));

import {
  EXAM_ATTEMPT_STATUS,
  STUDENT_EXAM_STATE,
} from "@/lib/constants/exam-attempt";
import {
  EXAM_STATUS,
  EXAM_STRUCTURE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import type {
  CreateExamAttemptRecordInput,
  ExamAttemptPersistenceRecord,
} from "@/lib/db/dao/exam-attempt.dao";
import type {
  ExamGradingPersistenceRecord,
  StudentExamWorkspacePersistenceRecord,
} from "@/lib/db/dao/exam.dao";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { gradeAttemptAnswers } from "@/lib/exam/grading";
import {
  finalizeExpiredExamAttempt,
  getOwnedExamAttemptContext,
  getStudentExamAttemptResult,
  listStudentExams,
  saveExamAttemptAnswers,
  startOrResumeExamAttempt,
  submitExamAttempt,
} from "@/lib/services/exam-attempt.service";
import type { AppUser } from "@/types/user";
import type { ExamAnswerKey } from "@/types/exam";

const serverNow = new Date("2026-08-11T03:00:00.000Z");
const student: AppUser = {
  id: "student-id",
  username: "student",
  fullName: "Hoc Sinh",
  role: USER_ROLE.STUDENT,
};

function createStudentExam(
  overrides: Partial<StudentExamWorkspacePersistenceRecord> = {},
): StudentExamWorkspacePersistenceRecord {
  return {
    id: "exam-id",
    title: "Đề thi thử Toán số 1",
    description: "Đề luyện tập",
    status: EXAM_STATUS.PUBLISHED,
    part3InputMode: PART3_INPUT_MODE.BUBBLE,
    allowRetake: true,
    pdf: {
      secureUrl: "https://res.cloudinary.com/demo/raw/upload/exam.pdf",
      originalFilename: "de-thi.pdf",
    },
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    ...overrides,
    attemptsStarted: overrides.attemptsStarted ?? false,
  };
}

function createAnswerKey(): ExamAnswerKey {
  return {
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
    partThree: ["1", "2", "3", "4", "5", "6"],
  };
}

function createGradingExam(
  overrides: Partial<ExamGradingPersistenceRecord> = {},
): ExamGradingPersistenceRecord {
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
    ...overrides,
  };
}

function createAttempt(
  overrides: Partial<ExamAttemptPersistenceRecord> = {},
): ExamAttemptPersistenceRecord {
  return {
    id: "attempt-id",
    examId: "exam-id",
    studentId: student.id,
    attemptNumber: 1,
    status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    startedAt: new Date("2026-08-11T02:55:00.000Z"),
    expiresAt: new Date("2026-08-11T04:25:00.000Z"),
    answers: createEmptyAttemptAnswers(),
    answerRevision: 0,
    createdAt: new Date("2026-08-11T02:55:00.000Z"),
    updatedAt: new Date("2026-08-11T02:55:00.000Z"),
    ...overrides,
  };
}

function mockAttemptCreation(): void {
  mocks.createExamAttemptRecord.mockImplementation(
    (input: CreateExamAttemptRecordInput) =>
      Promise.resolve(
        createAttempt({
          id: `attempt-${input.attemptNumber}`,
          examId: input.examId,
          studentId: input.studentId,
          attemptNumber: input.attemptNumber,
          status: input.status,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          createdAt: input.startedAt,
          updatedAt: input.startedAt,
        }),
      ),
  );
}

describe("ExamAttempt service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(serverNow);

    for (const mock of Object.values(mocks)) {
      if (vi.isMockFunction(mock)) {
        mock.mockReset();
      }
    }

    mocks.findStudentExamRecordById.mockResolvedValue(createStudentExam());
    mocks.findExamGradingRecordById.mockResolvedValue(createGradingExam());
    mocks.findActiveExamAttemptRecord.mockResolvedValue(null);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(null);
    mocks.findExamAttemptRecordById.mockResolvedValue(null);
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(true);
    mocks.markExamAttemptsStarted.mockResolvedValue(true);
    mocks.markStudentAttemptsStarted.mockResolvedValue(true);
    mocks.reserveExamForAttemptCreation.mockResolvedValue(true);
    mocks.reserveExamForAttemptGrading.mockResolvedValue(createGradingExam());
    mocks.reserveStudentForAttemptCreation.mockResolvedValue(true);
    mocks.withMongoTransaction.mockImplementation(
      (operation: (session: unknown) => Promise<unknown>) =>
        operation(mocks.transactionSession),
    );
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(null);
    mocks.setOwnedTerminalExamAttemptGradingForRevision.mockResolvedValue(null);
    mocks.listPublishedStudentExamRecords.mockResolvedValue([]);
    mocks.listStudentExamRecordsByIds.mockResolvedValue([]);
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([]);
    mockAttemptCreation();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts an eligible published Exam with authoritative timestamps", async () => {
    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(mocks.isPublishedExamAvailableToStudent).toHaveBeenCalledWith(
      "exam-id",
      student.id,
    );
    expect(mocks.markExamAttemptsStarted).toHaveBeenCalledWith(
      "exam-id",
      student.id,
      new Date("2026-08-10T00:00:00.000Z"),
    );
    expect(
      mocks.markExamAttemptsStarted.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.createExamAttemptRecord.mock.invocationCallOrder[0]);
    expect(mocks.markStudentAttemptsStarted).toHaveBeenCalledWith(student.id);
    expect(
      mocks.markStudentAttemptsStarted.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.createExamAttemptRecord.mock.invocationCallOrder[0]);
    expect(mocks.createExamAttemptRecord).toHaveBeenCalledWith(
      {
        examId: "exam-id",
        studentId: student.id,
        attemptNumber: 1,
        status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
        startedAt: serverNow,
        expiresAt: new Date(
          serverNow.getTime() + EXAM_STRUCTURE.durationMinutes * 60 * 1000,
        ),
      },
      mocks.transactionSession,
    );
    expect(mocks.reserveExamForAttemptCreation).toHaveBeenCalledWith(
      "exam-id",
      student.id,
      mocks.transactionSession,
    );
    expect(mocks.reserveStudentForAttemptCreation).toHaveBeenCalledWith(
      student.id,
      mocks.transactionSession,
    );
    expect(result.attempt).toMatchObject({
      id: "attempt-1",
      attemptNumber: 1,
      startedAt: serverNow.toISOString(),
      answers: createEmptyAttemptAnswers(),
    });
    expect(
      new Date(result.attempt.expiresAt).getTime() -
        new Date(result.attempt.startedAt).getTime(),
    ).toBe(90 * 60 * 1000);
    expect(result.serverNow).toBe(serverNow.toISOString());
  });

  it("re-reads the Exam when another request wins the content-lock race", async () => {
    const unlockedExam = createStudentExam();
    const lockedExam = createStudentExam({
      attemptsStarted: true,
      updatedAt: new Date("2026-08-10T00:00:01.000Z"),
    });
    mocks.findStudentExamRecordById
      .mockResolvedValueOnce(unlockedExam)
      .mockResolvedValueOnce(lockedExam);
    mocks.markExamAttemptsStarted.mockResolvedValueOnce(false);

    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(result.attempt.id).toBe("attempt-1");
    expect(mocks.findStudentExamRecordById).toHaveBeenCalledTimes(2);
    expect(mocks.markExamAttemptsStarted).toHaveBeenCalledTimes(1);
  });

  it("does not create an attempt after the student account is deactivated", async () => {
    mocks.markStudentAttemptsStarted.mockResolvedValue(false);

    await expect(
      startOrResumeExamAttempt(student, "exam-id"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("does not create an orphan attempt when the Exam is deleted concurrently", async () => {
    mocks.reserveExamForAttemptCreation.mockResolvedValue(false);

    await expect(
      startOrResumeExamAttempt(student, "exam-id"),
    ).rejects.toMatchObject({ code: "EXAM_NOT_PUBLISHED", statusCode: 409 });
    expect(mocks.reserveStudentForAttemptCreation).not.toHaveBeenCalled();
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("does not create an orphan attempt when the Student is deleted concurrently", async () => {
    mocks.reserveStudentForAttemptCreation.mockResolvedValue(false);

    await expect(
      startOrResumeExamAttempt(student, "exam-id"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("returns the same valid active attempt for repeated starts", async () => {
    const activeAttempt = createAttempt();
    mocks.findActiveExamAttemptRecord.mockResolvedValue(activeAttempt);

    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(result.attempt.id).toBe(activeAttempt.id);
    expect(mocks.findLatestExamAttemptRecord).not.toHaveBeenCalled();
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("resumes an owned active attempt after the student is unassigned", async () => {
    const activeAttempt = createAttempt();
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(false);
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);

    const result = await startOrResumeExamAttempt(
      student,
      "exam-id",
      activeAttempt.id,
    );

    expect(result.attempt.id).toBe(activeAttempt.id);
    expect(mocks.findOwnedExamAttemptRecord).toHaveBeenCalledWith(
      activeAttempt.id,
      activeAttempt.examId,
      student.id,
    );
    expect(mocks.findActiveExamAttemptRecord).not.toHaveBeenCalled();
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
    expect(mocks.isPublishedExamAvailableToStudent).not.toHaveBeenCalled();
  });

  it("does not turn a stale resume confirmation into a retake", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const expiredAttempt = createAttempt({ expiresAt });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    const result = await startOrResumeExamAttempt(
      student,
      "exam-id",
      expiredAttempt.id,
    );

    expect(result.attempt).toMatchObject({
      id: expiredAttempt.id,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    });
    expect(mocks.findLatestExamAttemptRecord).not.toHaveBeenCalled();
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("recovers a duplicate-key start race to the concurrent active attempt", async () => {
    const concurrentAttempt = createAttempt({ id: "winning-attempt" });
    mocks.findActiveExamAttemptRecord
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentAttempt);
    mocks.createExamAttemptRecord.mockRejectedValueOnce({ code: 11000 });

    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(result.attempt.id).toBe(concurrentAttempt.id);
    expect(mocks.createExamAttemptRecord).toHaveBeenCalledTimes(1);
  });

  it("creates the next attempt when retakes are allowed", async () => {
    const oldAnswers = createEmptyAttemptAnswers();
    const oldGrading = gradeAttemptAnswers(oldAnswers, createAnswerKey());
    const oldAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: new Date("2026-08-11T02:30:00.000Z"),
      answers: oldAnswers,
      grading: oldGrading,
      gradedAt: new Date("2026-08-11T02:30:00.000Z"),
    });
    mocks.findLatestExamAttemptRecord.mockResolvedValue(oldAttempt);

    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(result.attempt.attemptNumber).toBe(2);
    expect(mocks.createExamAttemptRecord).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 2 }),
      mocks.transactionSession,
    );
    expect(oldAttempt.grading).toEqual(oldGrading);
  });

  it("rejects a retake when the Exam does not allow it", async () => {
    mocks.findStudentExamRecordById.mockResolvedValue(
      createStudentExam({ allowRetake: false }),
    );
    mocks.findLatestExamAttemptRecord.mockResolvedValue(
      createAttempt({ status: EXAM_ATTEMPT_STATUS.SUBMITTED }),
    );

    await expect(
      startOrResumeExamAttempt(student, "exam-id"),
    ).rejects.toMatchObject({
      code: "EXAM_RETAKE_NOT_ALLOWED",
      statusCode: 409,
    });
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["new attempt", null],
    [
      "retake",
      createAttempt({
        status: EXAM_ATTEMPT_STATUS.SUBMITTED,
        submittedAt: serverNow,
      }),
    ],
  ])("rejects an unassigned student's %s", async (_label, latestAttempt) => {
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(false);
    mocks.findLatestExamAttemptRecord.mockResolvedValue(latestAttempt);

    await expect(
      startOrResumeExamAttempt(student, "exam-id"),
    ).rejects.toMatchObject({ code: "EXAM_NOT_PUBLISHED", statusCode: 409 });
    expect(mocks.findActiveExamAttemptRecord).not.toHaveBeenCalled();
    expect(mocks.reserveExamForAttemptCreation).not.toHaveBeenCalled();
    expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
  });

  it.each([EXAM_STATUS.DRAFT, EXAM_STATUS.HIDDEN])(
    "rejects a new attempt for an Exam with status %s",
    async (status) => {
      mocks.findStudentExamRecordById.mockResolvedValue(
        createStudentExam({ status }),
      );

      await expect(
        startOrResumeExamAttempt(student, "exam-id"),
      ).rejects.toMatchObject({
        code: "EXAM_NOT_PUBLISHED",
        statusCode: 409,
      });
      expect(mocks.findActiveExamAttemptRecord).not.toHaveBeenCalled();
      expect(mocks.createExamAttemptRecord).not.toHaveBeenCalled();
    },
  );

  it("auto-submits an expired owned attempt at its expiration time", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const expiredAttempt = createAttempt({ expiresAt });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      expiredAttempt.id,
    );

    expect(mocks.autoSubmitExpiredExamAttemptRecord).toHaveBeenCalledWith(
      expiredAttempt.id,
      student.id,
      expiredAttempt.examId,
      expiredAttempt.answerRevision,
      gradeAttemptAnswers(
        expiredAttempt.answers ?? createEmptyAttemptAnswers(),
        createAnswerKey(),
      ),
      serverNow,
      mocks.transactionSession,
    );
    expect(result.attempt).toMatchObject({
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt.toISOString(),
    });
    expect(result.canEditAnswers).toBe(false);
  });

  it("does not treat an expired active attempt as resumable", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const expiredAttempt = createAttempt({ expiresAt });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
    });
    mocks.findActiveExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );
    mocks.findLatestExamAttemptRecord.mockResolvedValue(autoSubmittedAttempt);

    const result = await startOrResumeExamAttempt(student, "exam-id");

    expect(result.attempt.id).toBe("attempt-2");
    expect(result.attempt.attemptNumber).toBe(2);
  });

  it("enforces ownership and matching Exam in attempt lookup", async () => {
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(null);

    await expect(
      getOwnedExamAttemptContext(student, "exam-id", "another-attempt-id"),
    ).rejects.toMatchObject({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      statusCode: 404,
    });
    expect(mocks.findOwnedExamAttemptRecord).toHaveBeenCalledWith(
      "another-attempt-id",
      "exam-id",
      student.id,
    );
    expect(mocks.findStudentExamRecordById).not.toHaveBeenCalled();
  });

  it("returns a safe editable PDF workspace for an owned active attempt", async () => {
    const activeAttempt = createAttempt();
    mocks.findStudentExamRecordById.mockResolvedValue(
      createStudentExam({ part3InputMode: PART3_INPUT_MODE.TEXT }),
    );
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      activeAttempt.id,
    );

    expect(result).toMatchObject({
      exam: {
        id: "exam-id",
        title: "Đề thi thử Toán số 1",
        description: "Đề luyện tập",
        durationMinutes: 90,
        part3InputMode: PART3_INPUT_MODE.TEXT,
        pdf: {
          url: "https://res.cloudinary.com/demo/raw/upload/exam.pdf",
          filename: "de-thi.pdf",
        },
      },
      attempt: {
        id: activeAttempt.id,
        status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      },
      canEditAnswers: true,
      serverNow: serverNow.toISOString(),
    });
    expect(result.exam.pdf).not.toHaveProperty("publicId");
    expect(result.exam).not.toHaveProperty("answerKey");
    expect(result.exam).not.toHaveProperty("createdBy");
    expect(result.exam).not.toHaveProperty("settings");
    expect(JSON.stringify(result)).not.toContain("answerKey");
  });

  it("rechecks expiration after loading the workspace", async () => {
    const expiresAt = new Date(serverNow.getTime() + 1000);
    const responseNow = new Date(serverNow.getTime() + 2000);
    const activeAttempt = createAttempt({ expiresAt });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);
    mocks.findStudentExamRecordById.mockImplementation(async () => {
      vi.setSystemTime(responseNow);
      return createStudentExam();
    });
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      activeAttempt.id,
    );

    expect(result.attempt.status).toBe(EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED);
    expect(result.serverNow).toBe(responseNow.toISOString());
    expect(result.canEditAnswers).toBe(false);
  });

  it("exposes a legacy attempt without answers as the fixed empty state", async () => {
    const legacyAttempt = createAttempt({ answers: undefined });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(legacyAttempt);

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      legacyAttempt.id,
    );

    expect(result.attempt.answers).toEqual(createEmptyAttemptAnswers());
  });

  it("returns persisted answers when resuming an owned attempt", async () => {
    const savedAnswers = createEmptyAttemptAnswers();
    savedAnswers.partOne[0] = "C";
    savedAnswers.partTwo[0].a = true;
    savedAnswers.partThree[0] = ["1", "2", ",", "5"];
    const activeAttempt = createAttempt({
      answers: savedAnswers,
      lastSavedAt: new Date("2026-08-11T02:58:00.000Z"),
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      activeAttempt.id,
    );

    expect(result.attempt.answers).toEqual(savedAnswers);
    expect(result.attempt.lastSavedAt).toBe("2026-08-11T02:58:00.000Z");
    expect(result.serverNow).toBe(serverNow.toISOString());
  });

  it("saves partial answers for the owned active attempt using server time", async () => {
    const partialAnswers = createEmptyAttemptAnswers();
    partialAnswers.partOne[0] = "B";
    partialAnswers.partTwo[0].a = false;
    const activeAttempt = createAttempt();
    const savedAttempt = createAttempt({
      answers: partialAnswers,
      lastSavedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);
    mocks.saveOwnedActiveExamAttemptAnswers.mockResolvedValue(savedAttempt);

    const result = await saveExamAttemptAnswers(
      student,
      "exam-id",
      activeAttempt.id,
      partialAnswers,
    );

    expect(mocks.saveOwnedActiveExamAttemptAnswers).toHaveBeenCalledWith({
      attemptId: activeAttempt.id,
      examId: "exam-id",
      studentId: student.id,
      answers: partialAnswers,
      now: serverNow,
    });
    expect(result.attempt.answers).toEqual(partialAnswers);
    expect(result.attempt.lastSavedAt).toBe(serverNow.toISOString());
  });

  it("does not allow a student to save another student's attempt", async () => {
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(null);

    await expect(
      saveExamAttemptAnswers(
        student,
        "exam-id",
        "other-attempt",
        createEmptyAttemptAnswers(),
      ),
    ).rejects.toMatchObject({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      statusCode: 404,
    });
    expect(mocks.saveOwnedActiveExamAttemptAnswers).not.toHaveBeenCalled();
  });

  it("rejects autosave for a terminal attempt and cannot overwrite it", async () => {
    const terminalAnswers = createEmptyAttemptAnswers();
    terminalAnswers.partOne[0] = "A";
    const submittedAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers: terminalAnswers,
    });
    const laterAnswers = createEmptyAttemptAnswers();
    laterAnswers.partOne[0] = "D";
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(submittedAttempt);

    await expect(
      saveExamAttemptAnswers(
        student,
        "exam-id",
        submittedAttempt.id,
        laterAnswers,
      ),
    ).rejects.toMatchObject({
      code: "EXAM_ATTEMPT_LOCKED",
      statusCode: 409,
    });
    expect(mocks.saveOwnedActiveExamAttemptAnswers).not.toHaveBeenCalled();
  });

  it("auto-submits an expired attempt before rejecting its autosave", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const expiredAttempt = createAttempt({ expiresAt });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    await expect(
      saveExamAttemptAnswers(
        student,
        "exam-id",
        expiredAttempt.id,
        createEmptyAttemptAnswers(),
      ),
    ).rejects.toMatchObject({ code: "EXAM_ATTEMPT_LOCKED" });
    expect(mocks.autoSubmitExpiredExamAttemptRecord).toHaveBeenCalledWith(
      expiredAttempt.id,
      student.id,
      expiredAttempt.examId,
      expiredAttempt.answerRevision,
      gradeAttemptAnswers(
        expiredAttempt.answers ?? createEmptyAttemptAnswers(),
        createAnswerKey(),
      ),
      serverNow,
      mocks.transactionSession,
    );
    expect(mocks.saveOwnedActiveExamAttemptAnswers).not.toHaveBeenCalled();
  });

  it("atomically submits the full current payload even with unanswered questions", async () => {
    const submittedAnswers = createEmptyAttemptAnswers();
    submittedAnswers.partOne[0] = "D";
    const activeAttempt = createAttempt();
    const grading = gradeAttemptAnswers(submittedAnswers, createAnswerKey());
    const submittedAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      lastSavedAt: serverNow,
      answers: submittedAnswers,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);
    mocks.submitOwnedActiveExamAttempt.mockResolvedValue(submittedAttempt);

    const result = await submitExamAttempt(
      student,
      "exam-id",
      activeAttempt.id,
      submittedAnswers,
    );

    expect(mocks.submitOwnedActiveExamAttempt).toHaveBeenCalledWith(
      {
        attemptId: activeAttempt.id,
        examId: "exam-id",
        studentId: student.id,
        answers: submittedAnswers,
        grading,
        now: serverNow,
      },
      mocks.transactionSession,
    );
    expect(mocks.reserveExamForAttemptGrading).toHaveBeenCalledWith(
      activeAttempt.examId,
      mocks.transactionSession,
    );
    expect(result.attempt).toMatchObject({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow.toISOString(),
      lastSavedAt: serverNow.toISOString(),
      answers: submittedAnswers,
    });
    expect(result.canEditAnswers).toBe(false);
    expect(submittedAttempt.grading).toEqual(grading);
  });

  it("ignores a late manual payload and preserves saved answers on auto-submission", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const persistedAnswers = createEmptyAttemptAnswers();
    persistedAnswers.partOne[0] = "A";
    const lateAnswers = createEmptyAttemptAnswers();
    lateAnswers.partOne[0] = "D";
    const expiredAttempt = createAttempt({
      expiresAt,
      answers: persistedAnswers,
    });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      answers: persistedAnswers,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
      grading: gradeAttemptAnswers(persistedAnswers, createAnswerKey()),
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    const result = await submitExamAttempt(
      student,
      "exam-id",
      expiredAttempt.id,
      lateAnswers,
    );

    expect(mocks.submitOwnedActiveExamAttempt).not.toHaveBeenCalled();
    expect(mocks.autoSubmitExpiredExamAttemptRecord).toHaveBeenCalledWith(
      expiredAttempt.id,
      student.id,
      expiredAttempt.examId,
      expiredAttempt.answerRevision,
      gradeAttemptAnswers(persistedAnswers, createAnswerKey()),
      serverNow,
      mocks.transactionSession,
    );
    expect(result.attempt.status).toBe(EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED);
    expect(result.attempt.submittedAt).toBe(expiresAt.toISOString());
    expect(result.attempt.answers).toEqual(persistedAnswers);
    expect(result.attempt.answers).not.toEqual(lateAnswers);
  });

  it("does not auto-submit before the authoritative expiration time", async () => {
    const activeAttempt = createAttempt();
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(activeAttempt);

    const result = await finalizeExpiredExamAttempt(
      student,
      "exam-id",
      activeAttempt.id,
    );

    expect(result.attempt.status).toBe(EXAM_ATTEMPT_STATUS.IN_PROGRESS);
    expect(result.canEditAnswers).toBe(true);
    expect(result.serverNow).toBe(serverNow.toISOString());
    expect(mocks.autoSubmitExpiredExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("auto-submits after expiry at expiresAt and preserves persisted answers", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const persistedAnswers = createEmptyAttemptAnswers();
    persistedAnswers.partThree[0] = ["1", "2", ",", "5"];
    const expiredAttempt = createAttempt({
      expiresAt,
      answers: persistedAnswers,
    });
    const autoSubmittedAttempt = createAttempt({
      expiresAt,
      answers: persistedAnswers,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
      grading: gradeAttemptAnswers(persistedAnswers, createAnswerKey()),
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord.mockResolvedValue(
      autoSubmittedAttempt,
    );

    const result = await finalizeExpiredExamAttempt(
      student,
      "exam-id",
      expiredAttempt.id,
    );

    expect(result.attempt).toMatchObject({
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt.toISOString(),
      answers: persistedAnswers,
    });
    expect(result.canEditAnswers).toBe(false);
  });

  it("re-reads and re-grades when a same-millisecond autosave increments the answer revision", async () => {
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const oldAnswers = createEmptyAttemptAnswers();
    oldAnswers.partOne[0] = "A";
    const latestAnswers = createEmptyAttemptAnswers();
    latestAnswers.partOne[0] = "B";
    const expiredAttempt = createAttempt({
      expiresAt,
      answers: oldAnswers,
      updatedAt: new Date("2026-08-11T02:58:30.000Z"),
    });
    const refreshedAttempt = createAttempt({
      expiresAt,
      answers: latestAnswers,
      answerRevision: 1,
      lastSavedAt: new Date("2026-08-11T02:58:59.900Z"),
      updatedAt: expiredAttempt.updatedAt,
    });
    const latestGrading = gradeAttemptAnswers(latestAnswers, createAnswerKey());
    const autoSubmittedAttempt = createAttempt({
      ...refreshedAttempt,
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: expiresAt,
      grading: latestGrading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(expiredAttempt);
    mocks.findExamAttemptRecordById.mockResolvedValue(refreshedAttempt);
    mocks.autoSubmitExpiredExamAttemptRecord
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(autoSubmittedAttempt);

    const result = await finalizeExpiredExamAttempt(
      student,
      "exam-id",
      expiredAttempt.id,
    );

    expect(mocks.autoSubmitExpiredExamAttemptRecord).toHaveBeenCalledTimes(2);
    expect(mocks.autoSubmitExpiredExamAttemptRecord).toHaveBeenLastCalledWith(
      refreshedAttempt.id,
      student.id,
      refreshedAttempt.examId,
      refreshedAttempt.answerRevision,
      latestGrading,
      serverNow,
      mocks.transactionSession,
    );
    expect(result.attempt.answers).toEqual(latestAnswers);
  });

  it("returns terminal submissions idempotently without another mutation", async () => {
    const terminalAnswers = createEmptyAttemptAnswers();
    terminalAnswers.partOne[0] = "B";
    const submittedAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers: terminalAnswers,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(submittedAttempt);

    const repeatedSubmit = await submitExamAttempt(
      student,
      "exam-id",
      submittedAttempt.id,
      createEmptyAttemptAnswers(),
    );
    const repeatedFinalize = await finalizeExpiredExamAttempt(
      student,
      "exam-id",
      submittedAttempt.id,
    );

    expect(repeatedSubmit.attempt.answers).toEqual(terminalAnswers);
    expect(repeatedFinalize.attempt.answers).toEqual(terminalAnswers);
    expect(mocks.submitOwnedActiveExamAttempt).not.toHaveBeenCalled();
    expect(mocks.autoSubmitExpiredExamAttemptRecord).not.toHaveBeenCalled();
  });

  it("lazily stores grading for a legacy terminal attempt", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
    });
    const gradedAttempt = createAttempt({
      ...terminalAttempt,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.setOwnedTerminalExamAttemptGradingForRevision.mockResolvedValue(
      gradedAttempt,
    );

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(
      mocks.setOwnedTerminalExamAttemptGradingForRevision,
    ).toHaveBeenCalledWith(
      terminalAttempt.id,
      terminalAttempt.examId,
      terminalAttempt.studentId,
      grading,
      serverNow,
      mocks.transactionSession,
    );
    expect(result.score?.total).toBe(0.25);
  });

  it("regrades a terminal snapshot when the answer-key revision changes", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    const oldGrading = gradeAttemptAnswers(answers, createAnswerKey(), 1);
    const correctedAnswerKey = createAnswerKey();
    correctedAnswerKey.partOne[0] = "B";
    const correctedExam = createGradingExam({
      answerKey: correctedAnswerKey,
      answerKeyRevision: 2,
    });
    const correctedGrading = gradeAttemptAnswers(
      answers,
      correctedAnswerKey,
      2,
    );
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading: oldGrading,
      gradedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const regradedAttempt = createAttempt({
      ...terminalAttempt,
      grading: correctedGrading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.findExamGradingRecordById.mockResolvedValue(correctedExam);
    mocks.reserveExamForAttemptGrading.mockResolvedValue(correctedExam);
    mocks.setOwnedTerminalExamAttemptGradingForRevision.mockResolvedValue(
      regradedAttempt,
    );

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(
      mocks.setOwnedTerminalExamAttemptGradingForRevision,
    ).toHaveBeenCalledWith(
      terminalAttempt.id,
      terminalAttempt.examId,
      terminalAttempt.studentId,
      expect.objectContaining({ answerKeyRevision: 2 }),
      serverNow,
      mocks.transactionSession,
    );
    expect(result.score?.total).toBe(0);
  });

  it("reuses an existing immutable grading snapshot on repeated result access", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);

    const firstResult = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );
    const secondResult = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(firstResult.score).toEqual(secondResult.score);
    expect(
      mocks.setOwnedTerminalExamAttemptGradingForRevision,
    ).not.toHaveBeenCalled();
  });

  it("keeps an owned historical result accessible after unassignment", async () => {
    const answers = createEmptyAttemptAnswers();
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading: gradeAttemptAnswers(answers, createAnswerKey()),
      gradedAt: serverNow,
    });
    mocks.isPublishedExamAvailableToStudent.mockResolvedValue(false);
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(result.attempt.id).toBe(terminalAttempt.id);
    expect(mocks.isPublishedExamAvailableToStudent).not.toHaveBeenCalled();
  });

  it("does not expose another student's result", async () => {
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(null);

    await expect(
      getStudentExamAttemptResult(student, "exam-id", "other-attempt"),
    ).rejects.toMatchObject({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      statusCode: 404,
    });
    expect(mocks.findExamGradingRecordById).not.toHaveBeenCalled();
  });

  it("does not provide a result for an unexpired in-progress attempt", async () => {
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(createAttempt());

    await expect(
      getStudentExamAttemptResult(student, "exam-id", "attempt-id"),
    ).rejects.toMatchObject({
      code: "EXAM_ATTEMPT_RESULT_UNAVAILABLE",
      statusCode: 409,
    });
  });

  it("exposes score without answer-derived details when only score is visible", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.findExamGradingRecordById.mockResolvedValue(
      createGradingExam({
        settings: {
          showScoreAfterSubmission: true,
          showAnswersAfterSubmission: false,
        },
      }),
    );

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(result.score).toMatchObject({ total: 0.25 });
    expect(result).not.toHaveProperty("answerReview");
  });

  it("exposes answer review without leaking numeric scores when only answers are visible", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partTwo[0] = { a: true, b: false, c: null, d: null };
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.findExamGradingRecordById.mockResolvedValue(
      createGradingExam({
        settings: {
          showScoreAfterSubmission: false,
          showAnswersAfterSubmission: true,
        },
      }),
    );

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(result).not.toHaveProperty("score");
    expect(result.answerReview?.partTwo[0]).toMatchObject({
      correctStatementCount: 2,
      correctAnswer: createAnswerKey().partTwo[0],
    });
    expect(result.answerReview?.partTwo[0]).not.toHaveProperty("score");
    expect(JSON.stringify(result)).not.toContain("scoreHundredths");
    expect(JSON.stringify(result)).not.toContain("totalScore");
  });

  it("omits all grading and answer details when neither setting is visible", async () => {
    const answers = createEmptyAttemptAnswers();
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      submittedAt: new Date("2026-08-11T04:25:00.000Z"),
      answers,
      grading,
      gradedAt: serverNow,
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.findExamGradingRecordById.mockResolvedValue(
      createGradingExam({
        settings: {
          showScoreAfterSubmission: false,
          showAnswersAfterSubmission: false,
        },
      }),
    );

    const result = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(Object.keys(result).sort()).toEqual(
      ["attempt", "exam", "visibility"].sort(),
    );
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("answerReview");
    expect(result.exam).toEqual({
      id: "exam-id",
      title: "Đề thi thử Toán số 1",
    });
    expect(JSON.stringify(result)).not.toContain("answerKey");
    expect(JSON.stringify(result)).not.toContain("publicId");
    expect(JSON.stringify(result)).not.toContain("createdBy");
    expect(JSON.stringify(result)).not.toContain("secureUrl");
  });

  it("uses current Exam visibility settings for an old grading snapshot", async () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const terminalAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: serverNow,
      answers,
      grading,
      gradedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(terminalAttempt);
    mocks.findExamGradingRecordById
      .mockResolvedValueOnce(
        createGradingExam({
          settings: {
            showScoreAfterSubmission: false,
            showAnswersAfterSubmission: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createGradingExam({
          settings: {
            showScoreAfterSubmission: true,
            showAnswersAfterSubmission: false,
          },
        }),
      );

    const hiddenResult = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );
    const visibleResult = await getStudentExamAttemptResult(
      student,
      "exam-id",
      terminalAttempt.id,
    );

    expect(hiddenResult).not.toHaveProperty("score");
    expect(visibleResult.score?.total).toBe(0.25);
    expect(terminalAttempt.grading).toEqual(grading);
  });

  it("does not expose an editable workspace for a terminal attempt", async () => {
    const submittedAttempt = createAttempt({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: new Date("2026-08-11T02:59:30.000Z"),
    });
    mocks.findOwnedExamAttemptRecord.mockResolvedValue(submittedAttempt);

    const result = await getOwnedExamAttemptContext(
      student,
      "exam-id",
      submittedAttempt.id,
    );

    expect(result.attempt.status).toBe(EXAM_ATTEMPT_STATUS.SUBMITTED);
    expect(result.canEditAnswers).toBe(false);
  });

  it("returns safe student DTOs ordered in-progress, not-started, completed", async () => {
    const inProgressExam = createStudentExam({
      id: "in-progress-exam",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const notStartedExam = createStudentExam({
      id: "not-started-exam",
      createdAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    const completedExam = createStudentExam({
      id: "completed-exam",
      createdAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    mocks.listPublishedStudentExamRecords.mockResolvedValue([
      completedExam,
      notStartedExam,
      inProgressExam,
    ]);
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([
      createAttempt({
        id: "active-attempt",
        examId: inProgressExam.id,
      }),
      createAttempt({
        id: "older-completed-attempt",
        examId: inProgressExam.id,
        status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      }),
      createAttempt({
        id: "completed-attempt",
        examId: completedExam.id,
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      }),
    ]);

    const result = await listStudentExams(student);

    expect(result.exams.map((exam) => exam.id)).toEqual([
      inProgressExam.id,
      notStartedExam.id,
      completedExam.id,
    ]);
    expect(result.exams.map((exam) => exam.state)).toEqual([
      STUDENT_EXAM_STATE.IN_PROGRESS,
      STUDENT_EXAM_STATE.NOT_STARTED,
      STUDENT_EXAM_STATE.COMPLETED,
    ]);
    expect(result.exams[0]).toMatchObject({
      activeAttemptId: "active-attempt",
      completedAttemptCount: 1,
      durationMinutes: 90,
    });
    expect(result.exams[0]).not.toHaveProperty("answerKey");
    expect(result.exams[0]).not.toHaveProperty("pdf");
    expect(result.exams[0]).not.toHaveProperty("createdBy");
    expect(result.exams[0]).not.toHaveProperty("assignedStudentIds");
    expect(mocks.listPublishedStudentExamRecords).toHaveBeenCalledWith(
      student.id,
    );
    expect(mocks.listAllExamAttemptRecordsForStudent).toHaveBeenCalledTimes(1);
    expect(result.exams[2].latestCompletedAttemptId).toBe("completed-attempt");
  });

  it("retains hidden Exams with attempt history without allowing a retake", async () => {
    const hiddenExam = createStudentExam({
      id: "hidden-exam",
      status: EXAM_STATUS.HIDDEN,
      allowRetake: true,
    });
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([
      createAttempt({
        id: "hidden-result",
        examId: hiddenExam.id,
        status: EXAM_ATTEMPT_STATUS.SUBMITTED,
        submittedAt: serverNow,
      }),
    ]);
    mocks.listStudentExamRecordsByIds.mockResolvedValue([
      { ...hiddenExam, isAssigned: true },
    ]);

    const result = await listStudentExams(student);

    expect(mocks.listStudentExamRecordsByIds).toHaveBeenCalledWith(
      [hiddenExam.id],
      student.id,
    );
    expect(result.exams).toEqual([
      expect.objectContaining({
        id: hiddenExam.id,
        state: STUDENT_EXAM_STATE.COMPLETED,
        isAvailable: false,
        latestCompletedAttemptId: "hidden-result",
      }),
    ]);
  });

  it("hides an unassigned Exam without attempts from the normal list", async () => {
    mocks.listPublishedStudentExamRecords.mockResolvedValue([]);
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([]);

    const result = await listStudentExams(student);

    expect(result.exams).toEqual([]);
    expect(mocks.listStudentExamRecordsByIds).toHaveBeenCalledWith(
      [],
      student.id,
    );
  });

  it("does not leak an unassigned published Exam with only terminal history", async () => {
    const revokedExam = createStudentExam({ id: "revoked-exam" });
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([
      createAttempt({
        id: "revoked-result",
        examId: revokedExam.id,
        status: EXAM_ATTEMPT_STATUS.SUBMITTED,
        submittedAt: serverNow,
      }),
    ]);
    mocks.listStudentExamRecordsByIds.mockResolvedValue([
      { ...revokedExam, isAssigned: false },
    ]);

    const result = await listStudentExams(student);

    expect(result.exams).toEqual([]);
  });

  it("retains an unassigned published Exam only to resume its active attempt", async () => {
    const revokedExam = createStudentExam({ id: "revoked-exam" });
    const activeAttempt = createAttempt({
      id: "revoked-active-attempt",
      examId: revokedExam.id,
    });
    mocks.listAllExamAttemptRecordsForStudent.mockResolvedValue([
      activeAttempt,
    ]);
    mocks.listStudentExamRecordsByIds.mockResolvedValue([
      { ...revokedExam, isAssigned: false },
    ]);

    const result = await listStudentExams(student);

    expect(result.exams).toEqual([
      expect.objectContaining({
        id: revokedExam.id,
        state: STUDENT_EXAM_STATE.IN_PROGRESS,
        isAvailable: false,
        activeAttemptId: activeAttempt.id,
      }),
    ]);
  });
});
