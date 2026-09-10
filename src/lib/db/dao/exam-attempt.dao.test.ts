import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  bulkWrite: vi.fn(),
  deleteMany: vi.fn(),
  findOneAndUpdate: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/db/models/exam-attempt.model", () => ({
  ExamAttemptModel: {
    bulkWrite: mocks.bulkWrite,
    deleteMany: mocks.deleteMany,
    findOneAndUpdate: mocks.findOneAndUpdate,
    init: mocks.init,
  },
}));

import {
  attachEssayImageToOwnedActiveExamAttempt,
  autoSubmitExpiredExamAttemptRecord,
  deleteExamAttemptRecordsByExamId,
  deleteExamAttemptRecordsByStudentId,
  removeEssayImageFromOwnedActiveExamAttempt,
  replaceTerminalExamAttemptGradings,
  saveOwnedActiveExamAttemptAnswers,
  submitOwnedActiveExamAttempt,
} from "@/lib/db/dao/exam-attempt.dao";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { gradeAttemptAnswers } from "@/lib/exam/grading";
import type { ExamAnswerKey } from "@/types/exam";

describe("ExamAttempt cascade DAO", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.bulkWrite.mockReset();
    mocks.deleteMany.mockReset();
    mocks.findOneAndUpdate.mockReset();
    mocks.findOneAndUpdate.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    });
    mocks.init.mockReset();
    mocks.init.mockResolvedValue(undefined);
  });

  it("deletes every attempt status belonging to an Exam", async () => {
    const session = { id: "exam-delete-session" };
    const attempts = [
      { examId: "exam-id", status: "IN_PROGRESS" },
      { examId: "exam-id", status: "SUBMITTED" },
      { examId: "other-exam", status: "AUTO_SUBMITTED" },
    ];
    mocks.deleteMany.mockImplementation(
      async (filter: { examId: string }, options: { session: unknown }) => {
        expect(options.session).toBe(session);
        const deletedCount = attempts.filter(
          (attempt) => attempt.examId === filter.examId,
        ).length;
        return { deletedCount };
      },
    );

    await expect(
      deleteExamAttemptRecordsByExamId("exam-id", session as never),
    ).resolves.toBe(2);
    expect(mocks.deleteMany).toHaveBeenCalledWith(
      { examId: "exam-id" },
      { session },
    );
  });

  it("deletes every attempt status belonging to a Student", async () => {
    const session = { id: "student-delete-session" };
    const attempts = [
      { studentId: "student-id", status: "IN_PROGRESS" },
      { studentId: "student-id", status: "AUTO_SUBMITTED" },
      { studentId: "other-student", status: "SUBMITTED" },
    ];
    mocks.deleteMany.mockImplementation(
      async (filter: { studentId: string }, options: { session: unknown }) => {
        expect(options.session).toBe(session);
        const deletedCount = attempts.filter(
          (attempt) => attempt.studentId === filter.studentId,
        ).length;
        return { deletedCount };
      },
    );

    await expect(
      deleteExamAttemptRecordsByStudentId("student-id", session as never),
    ).resolves.toBe(2);
    expect(mocks.deleteMany).toHaveBeenCalledWith(
      { studentId: "student-id" },
      { session },
    );
  });

  it("guards autosave and final submission with the active status", async () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const answers = createEmptyAttemptAnswers();
    const answerKey: ExamAnswerKey = {
      partOne: Array.from({ length: 12 }, () => "A" as const),
      partTwo: Array.from({ length: 4 }, () => ({
        a: true,
        b: false,
        c: true,
        d: false,
      })),
      partThree: ["1", "2", "3", "4", "5", "6"],
    };
    const mutation = {
      attemptId: "attempt-id",
      examId: "exam-id",
      studentId: "student-id",
      answers,
      now,
    };
    const session = { id: "submission-session" };

    await saveOwnedActiveExamAttemptAnswers(mutation);
    await submitOwnedActiveExamAttempt(
      {
        ...mutation,
        grading: gradeAttemptAnswers(answers, answerKey),
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
      },
      session as never,
    );

    expect(mocks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: now },
    });
    expect(mocks.findOneAndUpdate.mock.calls[1][0]).toMatchObject({
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: now },
    });
    expect(mocks.findOneAndUpdate.mock.calls[1][2]).toMatchObject({ session });
  });

  it("atomically merges objective autosave fields without replacing essay images", async () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const staleImage = {
      publicId: "stale-public-id",
      secureUrl: "https://res.cloudinary.com/test/image/upload/stale.jpg",
      originalFilename: "stale.jpg",
      bytes: 100,
      format: "jpg" as const,
      width: 10,
      height: 10,
    };

    await saveOwnedActiveExamAttemptAnswers({
      attemptId: "attempt-id",
      examId: "exam-id",
      studentId: "student-id",
      answers: {
        answersByQuestionId: {
          choice: "B",
          essay: { type: "ESSAY_IMAGE", images: [staleImage] },
        },
      },
      essayQuestionIds: ["essay"],
      now,
    });

    const [filter, update, options] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({
      _id: "attempt-id",
      examId: "exam-id",
      studentId: "student-id",
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: now },
    });
    expect(update).toEqual([
      {
        $set: {
          answers: {
            $mergeObjects: [
              { $ifNull: ["$answers", {}] },
              {
                answersByQuestionId: {
                  $mergeObjects: [
                    { $ifNull: ["$answers.answersByQuestionId", {}] },
                    { $literal: { choice: "B" } },
                  ],
                },
              },
            ],
          },
          lastSavedAt: now,
          answerRevision: {
            $add: [{ $ifNull: ["$answerRevision", 0] }, 1],
          },
          updatedAt: now,
        },
      },
    ]);
    expect(options).toEqual({ returnDocument: "after" });
    expect(JSON.stringify(update)).not.toContain("stale-public-id");
  });

  it("guards dedicated essay image mutations by owner, lifecycle, and revision", async () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const mutation = {
      attemptId: "attempt-id",
      examId: "exam-id",
      studentId: "student-id",
      answers: {
        answersByQuestionId: {
          essay: { type: "ESSAY_IMAGE" as const, images: [] },
        },
      },
      expectedAnswerRevision: 3,
      now,
    };

    await attachEssayImageToOwnedActiveExamAttempt(mutation);
    await removeEssayImageFromOwnedActiveExamAttempt(mutation);

    for (const call of mocks.findOneAndUpdate.mock.calls) {
      expect(call[0]).toMatchObject({
        _id: "attempt-id",
        examId: "exam-id",
        studentId: "student-id",
        answerRevision: 3,
        status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
        expiresAt: { $gt: now },
      });
      expect(call[1]).toMatchObject({
        $set: { answers: mutation.answers, lastSavedAt: now },
        $inc: { answerRevision: 1 },
      });
    }
  });

  it("submits essay attempts without grading while atomically preserving image answers", async () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const expiresAt = new Date("2026-08-11T02:59:00.000Z");
    const session = { id: "essay-submission-session" };
    const answers = {
      answersByQuestionId: {
        essay: { type: "ESSAY_IMAGE" as const, images: [] },
        choice: "B" as const,
      },
    };
    const grading = {
      answerKeyRevision: 1,
      objectiveScoreHundredths: 0,
      objectiveMaxScoreHundredths: 500,
      sectionScoresHundredths: { mixed: 0 },
      questionsById: {
        choice: { isCorrect: false, scoreHundredths: 0 },
      },
    };

    await submitOwnedActiveExamAttempt(
      {
        attemptId: "attempt-id",
        examId: "exam-id",
        studentId: "student-id",
        answers,
        grading,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
        essayQuestionIds: ["essay"],
        now,
      },
      session as never,
    );
    await autoSubmitExpiredExamAttemptRecord(
      "expired-attempt-id",
      "student-id",
      "exam-id",
      2,
      grading,
      EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      now,
      session as never,
    );

    const submissionUpdate = mocks.findOneAndUpdate.mock.calls[0][1];
    expect(submissionUpdate).toEqual([
      {
        $set: {
          answers: {
            $mergeObjects: [
              { $ifNull: ["$answers", {}] },
              {
                answersByQuestionId: {
                  $mergeObjects: [
                    { $ifNull: ["$answers.answersByQuestionId", {}] },
                    { $literal: { choice: "B" } },
                  ],
                },
              },
            ],
          },
          status: EXAM_ATTEMPT_STATUS.SUBMITTED,
          gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
          submittedAt: now,
          lastSavedAt: now,
          grading: { $literal: grading },
          gradedAt: now,
          updatedAt: now,
        },
      },
    ]);
    expect(mocks.findOneAndUpdate.mock.calls[0][2]).toEqual({
      returnDocument: "after",
      session,
    });

    const autoSubmissionUpdate = mocks.findOneAndUpdate.mock.calls[1][1];
    expect(autoSubmissionUpdate).toEqual([
      {
        $set: {
          status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
          gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
          submittedAt: "$expiresAt",
          grading,
          gradedAt: now,
          updatedAt: now,
        },
      },
    ]);
    expect(mocks.findOneAndUpdate.mock.calls[1][0]).toMatchObject({
      _id: "expired-attempt-id",
      answerRevision: 2,
      expiresAt: { $lte: now },
    });
    expect(expiresAt.getTime()).toBeLessThan(now.getTime());
  });

  it("replaces only grading fields for terminal attempts", async () => {
    const answers = createEmptyAttemptAnswers();
    const answerKey: ExamAnswerKey = {
      partOne: Array.from({ length: 12 }, () => "A" as const),
      partTwo: Array.from({ length: 4 }, () => ({
        a: true,
        b: false,
        c: true,
        d: false,
      })),
      partThree: ["1", "2", "3", "4", "5", "6"],
    };
    const grading = gradeAttemptAnswers(answers, answerKey, 2);
    const gradedAt = new Date("2026-08-11T03:00:00.000Z");
    const session = { id: "regrade-session" };
    mocks.bulkWrite.mockResolvedValue({ matchedCount: 1 });

    await expect(
      replaceTerminalExamAttemptGradings(
        "exam-id",
        [
          {
            attemptId: "attempt-id",
            grading,
            gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
          },
        ],
        gradedAt,
        session as never,
      ),
    ).resolves.toBe(1);

    const [operations, options] = mocks.bulkWrite.mock.calls[0];
    expect(options).toEqual({ ordered: true, session });
    expect(operations[0].updateOne.filter).toMatchObject({
      _id: "attempt-id",
      examId: "exam-id",
      status: {
        $in: [
          EXAM_ATTEMPT_STATUS.SUBMITTED,
          EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
        ],
      },
    });
    expect(operations[0].updateOne.update).toEqual({
      $set: {
        grading,
        gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
        gradedAt,
        updatedAt: gradedAt,
      },
    });
  });
});
