import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  createEmptyAttemptAnswers,
  getDynamicAttemptAnswerProgress,
  getAttemptAnswerProgress,
  mergePersistedEssayImageAnswer,
} from "@/lib/exam/attempt-answers";
import {
  attemptAnswersRequestSchema,
  attemptAnswersSchema,
  createAttemptAnswersSchemaForStructure,
  examAttemptAnswersSchema,
} from "@/lib/validations/attempt-answers";
import type { EssayImage } from "@/types/exam-attempt";
import { examStructureSnapshotSchema } from "@/lib/validations/exam-structure-template";

const customStructure = examStructureSnapshotSchema.parse({
  sections: [
    {
      id: "choice",
      title: "Multiple choice",
      questions: [
        {
          id: "choice-1",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 200,
        },
      ],
    },
    {
      id: "true-false",
      title: "True or false",
      questions: [
        {
          id: "true-false-1",
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          maxScoreHundredths: 400,
        },
      ],
    },
    {
      id: "short-answer",
      title: "Short answer",
      questions: [
        {
          id: "short-answer-1",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          maxScoreHundredths: 400,
        },
      ],
    },
  ],
});

const essayStructure = examStructureSnapshotSchema.parse({
  sections: [
    {
      id: "essay",
      title: "Essay",
      questions: [
        {
          id: "essay-1",
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          maxScoreHundredths: 1000,
        },
      ],
    },
  ],
});

