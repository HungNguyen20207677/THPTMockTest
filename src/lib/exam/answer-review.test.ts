import { describe, expect, it } from "vitest";

import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  ANSWER_REVIEW_FILTER,
  classifyAnswerReviewQuestions,
  filterAnswerReviewQuestions,
} from "@/lib/exam/answer-review";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";

function createResult(
  overrides: Partial<StudentExamAttemptResult> = {},
): StudentExamAttemptResult {
  return {
    exam: { id: "exam-id", title: "Đề thi" },
    attempt: {
      id: "attempt-id",
      attemptNumber: 1,
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      startedAt: "2026-08-11T01:00:00.000Z",
      expiresAt: "2026-08-11T02:30:00.000Z",
      submittedAt: "2026-08-11T02:00:00.000Z",
      timeUsedSeconds: 3600,
    },
    visibility: { score: true, answers: true },
    gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.COMPLETED,
    ...overrides,
  };
}

const statements = {
  a: { studentAnswer: true, correctAnswer: true, isCorrect: true },
  b: { studentAnswer: true, correctAnswer: false, isCorrect: false },
  c: { studentAnswer: false, correctAnswer: false, isCorrect: true },
  d: { studentAnswer: false, correctAnswer: true, isCorrect: false },
};

function createDynamicResult(): StudentExamAttemptResult {
  return createResult({
    exam: {
      id: "exam-id",
      title: "Đề động",
      structureSnapshot: {
        sections: [
          {
            id: "section-one",
            title: "Phần một",
            questions: [
              {
                id: "correct",
                type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
                maxScoreHundredths: 100,
              },
              {
                id: "partial",
                type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
                maxScoreHundredths: 200,
              },
            ],
          },
          {
            id: "section-two",
            title: "Phần hai",
            questions: [
              {
                id: "unanswered",
                type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
                maxScoreHundredths: 100,
              },
              {
                id: "incorrect",
                type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
                maxScoreHundredths: 100,
              },
            ],
          },
        ],
      },
    },
    dynamicAnswerReview: {
      questionsById: {
        correct: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          studentAnswer: "A",
          correctAnswer: "A",
          isCorrect: true,
        },
        partial: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          studentAnswer: { a: true, b: true, c: false, d: false },
          correctAnswer: { a: true, b: false, c: false, d: true },
          correctStatementCount: 2,
          statements,
          score: 0.5,
        },
        unanswered: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          studentAnswer: [null, null, null, null],
          studentDisplayAnswer: null,
          correctDisplayAnswer: "12",
          isCorrect: false,
        },
        incorrect: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          studentAnswer: "B",
          correctAnswer: "A",
          isCorrect: false,
        },
      },
    },
  });
}

