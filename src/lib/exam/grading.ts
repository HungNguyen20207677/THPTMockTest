import {
  EXAM_SCORING_HUNDREDTHS,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import {
  normalizeCanonicalShortAnswer,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import { attemptAnswersSchema } from "@/lib/validations/attempt-answers";
import { examAnswerKeySchema } from "@/lib/validations/exam";
import type {
  AttemptAnswers,
  AttemptGradingSnapshot,
} from "@/types/exam-attempt";
import type { ExamAnswerKey, PartTwoAnswer } from "@/types/exam";

export function scoreHundredthsToPoints(scoreHundredths: number): number {
  return scoreHundredths / 100;
}

export function gradeAttemptAnswers(
  answersInput: AttemptAnswers,
  answerKeyInput: ExamAnswerKey,
): AttemptGradingSnapshot {
  const parsedAnswers = attemptAnswersSchema.safeParse(answersInput);
  const parsedAnswerKey = examAnswerKeySchema.safeParse(answerKeyInput);

  if (!parsedAnswers.success || !parsedAnswerKey.success) {
    throw new Error("Cannot grade malformed attempt or answer-key data.");
  }

  const answers = parsedAnswers.data;
  const answerKey = parsedAnswerKey.data;
  const partOne = answers.partOne.map((answer, index) => ({
    isCorrect: answer !== null && answer === answerKey.partOne[index],
  }));
  const partTwo = answers.partTwo.map((answer, questionIndex) => {
    const correctAnswer = answerKey.partTwo[questionIndex];
    const statements: PartTwoAnswer = {
      a: answer.a !== null && answer.a === correctAnswer.a,
      b: answer.b !== null && answer.b === correctAnswer.b,
      c: answer.c !== null && answer.c === correctAnswer.c,
      d: answer.d !== null && answer.d === correctAnswer.d,
    };
    const correctStatementCount = PART_TWO_STATEMENTS.filter(
      (statement) => statements[statement],
    ).length;

    return {
      correctStatementCount,
      scoreHundredths:
        EXAM_SCORING_HUNDREDTHS.partTwoPointsByCorrectStatements[
          correctStatementCount as 0 | 1 | 2 | 3 | 4
        ],
      statements,
    };
  });
  const partThree = answers.partThree.map((answer, index) => {
    const studentCanonical = shortAnswerSlotsToCanonicalValue(answer);
    const normalizedStudent = studentCanonical
      ? normalizeCanonicalShortAnswer(studentCanonical)
      : null;
    const normalizedCorrect = normalizeCanonicalShortAnswer(
      answerKey.partThree[index],
    );

    if (!normalizedCorrect) {
      throw new Error("Cannot grade a malformed Part III answer key.");
    }

    return {
      isCorrect:
        normalizedStudent !== null && normalizedStudent === normalizedCorrect,
    };
  });
  const partOneScore =
    partOne.filter((result) => result.isCorrect).length *
    EXAM_SCORING_HUNDREDTHS.partOnePointsPerAnswer;
  const partTwoScore = partTwo.reduce(
    (total, result) => total + result.scoreHundredths,
    0,
  );
  const partThreeScore =
    partThree.filter((result) => result.isCorrect).length *
    EXAM_SCORING_HUNDREDTHS.partThreePointsPerAnswer;

  return {
    totalScoreHundredths: partOneScore + partTwoScore + partThreeScore,
    sectionScoresHundredths: {
      partOne: partOneScore,
      partTwo: partTwoScore,
      partThree: partThreeScore,
    },
    partOne,
    partTwo,
    partThree,
  };
}
