import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import {
  createEmptyAttemptAnswers,
  getAttemptAnswerProgress,
} from "@/lib/exam/attempt-answers";
import {
  attemptAnswersRequestSchema,
  attemptAnswersSchema,
} from "@/lib/validations/attempt-answers";

describe("attempt answers", () => {
  it("creates an empty fixed 12 + 4 + 6 answer structure", () => {
    const answers = createEmptyAttemptAnswers();

    expect(answers.partOne).toHaveLength(EXAM_STRUCTURE.partOneQuestions);
    expect(answers.partOne.every((answer) => answer === null)).toBe(true);
    expect(answers.partTwo).toHaveLength(EXAM_STRUCTURE.partTwoQuestions);
    expect(answers.partTwo).toEqual(
      Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
        a: null,
        b: null,
        c: null,
        d: null,
      })),
    );
    expect(answers.partThree).toHaveLength(EXAM_STRUCTURE.partThreeQuestions);
    expect(
      answers.partThree.every(
        (answer) =>
          answer.length === EXAM_STRUCTURE.shortAnswerSlots &&
          answer.every((slot) => slot === null),
      ),
    ).toBe(true);
    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
  });

  it("accepts A/B/C/D/null for exactly 12 Part I questions", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne.splice(0, 5, "A", "B", "C", "D", null);

    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partOne: answers.partOne.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partOne: ["E", ...answers.partOne.slice(1)],
      }).success,
    ).toBe(false);
  });

  it("accepts true/false/null for exactly 4 x 4 Part II values", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partTwo[0] = { a: true, b: false, c: null, d: true };

    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partTwo: answers.partTwo.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partTwo: [{ a: true, b: false, c: null }, ...answers.partTwo.slice(1)],
      }).success,
    ).toBe(false);
  });

  it("requires exactly six fixed four-slot Part III answers", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[0] = ["-", "0", ",", "5"];

    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partThree: answers.partThree.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      attemptAnswersSchema.safeParse({
        ...answers,
        partThree: [["1", null, null], ...answers.partThree.slice(1)],
      }).success,
    ).toBe(false);
  });

  it("counts answered top-level questions across all three sections", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partOne[0] = "A";
    answers.partOne[1] = "D";
    answers.partTwo[0] = { a: true, b: false, c: true, d: false };
    answers.partThree[0] = ["-", "0", ",", "5"];

    const progress = getAttemptAnswerProgress(answers);

    expect(progress.answeredQuestions).toBe(4);
    expect(progress.totalQuestions).toBe(22);
    expect(progress.partOne.slice(0, 3)).toEqual([true, true, false]);
    expect(progress.partTwo[0]).toBe(true);
    expect(progress.partThree[0]).toBe(true);
  });

  it("does not count a partially answered Part II question", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partTwo[0] = { a: true, b: false, c: null, d: null };

    const progress = getAttemptAnswerProgress(answers);

    expect(progress.partTwo[0]).toBe(false);
    expect(progress.answeredQuestions).toBe(0);
  });

  it("counts a fully answered Part II question as one question", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partTwo[0] = { a: true, b: false, c: true, d: false };

    const progress = getAttemptAnswerProgress(answers);

    expect(progress.partTwo[0]).toBe(true);
    expect(progress.answeredQuestions).toBe(1);
  });

  it("counts a valid non-empty Part III answer", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[0] = ["1", "2", ",", "5"];

    expect(getAttemptAnswerProgress(answers).partThree[0]).toBe(true);
    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
  });

  it("saves but does not count an incomplete Part III state", () => {
    const answers = createEmptyAttemptAnswers();
    answers.partThree[1] = ["-", null, null, null];

    const progress = getAttemptAnswerProgress(answers);

    expect(progress.partThree[0]).toBe(false);
    expect(progress.partThree[1]).toBe(false);
    expect(progress.answeredQuestions).toBe(0);
    expect(attemptAnswersSchema.safeParse(answers).success).toBe(true);
  });

  it("rejects malformed or unexpected save payload fields", () => {
    const answers = createEmptyAttemptAnswers();

    expect(
      attemptAnswersRequestSchema.safeParse({
        answers: {
          ...answers,
          partOne: answers.partOne.slice(1),
        },
      }).success,
    ).toBe(false);
    expect(
      attemptAnswersRequestSchema.safeParse({
        answers,
        studentId: "client-controlled-student",
      }).success,
    ).toBe(false);
  });
});
