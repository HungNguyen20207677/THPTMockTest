import { EXAM_STRUCTURE, PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  createEmptyShortAnswerSlots,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import type {
  AttemptAnswerProgress,
  AttemptAnswers,
  AttemptPartTwoAnswer,
  DynamicAttemptAnswer,
  DynamicAttemptAnswerProgress,
  DynamicAttemptAnswers,
} from "@/types/exam-attempt";
import type {
  ExamStructureQuestion,
  ExamStructureSnapshot,
} from "@/types/exam-structure-template";

function createEmptyPartTwoAnswer(): AttemptPartTwoAnswer {
  return { a: null, b: null, c: null, d: null };
}

function createEmptyDynamicAnswer(
  question: ExamStructureQuestion,
): DynamicAttemptAnswer {
  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE) {
    return null;
  }

  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
    return createEmptyPartTwoAnswer();
  }

  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER) {
    return createEmptyShortAnswerSlots();
  }

  throw new Error("ESSAY_IMAGE attempts are not supported yet.");
}

export function createEmptyAttemptAnswers(): AttemptAnswers;
export function createEmptyAttemptAnswers(
  structure: ExamStructureSnapshot,
): DynamicAttemptAnswers;
export function createEmptyAttemptAnswers(
  structure?: ExamStructureSnapshot,
): AttemptAnswers | DynamicAttemptAnswers {
  if (structure) {
    return {
      answersByQuestionId: Object.fromEntries(
        structure.sections.flatMap((section) =>
          section.questions.map((question) => [
            question.id,
            createEmptyDynamicAnswer(question),
          ]),
        ),
      ),
    };
  }

  return {
    partOne: Array.from(
      { length: EXAM_STRUCTURE.partOneQuestions },
      () => null,
    ),
    partTwo: Array.from(
      { length: EXAM_STRUCTURE.partTwoQuestions },
      createEmptyPartTwoAnswer,
    ),
    partThree: Array.from(
      { length: EXAM_STRUCTURE.partThreeQuestions },
      createEmptyShortAnswerSlots,
    ),
  };
}

export function countAnsweredPartTwoStatements(
  answer: AttemptPartTwoAnswer,
): number {
  return PART_TWO_STATEMENTS.filter((statement) => answer[statement] !== null)
    .length;
}

export function getAttemptAnswerProgress(
  answers: AttemptAnswers,
): AttemptAnswerProgress {
  const partOne = answers.partOne.map((answer) => answer !== null);
  const partTwo = answers.partTwo.map(
    (answer) =>
      countAnsweredPartTwoStatements(answer) ===
      EXAM_STRUCTURE.partTwoStatementsPerQuestion,
  );
  const partThree = answers.partThree.map(
    (answer) => shortAnswerSlotsToCanonicalValue(answer) !== null,
  );

  return {
    answeredQuestions: [...partOne, ...partTwo, ...partThree].filter(Boolean)
      .length,
    totalQuestions: EXAM_STRUCTURE.totalQuestions,
    partOne,
    partTwo,
    partThree,
  };
}

export function isDynamicQuestionAnswered(
  question: ExamStructureQuestion,
  answer: DynamicAttemptAnswer | undefined,
): boolean {
  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE) {
    return typeof answer === "string";
  }

  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
    return (
      answer !== null &&
      answer !== undefined &&
      typeof answer === "object" &&
      !Array.isArray(answer) &&
      !("type" in answer) &&
      countAnsweredPartTwoStatements(answer) ===
        EXAM_STRUCTURE.partTwoStatementsPerQuestion
    );
  }

  if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
    return (
      answer !== null &&
      answer !== undefined &&
      typeof answer === "object" &&
      !Array.isArray(answer) &&
      "type" in answer &&
      answer.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE &&
      "images" in answer &&
      Array.isArray(answer.images) &&
      answer.images.length > 0
    );
  }

  return Array.isArray(answer)
    ? shortAnswerSlotsToCanonicalValue(answer) !== null
    : false;
}

export function getDynamicAttemptAnswerProgress(
  answers: DynamicAttemptAnswers,
  structure: ExamStructureSnapshot,
): DynamicAttemptAnswerProgress {
  const entries = structure.sections.flatMap((section) =>
    section.questions.map(
      (question) =>
        [
          question.id,
          isDynamicQuestionAnswered(
            question,
            answers.answersByQuestionId[question.id],
          ),
        ] as const,
    ),
  );
  const byQuestionId = Object.fromEntries(entries);

  return {
    answeredQuestions: entries.filter(([, answered]) => answered).length,
    totalQuestions: entries.length,
    byQuestionId,
  };
}
