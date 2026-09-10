import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { gradeAttemptAnswers } from "@/lib/exam/grading";
import {
  attemptGradingSnapshotSchema,
  dynamicAttemptGradingSnapshotSchema,
} from "@/lib/validations/attempt-grading";
import type { ExamAnswerKey } from "@/types/exam";

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

describe("attempt grading snapshot validation", () => {
  it("accepts a snapshot produced by the authoritative grader", () => {
    const grading = gradeAttemptAnswers(
      createEmptyAttemptAnswers(),
      createAnswerKey(),
    );

    expect(attemptGradingSnapshotSchema.safeParse(grading).success).toBe(true);
  });

  it("normalizes a legacy snapshot without a revision to revision 1", () => {
    const { answerKeyRevision: _revision, ...legacyGrading } =
      gradeAttemptAnswers(createEmptyAttemptAnswers(), createAnswerKey());

    expect(_revision).toBe(1);
    expect(attemptGradingSnapshotSchema.parse(legacyGrading)).toMatchObject({
      answerKeyRevision: 1,
    });
  });

  it("rejects contradictory totals and Part II details", () => {
    const grading = gradeAttemptAnswers(
      createEmptyAttemptAnswers(),
      createAnswerKey(),
    );
    const contradictory = structuredClone(grading);
    contradictory.totalScoreHundredths = 1000;
    contradictory.partTwo[0].correctStatementCount = 4;
    contradictory.partTwo[0].scoreHundredths = 100;

    expect(attemptGradingSnapshotSchema.safeParse(contradictory).success).toBe(
      false,
    );
  });

  it("keeps completed totals distinct from pending objective grading", () => {
    const base = {
      answerKeyRevision: 1,
      sectionScoresHundredths: { mixed: 500 },
      questionsById: {
        choice: { isCorrect: true, scoreHundredths: 500 },
      },
    };
    const completed = { ...base, totalScoreHundredths: 500 };
    const pending = {
      ...base,
      objectiveScoreHundredths: 500,
      objectiveMaxScoreHundredths: 500,
    };

    expect(
      dynamicAttemptGradingSnapshotSchema.safeParse(completed).success,
    ).toBe(true);
    expect(dynamicAttemptGradingSnapshotSchema.safeParse(pending).success).toBe(
      true,
    );
    expect(
      dynamicAttemptGradingSnapshotSchema.safeParse({
        ...pending,
        totalScoreHundredths: 500,
      }).success,
    ).toBe(false);
    expect(dynamicAttemptGradingSnapshotSchema.safeParse(base).success).toBe(
      false,
    );
  });
});
