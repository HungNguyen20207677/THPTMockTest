import { describe, expect, it } from "vitest";

import {
  EXAM_ATTEMPT_MODE,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { ExamAttemptModel } from "@/lib/db/models/exam-attempt.model";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";

describe("ExamAttempt model indexes", () => {
  it("gives new attempts the fixed empty persisted answer state", async () => {
    const attempt = new ExamAttemptModel({
      examId: "507f1f77bcf86cd799439011",
      studentId: "507f191e810c19729de860ea",
      attemptNumber: 1,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      startedAt: new Date("2026-08-11T03:00:00.000Z"),
      expiresAt: new Date("2026-08-11T04:30:00.000Z"),
    });

    await expect(attempt.validate()).resolves.toBeUndefined();
    expect(attempt.answers).toEqual(createEmptyAttemptAnswers());
    expect(attempt.mode).toBe(EXAM_ATTEMPT_MODE.MOCK);
    expect(attempt.answerRevision).toBe(0);
    expect(attempt.flaggedQuestionIds).toEqual([]);
  });

  it("requires finite Mock expiration and null Practice expiration", async () => {
    const common = {
      examId: "507f1f77bcf86cd799439011",
      studentId: "507f191e810c19729de860ea",
      attemptNumber: 1,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      startedAt: new Date("2026-08-11T03:00:00.000Z"),
    };

    await expect(
      new ExamAttemptModel({
        ...common,
        mode: EXAM_ATTEMPT_MODE.PRACTICE,
        expiresAt: null,
      }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new ExamAttemptModel({
        ...common,
        mode: EXAM_ATTEMPT_MODE.PRACTICE,
        expiresAt: new Date("2026-08-11T04:30:00.000Z"),
      }).validate(),
    ).rejects.toMatchObject({ name: "ValidationError" });
    await expect(
      new ExamAttemptModel({
        ...common,
        mode: EXAM_ATTEMPT_MODE.MOCK,
      }).validate(),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("keeps attempt mode immutable without managing the migrated numbering index", () => {
    expect(ExamAttemptModel.schema.path("mode").options).toMatchObject({
      immutable: true,
      default: EXAM_ATTEMPT_MODE.MOCK,
    });
    const persistedAttempt = new ExamAttemptModel({
      mode: EXAM_ATTEMPT_MODE.MOCK,
    });
    persistedAttempt.isNew = false;
    persistedAttempt.mode = EXAM_ATTEMPT_MODE.PRACTICE;
    expect(persistedAttempt.mode).toBe(EXAM_ATTEMPT_MODE.MOCK);

    const indexes = ExamAttemptModel.schema.indexes();
    expect(
      indexes.find(([, options]) =>
        options.name?.startsWith("unique_attempt_number_per_student_exam"),
      ),
    ).toBeUndefined();
    expect(
      indexes.find(
        ([, options]) =>
          options.name === "unique_active_attempt_per_student_exam",
      )?.[0],
    ).toEqual({ studentId: 1, examId: 1 });
  });

  it("keeps one active attempt per student and Exam across modes", () => {
    const indexes = ExamAttemptModel.schema.indexes();
    const activeAttemptIndex = indexes.find(
      ([, options]) =>
        options.name === "unique_active_attempt_per_student_exam",
    );

    expect(activeAttemptIndex).toEqual([
      { studentId: 1, examId: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
        },
      }),
    ]);
  });

  it("indexes result history and expiration reconciliation queries", () => {
    const indexes = ExamAttemptModel.schema.indexes();
    const indexByName = new Map(
      indexes.map(([fields, options]) => [options.name, fields]),
    );

    expect(indexByName.get("results_by_submission")).toEqual({
      status: 1,
      submittedAt: -1,
      _id: -1,
    });
    expect(indexByName.get("student_results_by_submission")).toEqual({
      studentId: 1,
      status: 1,
      submittedAt: -1,
      _id: -1,
    });
    expect(indexByName.get("exam_results_by_submission")).toEqual({
      examId: 1,
      status: 1,
      submittedAt: -1,
      _id: -1,
    });
    expect(indexByName.get("student_exam_results_by_submission")).toEqual({
      studentId: 1,
      examId: 1,
      status: 1,
      submittedAt: -1,
      _id: -1,
    });
    expect(indexByName.get("expired_attempts")).toEqual({
      status: 1,
      expiresAt: 1,
    });
  });
});
