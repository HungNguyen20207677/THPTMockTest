import { EXAM_STRUCTURE, PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import {
  createEmptyShortAnswerSlots,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import type {
  AttemptAnswerProgress,
  AttemptAnswers,
  AttemptPartTwoAnswer,
} from "@/types/exam-attempt";

function createEmptyPartTwoAnswer(): AttemptPartTwoAnswer {
  return { a: null, b: null, c: null, d: null };
}

export function createEmptyAttemptAnswers(): AttemptAnswers {
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