describe("answer review classification", () => {
  it("classifies dynamic objective questions in structure order", () => {
    expect(classifyAnswerReviewQuestions(createDynamicResult())).toEqual([
      { id: "correct", classification: "correct" },
      { id: "partial", classification: "partial" },
      { id: "unanswered", classification: "unanswered" },
      { id: "incorrect", classification: "incorrect" },
    ]);
  });

  it("classifies legacy choice, TRUE_FALSE, and short answers", () => {
    const result = createResult({
      answerReview: {
        partOne: [
          { studentAnswer: null, correctAnswer: "A", isCorrect: false },
          { studentAnswer: "A", correctAnswer: "A", isCorrect: true },
        ],
        partTwo: [
          {
            studentAnswer: { a: true, b: true, c: false, d: false },
            correctAnswer: { a: true, b: false, c: false, d: true },
            correctStatementCount: 2,
            statements,
            score: 0.25,
          },
        ],
        partThree: [
          {
            studentAnswer: ["1", null, null, null],
            studentDisplayAnswer: "1",
            correctDisplayAnswer: "2",
            isCorrect: false,
          },
        ],
      },
    });

    expect(classifyAnswerReviewQuestions(result)).toEqual([
      { id: "legacy-part-one-0", classification: "unanswered" },
      { id: "legacy-part-one-1", classification: "correct" },
      { id: "legacy-part-two-0", classification: "partial" },
      { id: "legacy-part-three-0", classification: "incorrect" },
    ]);
  });

  it("keeps pending essays out of correctness categories", () => {
    const result = createResult({
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      exam: {
        id: "exam-id",
        title: "Đề tự luận",
        structureSnapshot: {
          sections: [
            {
              id: "essay-section",
              title: "Tự luận",
              questions: [
                {
                  id: "essay",
                  type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                  maxScoreHundredths: 500,
                },
              ],
            },
          ],
        },
      },
      dynamicAnswerReview: {
        questionsById: {
          essay: {
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            studentAnswer: {
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              images: [
                {
                  publicId: "image",
                  secureUrl: "https://example.com/image.jpg",
                  originalFilename: "image.jpg",
                  bytes: 10,
                  format: "jpg",
                  width: 100,
                  height: 100,
                },
              ],
            },
          },
        },
      },
    });

    expect(classifyAnswerReviewQuestions(result)).toEqual([
      { id: "essay", classification: "pending" },
    ]);
  });

  it("uses authoritative visible scores for graded essays", () => {
    const result = createResult({
      exam: {
        id: "exam-id",
        title: "Đề tự luận",
        structureSnapshot: {
          sections: [
            {
              id: "essay-section",
              title: "Tự luận",
              questions: [
                {
                  id: "full",
                  type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                  maxScoreHundredths: 300,
                },
                {
                  id: "partial",
                  type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                  maxScoreHundredths: 300,
                },
                {
                  id: "zero",
                  type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                  maxScoreHundredths: 300,
                },
              ],
            },
          ],
        },
      },
      dynamicAnswerReview: {
        questionsById: Object.fromEntries(
          (
            [
              ["full", 3],
              ["partial", 1.5],
              ["zero", 0],
            ] satisfies Array<[string, number]>
          ).map(([id, score]) => [
            id,
            {
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              studentAnswer: {
                type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                images: [
                  {
                    publicId: `${id}-image`,
                    secureUrl: `https://example.com/${id}.jpg`,
                    originalFilename: `${id}.jpg`,
                    bytes: 10,
                    format: "jpg",
                    width: 100,
                    height: 100,
                  },
                ],
              },
              score,
            },
          ]),
        ),
      },
    });

    expect(classifyAnswerReviewQuestions(result)).toEqual([
      { id: "full", classification: "correct" },
      { id: "partial", classification: "partial" },
      { id: "zero", classification: "incorrect" },
    ]);
  });

  it("does not infer hidden answers or hidden essay scores", () => {
    const hiddenAnswers = createDynamicResult();
    hiddenAnswers.visibility = { score: true, answers: false };
    expect(classifyAnswerReviewQuestions(hiddenAnswers)).toEqual([]);

    const hiddenScore = createResult({
      visibility: { score: false, answers: true },
      exam: {
        id: "exam-id",
        title: "Đề tự luận",
        structureSnapshot: {
          sections: [
            {
              id: "essay-section",
              title: "Tự luận",
              questions: [
                {
                  id: "essay",
                  type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
                  maxScoreHundredths: 500,
                },
              ],
            },
          ],
        },
      },
      dynamicAnswerReview: {
        questionsById: {
          essay: {
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            studentAnswer: {
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              images: [
                {
                  publicId: "image",
                  secureUrl: "https://example.com/image.jpg",
                  originalFilename: "image.jpg",
                  bytes: 10,
                  format: "jpg",
                  width: 100,
                  height: 100,
                },
              ],
            },
          },
        },
      },
    });
    expect(classifyAnswerReviewQuestions(hiddenScore)).toEqual([
      { id: "essay", classification: null },
    ]);
  });

  it("filters without changing order or mutating result data", () => {
    const result = createDynamicResult();
    const before = structuredClone(result);
    const questions = classifyAnswerReviewQuestions(result);

    expect(
      filterAnswerReviewQuestions(questions, ANSWER_REVIEW_FILTER.INCORRECT),
    ).toEqual([{ id: "incorrect", classification: "incorrect" }]);
    expect(
      filterAnswerReviewQuestions(questions, ANSWER_REVIEW_FILTER.ALL),
    ).toEqual(questions);
    expect(result).toEqual(before);
  });
});
