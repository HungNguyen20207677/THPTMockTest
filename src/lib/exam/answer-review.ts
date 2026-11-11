import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type {
  DynamicQuestionAnswerReview,
  StudentExamAttemptResult,
} from "@/types/exam-attempt";

export const ANSWER_REVIEW_FILTER = {
  ALL: "all",
  INCORRECT: "incorrect",
  PARTIAL: "partial",
  UNANSWERED: "unanswered",
  CORRECT: "correct",
} as const;

export type AnswerReviewFilter =
  (typeof ANSWER_REVIEW_FILTER)[keyof typeof ANSWER_REVIEW_FILTER];

export type AnswerReviewClassification = Exclude<AnswerReviewFilter, "all">;

export interface ClassifiedAnswerReviewQuestion {
  id: string;
  classification: AnswerReviewClassification | "pending" | null;
}

function isTrueFalseUnanswered(
  answer: Extract<
    DynamicQuestionAnswerReview,
    { type: "TRUE_FALSE" }
  >["studentAnswer"],
): boolean {
  return Object.values(answer).every((value) => value === null);
}

function isShortAnswerUnanswered(
  answer: Extract<
    DynamicQuestionAnswerReview,
    { type: "SHORT_ANSWER" }
  >["studentAnswer"],
): boolean {
  return answer.every((value) => value === null);
}

function classifyBinaryAnswer(
  unanswered: boolean,
  isCorrect: boolean,
): AnswerReviewClassification {
  if (unanswered) return ANSWER_REVIEW_FILTER.UNANSWERED;
  return isCorrect
    ? ANSWER_REVIEW_FILTER.CORRECT
    : ANSWER_REVIEW_FILTER.INCORRECT;
}

function classifyTrueFalseAnswer(
  unanswered: boolean,
  correctStatementCount: number,
): AnswerReviewClassification {
  if (unanswered) return ANSWER_REVIEW_FILTER.UNANSWERED;
  if (correctStatementCount === 4) return ANSWER_REVIEW_FILTER.CORRECT;
  if (correctStatementCount > 0) return ANSWER_REVIEW_FILTER.PARTIAL;
  return ANSWER_REVIEW_FILTER.INCORRECT;
}

function classifyDynamicQuestion(
  item: DynamicQuestionAnswerReview,
  maximumScore: number,
  gradingStatus: StudentExamAttemptResult["gradingStatus"],
): AnswerReviewClassification | "pending" | null {
  if (item.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE) {
    return classifyBinaryAnswer(item.studentAnswer === null, item.isCorrect);
  }

  if (item.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
    return classifyTrueFalseAnswer(
      isTrueFalseUnanswered(item.studentAnswer),
      item.correctStatementCount,
    );
  }

  if (item.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER) {
    return classifyBinaryAnswer(
      isShortAnswerUnanswered(item.studentAnswer),
      item.isCorrect,
    );
  }

  if (item.studentAnswer.images.length === 0) {
    return ANSWER_REVIEW_FILTER.UNANSWERED;
  }
  if (item.score === undefined) {
    return gradingStatus === "PENDING_MANUAL" ? "pending" : null;
  }
  if (item.score === maximumScore) return ANSWER_REVIEW_FILTER.CORRECT;
  if (item.score > 0) return ANSWER_REVIEW_FILTER.PARTIAL;
  return ANSWER_REVIEW_FILTER.INCORRECT;
}

export function classifyAnswerReviewQuestions(
  result: StudentExamAttemptResult,
): ClassifiedAnswerReviewQuestion[] {
  if (!result.visibility.answers) return [];

  if (result.dynamicAnswerReview && result.exam.structureSnapshot) {
    return result.exam.structureSnapshot.sections.flatMap((section) =>
      section.questions.flatMap((question) => {
        const item = result.dynamicAnswerReview?.questionsById[question.id];
        if (!item) return [];

        return [
          {
            id: question.id,
            classification: classifyDynamicQuestion(
              item,
              question.maxScoreHundredths / 100,
              result.gradingStatus,
            ),
          },
        ];
      }),
    );
  }

  const review = result.answerReview;
  if (!review) return [];

  return [
    ...review.partOne.map((item, index) => ({
      id: `legacy-part-one-${index}`,
      classification: classifyBinaryAnswer(
        item.studentAnswer === null,
        item.isCorrect,
      ),
    })),
    ...review.partTwo.map((item, index) => ({
      id: `legacy-part-two-${index}`,
      classification: classifyTrueFalseAnswer(
        isTrueFalseUnanswered(item.studentAnswer),
        item.correctStatementCount,
      ),
    })),
    ...review.partThree.map((item, index) => ({
      id: `legacy-part-three-${index}`,
      classification: classifyBinaryAnswer(
        isShortAnswerUnanswered(item.studentAnswer),
        item.isCorrect,
      ),
    })),
  ];
}

export function filterAnswerReviewQuestions(
  questions: ClassifiedAnswerReviewQuestion[],
  filter: AnswerReviewFilter,
): ClassifiedAnswerReviewQuestion[] {
  return filter === ANSWER_REVIEW_FILTER.ALL
    ? questions
    : questions.filter((question) => question.classification === filter);
}