function createEssayImage(index: number): EssayImage {
  return {
    publicId: `thpt-mock-test/essay-images/scope/image-${index}`,
    secureUrl: `https://res.cloudinary.com/test/image/upload/v1/image-${index}.jpg`,
    originalFilename: `answer-${index}.jpg`,
    bytes: 1024 + index,
    format: "jpg",
    width: 1200,
    height: 800,
  };
}

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
        answers,
        answerRevision: 0,
      }).success,
    ).toBe(true);
    expect(attemptAnswersRequestSchema.safeParse({ answers }).success).toBe(
      false,
    );

    expect(
      attemptAnswersRequestSchema.safeParse({
        answers: {
          ...answers,
          partOne: answers.partOne.slice(1),
        },
        answerRevision: 0,
      }).success,
    ).toBe(false);
    expect(
      attemptAnswersRequestSchema.safeParse({
        answers,
        answerRevision: 0,
        studentId: "client-controlled-student",
      }).success,
    ).toBe(false);
  });

  it("creates and tracks answers for variable snapshot question counts", () => {
    const answers = createEmptyAttemptAnswers(customStructure);

    expect(answers).toEqual({
      answersByQuestionId: {
        "choice-1": null,
        "true-false-1": { a: null, b: null, c: null, d: null },
        "short-answer-1": [null, null, null, null],
      },
    });

    answers.answersByQuestionId["choice-1"] = "A";
    answers.answersByQuestionId["true-false-1"] = {
      a: true,
      b: false,
      c: true,
      d: false,
    };
    answers.answersByQuestionId["short-answer-1"] = ["2", null, null, null];

    expect(getDynamicAttemptAnswerProgress(answers, customStructure)).toEqual({
      answeredQuestions: 3,
      totalQuestions: 3,
      byQuestionId: {
        "choice-1": true,
        "true-false-1": true,
        "short-answer-1": true,
      },
    });
  });

  it("validates answers against exact snapshot question IDs and types", () => {
    const schema = createAttemptAnswersSchemaForStructure(customStructure);
    const answers = createEmptyAttemptAnswers(customStructure);

    expect(schema.safeParse(answers).success).toBe(true);
    expect(
      schema.safeParse({
        answersByQuestionId: {
          "choice-1": null,
          "true-false-1": { a: null, b: null, c: null, d: null },
        },
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        answersByQuestionId: {
          ...answers.answersByQuestionId,
          "outside-snapshot": null,
        },
      }).success,
    ).toBe(false);

    for (const answersByQuestionId of [
      {
        ...answers.answersByQuestionId,
        "choice-1": { a: null, b: null, c: null, d: null },
      },
      { ...answers.answersByQuestionId, "true-false-1": null },
      { ...answers.answersByQuestionId, "short-answer-1": "A" },
    ]) {
      expect(schema.safeParse({ answersByQuestionId }).success).toBe(false);
    }
  });

  it("validates an ordered ESSAY_IMAGE answer against its snapshot question", () => {
    const schema = createAttemptAnswersSchemaForStructure(essayStructure);
    const firstImage = createEssayImage(1);
    const secondImage = createEssayImage(2);
    const answers = {
      answersByQuestionId: {
        "essay-1": {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: [firstImage, secondImage],
        },
      },
    };

    expect(schema.parse(answers)).toEqual(answers);
    const emptyAnswers = createEmptyAttemptAnswers(essayStructure);
    expect(emptyAnswers).toEqual({
      answersByQuestionId: {
        "essay-1": { type: "ESSAY_IMAGE", images: [] },
      },
    });
    expect(
      getDynamicAttemptAnswerProgress(emptyAnswers, essayStructure)
        .answeredQuestions,
    ).toBe(0);
    expect(
      getDynamicAttemptAnswerProgress(answers, essayStructure)
        .answeredQuestions,
    ).toBe(1);
  });

  it("rejects ESSAY_IMAGE answers for wrong, missing, or objective questions", () => {
    const essayAnswer = {
      type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
      images: [createEssayImage(1)],
    };

    expect(
      createAttemptAnswersSchemaForStructure(essayStructure).safeParse({
        answersByQuestionId: { "outside-snapshot": essayAnswer },
      }).success,
    ).toBe(false);
    expect(
      createAttemptAnswersSchemaForStructure(customStructure).safeParse({
        answersByQuestionId: {
          ...createEmptyAttemptAnswers(customStructure).answersByQuestionId,
          "choice-1": essayAnswer,
        },
      }).success,
    ).toBe(false);
  });

  it("limits ESSAY_IMAGE answers to five unique Cloudinary resources", () => {
    const schema = createAttemptAnswersSchemaForStructure(essayStructure);
    const fiveImages = Array.from({ length: 5 }, (_, index) =>
      createEssayImage(index),
    );

    expect(
      schema.safeParse({
        answersByQuestionId: {
          "essay-1": { type: "ESSAY_IMAGE", images: fiveImages },
        },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        answersByQuestionId: {
          "essay-1": {
            type: "ESSAY_IMAGE",
            images: [...fiveImages, createEssayImage(6)],
          },
        },
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        answersByQuestionId: {
          "essay-1": {
            type: "ESSAY_IMAGE",
            images: [fiveImages[0], fiveImages[0]],
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps legacy and dynamic objective answer formats compatible", () => {
    expect(
      examAttemptAnswersSchema.safeParse(createEmptyAttemptAnswers()).success,
    ).toBe(true);
    expect(
      createAttemptAnswersSchemaForStructure(customStructure).safeParse(
        createEmptyAttemptAnswers(customStructure),
      ).success,
    ).toBe(true);
  });

  it("merges successful essay mutations without replacing current objective state", () => {
    const firstImage = createEssayImage(1);
    const secondImage = createEssayImage(2);
    const current = {
      answersByQuestionId: {
        choice: "B" as const,
        essay: { type: "ESSAY_IMAGE" as const, images: [firstImage] },
      },
    };
    const attached = mergePersistedEssayImageAnswer(
      current,
      {
        answersByQuestionId: {
          choice: "A",
          essay: {
            type: "ESSAY_IMAGE",
            images: [firstImage, secondImage],
          },
        },
      },
      "essay",
    );
    const removed = mergePersistedEssayImageAnswer(
      attached,
      {
        answersByQuestionId: {
          choice: "A",
          essay: { type: "ESSAY_IMAGE", images: [secondImage] },
        },
      },
      "essay",
    );

    expect(attached).toEqual({
      answersByQuestionId: {
        choice: "B",
        essay: {
          type: "ESSAY_IMAGE",
          images: [firstImage, secondImage],
        },
      },
    });
    expect(removed).toEqual({
      answersByQuestionId: {
        choice: "B",
        essay: { type: "ESSAY_IMAGE", images: [secondImage] },
      },
    });
    expect(
      mergePersistedEssayImageAnswer(current, current, "missing-question"),
    ).toBe(current);
  });
});
