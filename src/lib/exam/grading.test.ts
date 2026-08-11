import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import {
  gradeAttemptAnswers,
  scoreHundredthsToPoints,
} from "@/lib/exam/grading";
import { normalizeCanonicalShortAnswer } from "@/lib/exam/short-answer";
import type { AttemptAnswers } from "@/types/exam-attempt";
import type { ExamAnswerKey } from "@/types/exam";

function createAnswerKey(): ExamAnswerKey {
  return {
    partOne: Array.from(
      { length: EXAM_STRUCTURE.partOneQuestions },
      () => "A" as const,
    ),
    partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
      a: true,
      b: true,
      c: true,
      d: true,
    })),
    partThree: ["1", "2", "3", "4", "5", "6"],
  };
}

function createPerfectAnswers(): AttemptAnswers {
  return {
    partOne: Array.from(
      { length: EXAM_STRUCTURE.partOneQuestions },
      () => "A" as const,
    ),
    partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
      a: true,
      b: true,
      c: true,
      d: true,
    })),
    partThree: [
      ["1", null, null, null],
      ["2", null, null, null],
      ["3", null, null, null],
      ["4", null, null, null],
      ["5", null, null, null],
      ["6", null, null, null],
    ],
  };
}

describe("THPT Math grading", () => {
  it("awards exactly 3.00 for all-correct Part I", () => {
    const grading = gradeAttemptAnswers(
      createPerfectAnswers(),
      createAnswerKey(),
    );

    expect(grading.sectionScoresHundredths.partOne).toBe(300);
    expect(scoreHundredthsToPoints(300)).toBe(3);
  });

  it("awards zero for wrong or unanswered Part I answers", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "B";

    const grading = gradeAttemptAnswers(answers, createAnswerKey());

    expect(grading.partOne.every((item) => !item.isCorrect)).toBe(true);
    expect(grading.sectionScoresHundredths.partOne).toBe(0);
  });

  it.each([
    { correctCount: 0, expected: 0 },
    { correctCount: 1, expected: 10 },
    { correctCount: 2, expected: 25 },
    { correctCount: 3, expected: 50 },
    { correctCount: 4, expected: 100 },
  ])(
    "maps $correctCount correct Part II statements to $expected hundredths",
    ({ correctCount, expected }) => {
      const answers = createEmptyAttemptAnswers();
      answers.partTwo[0] = {
        a: correctCount >= 1,
        b: correctCount >= 2,
        c: correctCount >= 3,
        d: correctCount >= 4,
      };

      const grading = gradeAttemptAnswers(answers, createAnswerKey());

      expect(grading.partTwo[0]).toMatchObject({
        correctStatementCount: correctCount,
        scoreHundredths: expected,
      });
    },
  );

  it("treats an unanswered Part II statement as incorrect", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partTwo[0] = { a: true, b: null, c: null, d: null };

    const grading = gradeAttemptAnswers(answers, createAnswerKey());

    expect(grading.partTwo[0].statements).toEqual({
      a: true,
      b: false,
      c: false,
      d: false,
    });
    expect(grading.partTwo[0].scoreHundredths).toBe(10);
  });

  it("awards 0.50 for a correct Part III answer", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[0] = ["1", null, null, null];

    const grading = gradeAttemptAnswers(answers, createAnswerKey());

    expect(grading.partThree[0].isCorrect).toBe(true);
    expect(grading.sectionScoresHundredths.partThree).toBe(50);
  });

  it("awards zero for an unanswered Part III answer", () => {
    const grading = gradeAttemptAnswers(
      createEmptyAttemptAnswers(),
      createAnswerKey(),
    );

    expect(grading.partThree[0].isCorrect).toBe(false);
    expect(grading.sectionScoresHundredths.partThree).toBe(0);
  });

  it("treats a structurally saved incomplete Part III answer as incorrect", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[0] = ["-", null, null, null];

    const grading = gradeAttemptAnswers(answers, createAnswerKey());

    expect(grading.partThree[0].isCorrect).toBe(false);
    expect(grading.sectionScoresHundredths.partThree).toBe(0);
  });

  it("compares equivalent Part III decimal forms semantically", () => {
    const answers = createEmptyAttemptAnswers();
    const answerKey = createAnswerKey();
    answers.partThree[0] = ["0", "1", ",", "2"];
    answers.partThree[1] = ["1", ",", "2", "0"];
    answers.partThree[2] = ["-", "0", null, null];
    answerKey.partThree.splice(0, 3, "1.2", "1.2", "0");

    const grading = gradeAttemptAnswers(answers, answerKey);

    expect(grading.partThree.slice(0, 3)).toEqual([
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ]);
    expect(normalizeCanonicalShortAnswer("01.20")).toBe("1.2");
    expect(normalizeCanonicalShortAnswer("0001")).toBe("1");
    expect(normalizeCanonicalShortAnswer("-0.0")).toBe("0");
  });

  it("marks different Part III numerical values incorrect", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[0] = ["2", null, null, null];

    const grading = gradeAttemptAnswers(answers, createAnswerKey());

    expect(grading.partThree[0].isCorrect).toBe(false);
  });

  it("grades a perfect paper as exactly 10.00", () => {
    const grading = gradeAttemptAnswers(
      createPerfectAnswers(),
      createAnswerKey(),
    );

    expect(grading.totalScoreHundredths).toBe(1000);
    expect(scoreHundredthsToPoints(grading.totalScoreHundredths)).toBe(10);
  });

  it("uses exact integer arithmetic for mixed scores", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    answers.partTwo[0] = { a: true, b: false, c: false, d: false };
    answers.partTwo[1] = { a: true, b: true, c: false, d: false };
    answers.partTwo[2] = { a: true, b: true, c: true, d: false };
    answers.partTwo[3] = { a: true, b: true, c: true, d: true };
    answers.partThree[0] = ["1", null, null, null];

    const grading = gradeAttemptAnswers(answers, createAnswerKey());
    const sectionTotal =
      grading.sectionScoresHundredths.partOne +
      grading.sectionScoresHundredths.partTwo +
      grading.sectionScoresHundredths.partThree;

    expect(grading.sectionScoresHundredths).toEqual({
      partOne: 25,
      partTwo: 185,
      partThree: 50,
    });
    expect(grading.totalScoreHundredths).toBe(260);
    expect(sectionTotal).toBe(grading.totalScoreHundredths);
  });
});
