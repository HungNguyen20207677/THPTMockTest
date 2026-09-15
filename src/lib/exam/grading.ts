import {
  EXAM_SCORING_HUNDREDTHS,
  INITIAL_ANSWER_KEY_REVISION,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { isDynamicExamAnswerKey } from "@/lib/exam/answer-key";
import {
  normalizeCanonicalShortAnswer,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import {
  attemptAnswersSchema,
  createAttemptAnswersSchemaForStructure,
  isDynamicAttemptAnswers,
} from "@/lib/validations/attempt-answers";
import {
  createDynamicExamAnswerKeySchema,
  examAnswerKeySchema,
} from "@/lib/validations/exam";
import type {
  AttemptGradingSnapshot,
  CompletedExamAttemptGradingSnapshot,
  AttemptPartTwoAnswer,
  DynamicAttemptAnswers,
  DynamicAttemptGradingSnapshot,
  DynamicCompletedAttemptGradingSnapshot,
  DynamicPendingManualAttemptGradingSnapshot,
  DynamicQuestionGradingResult,
  ExamAttemptAnswers,
  ExamAttemptGradingSnapshot,
  ManualEssayScore,
} from "@/types/exam-attempt";
import type {
  AnyExamAnswerKey,
  DynamicExamAnswerKey,
  PartTwoAnswer,
  ShortAnswerSlots,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

export function scoreHundredthsToPoints(scoreHundredths: number): number {
  return scoreHundredths / 100;
}

export function gradeAttemptAnswers(
  answersInput: ExamAttemptAnswers,
  answerKeyInput: AnyExamAnswerKey,
  answerKeyRevision = INITIAL_ANSWER_KEY_REVISION,
): AttemptGradingSnapshot {
  const parsedAnswers = attemptAnswersSchema.safeParse(answersInput);
  const parsedAnswerKey = examAnswerKeySchema.safeParse(answerKeyInput);

  if (
    !parsedAnswers.success ||
    !parsedAnswerKey.success ||
    !Number.isInteger(answerKeyRevision) ||
    answerKeyRevision < INITIAL_ANSWER_KEY_REVISION
  ) {
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
    answerKeyRevision,
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

function getDynamicTrueFalseScoreHundredths(
  maxScoreHundredths: number,
  correctStatementCount: 0 | 1 | 2 | 3 | 4,
): number {
  if (maxScoreHundredths % 20 !== 0) {
    throw new Error(
      "TRUE_FALSE maximum scores must be divisible by 20 hundredths.",
    );
  }

  switch (correctStatementCount) {
    case 0:
      return 0;
    case 1:
      return maxScoreHundredths / 10;
    case 2:
      return maxScoreHundredths / 4;
    case 3:
      return maxScoreHundredths / 2;
    case 4:
      return maxScoreHundredths;
  }
}

function assertValidAnswerKeyRevision(answerKeyRevision: number): void {
  if (
    !Number.isInteger(answerKeyRevision) ||
    answerKeyRevision < INITIAL_ANSWER_KEY_REVISION
  ) {
    throw new Error("Cannot grade with an invalid answer-key revision.");
  }
}

export function gradeDynamicAttemptAnswers(
  answersInput: DynamicAttemptAnswers,
  answerKeyInput: DynamicExamAnswerKey,
  structure: ExamStructureSnapshot,
  answerKeyRevision = INITIAL_ANSWER_KEY_REVISION,
): DynamicAttemptGradingSnapshot {
  assertValidAnswerKeyRevision(answerKeyRevision);
  const answers = createAttemptAnswersSchemaForStructure(structure).parse(
    answersInput,
  ) as DynamicAttemptAnswers;
  const answerKey =
    createDynamicExamAnswerKeySchema(structure).parse(answerKeyInput);
  const sectionScoresHundredths: Record<string, number> = {};
  const questionsById: Record<string, DynamicQuestionGradingResult> = {};
  const manualEssayScores: ManualEssayScore[] = [];
  let objectiveMaxScoreHundredths = 0;
  let containsEssayImage = false;

  for (const section of structure.sections) {
    let sectionScore = 0;

    for (const question of section.questions) {
      if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
        containsEssayImage = true;
        manualEssayScores.push({
          questionId: question.id,
          scoreHundredths: null,
        });
        continue;
      }

      const studentAnswer = answers.answersByQuestionId[question.id];
      const correctAnswer = answerKey.answersByQuestionId[question.id];
      let result: DynamicQuestionGradingResult;
      objectiveMaxScoreHundredths += question.maxScoreHundredths;

      if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE) {
        const isCorrect =
          studentAnswer !== null && studentAnswer === correctAnswer;
        result = {
          isCorrect,
          scoreHundredths: isCorrect ? question.maxScoreHundredths : 0,
        };
      } else if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
        const studentStatements = studentAnswer as AttemptPartTwoAnswer;
        const correctStatements = correctAnswer as PartTwoAnswer;
        const statements: PartTwoAnswer = {
          a:
            studentStatements.a !== null &&
            studentStatements.a === correctStatements.a,
          b:
            studentStatements.b !== null &&
            studentStatements.b === correctStatements.b,
          c:
            studentStatements.c !== null &&
            studentStatements.c === correctStatements.c,
          d:
            studentStatements.d !== null &&
            studentStatements.d === correctStatements.d,
        };
        const correctStatementCount = PART_TWO_STATEMENTS.filter(
          (statement) => statements[statement],
        ).length as 0 | 1 | 2 | 3 | 4;
        result = {
          correctStatementCount,
          scoreHundredths: getDynamicTrueFalseScoreHundredths(
            question.maxScoreHundredths,
            correctStatementCount,
          ),
          statements,
        };
      } else if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER) {
        const studentCanonical = shortAnswerSlotsToCanonicalValue(
          studentAnswer as ShortAnswerSlots,
        );
        const normalizedStudent = studentCanonical
          ? normalizeCanonicalShortAnswer(studentCanonical)
          : null;
        const normalizedCorrect = normalizeCanonicalShortAnswer(
          correctAnswer as string,
        );

        if (!normalizedCorrect) {
          throw new Error("Cannot grade a malformed short-answer key.");
        }

        const isCorrect =
          normalizedStudent !== null && normalizedStudent === normalizedCorrect;
        result = {
          isCorrect,
          scoreHundredths: isCorrect ? question.maxScoreHundredths : 0,
        };
      } else {
        throw new Error("Cannot grade an unsupported question type.");
      }

      questionsById[question.id] = result;
      sectionScore += result.scoreHundredths;
    }

    sectionScoresHundredths[section.id] = sectionScore;
  }

  const objectiveScoreHundredths = Object.values(
    sectionScoresHundredths,
  ).reduce((total, score) => total + score, 0);

  if (containsEssayImage) {
    return {
      answerKeyRevision,
      objectiveScoreHundredths,
      objectiveMaxScoreHundredths,
      sectionScoresHundredths,
      questionsById,
      manualEssayScores,
    };
  }

  return {
    answerKeyRevision,
    totalScoreHundredths: objectiveScoreHundredths,
    sectionScoresHundredths,
    questionsById,
  };
}

export function normalizeManualEssayScores(
  structure: ExamStructureSnapshot,
  scores: ManualEssayScore[],
  requireCompleteScores: boolean,
): ManualEssayScore[] {
  const essayQuestions = structure.sections.flatMap((section) =>
    section.questions.filter(
      (question) => question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
    ),
  );
  const essayQuestionById = new Map(
    essayQuestions.map((question) => [question.id, question] as const),
  );
  const scoreByQuestionId = new Map<string, number | null>();

  for (const score of scores) {
    const question = essayQuestionById.get(score.questionId);

    if (!question || scoreByQuestionId.has(score.questionId)) {
      throw new Error("Manual essay scores contain an invalid question ID.");
    }

    if (
      score.scoreHundredths !== null &&
      (!Number.isInteger(score.scoreHundredths) ||
        score.scoreHundredths < 0 ||
        score.scoreHundredths > question.maxScoreHundredths)
    ) {
      throw new Error("Manual essay score is outside the allowed range.");
    }

    scoreByQuestionId.set(score.questionId, score.scoreHundredths);
  }

  if (
    essayQuestions.length === 0 ||
    scoreByQuestionId.size !== essayQuestions.length
  ) {
    throw new Error("Manual essay scores must include every essay question.");
  }

  const normalizedScores = essayQuestions.map((question) => ({
    questionId: question.id,
    scoreHundredths: scoreByQuestionId.get(question.id) ?? null,
  }));

  if (
    requireCompleteScores &&
    normalizedScores.some((score) => score.scoreHundredths === null)
  ) {
    throw new Error(
      "Manual essay scores must be complete before finalization.",
    );
  }

  return normalizedScores;
}

export function getCanonicalManualEssayScores(
  grading: DynamicAttemptGradingSnapshot,
  structure: ExamStructureSnapshot,
): ManualEssayScore[] {
  const scores =
    grading.manualEssayScores ??
    structure.sections.flatMap((section) =>
      section.questions
        .filter(
          (question) =>
            question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        )
        .map((question) => ({
          questionId: question.id,
          scoreHundredths: null,
        })),
    );

  return normalizeManualEssayScores(
    structure,
    scores,
    hasFinalTotalScore(grading),
  );
}

export function applyManualEssayScores(
  objectiveGrading: DynamicAttemptGradingSnapshot,
  structure: ExamStructureSnapshot,
  scores: ManualEssayScore[],
  finalize: false,
): DynamicPendingManualAttemptGradingSnapshot;
export function applyManualEssayScores(
  objectiveGrading: DynamicAttemptGradingSnapshot,
  structure: ExamStructureSnapshot,
  scores: ManualEssayScore[],
  finalize: true,
): DynamicCompletedAttemptGradingSnapshot;
export function applyManualEssayScores(
  objectiveGrading: DynamicAttemptGradingSnapshot,
  structure: ExamStructureSnapshot,
  scores: ManualEssayScore[],
  finalize: boolean,
):
  | DynamicPendingManualAttemptGradingSnapshot
  | DynamicCompletedAttemptGradingSnapshot {
  if (
    hasFinalTotalScore(objectiveGrading) ||
    !("objectiveScoreHundredths" in objectiveGrading)
  ) {
    throw new Error("Manual essay grading requires objective grading data.");
  }

  const manualEssayScores = normalizeManualEssayScores(
    structure,
    scores,
    finalize,
  );

  if (!finalize) {
    return { ...objectiveGrading, manualEssayScores };
  }

  const sectionScoresHundredths = {
    ...objectiveGrading.sectionScoresHundredths,
  };
  let essayScoreHundredths = 0;

  for (const section of structure.sections) {
    for (const question of section.questions) {
      if (question.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
        continue;
      }

      const score = manualEssayScores.find(
        (manualScore) => manualScore.questionId === question.id,
      )?.scoreHundredths;

      if (score === null || score === undefined) {
        throw new Error(
          "Manual essay scores must be complete before finalization.",
        );
      }

      sectionScoresHundredths[section.id] =
        (sectionScoresHundredths[section.id] ?? 0) + score;
      essayScoreHundredths += score;
    }
  }

  const totalScoreHundredths =
    objectiveGrading.objectiveScoreHundredths + essayScoreHundredths;

  if (totalScoreHundredths > EXAM_SCORING_HUNDREDTHS.totalMaximum) {
    throw new Error("Final score exceeds the Exam maximum.");
  }

  return {
    answerKeyRevision: objectiveGrading.answerKeyRevision,
    totalScoreHundredths,
    sectionScoresHundredths,
    questionsById: objectiveGrading.questionsById,
    manualEssayScores,
  };
}

export function isDynamicAttemptGradingSnapshot(
  grading: ExamAttemptGradingSnapshot,
): grading is DynamicAttemptGradingSnapshot {
  return "questionsById" in grading;
}

export function hasFinalTotalScore(
  grading: ExamAttemptGradingSnapshot,
): grading is CompletedExamAttemptGradingSnapshot {
  return (
    "totalScoreHundredths" in grading &&
    typeof grading.totalScoreHundredths === "number"
  );
}

export function gradeExamAttemptAnswers(
  answers: ExamAttemptAnswers,
  answerKey: AnyExamAnswerKey,
  answerKeyRevision: number,
  structure?: ExamStructureSnapshot,
): ExamAttemptGradingSnapshot {
  if (structure) {
    if (
      !isDynamicAttemptAnswers(answers) ||
      !isDynamicExamAnswerKey(answerKey)
    ) {
      throw new Error("Cannot grade mismatched dynamic Exam data.");
    }

    return gradeDynamicAttemptAnswers(
      answers,
      answerKey,
      structure,
      answerKeyRevision,
    );
  }

  if (isDynamicAttemptAnswers(answers) || isDynamicExamAnswerKey(answerKey)) {
    throw new Error("Cannot grade mismatched legacy Exam data.");
  }

  return gradeAttemptAnswers(answers, answerKey, answerKeyRevision);
}

export function regradeExamAttemptAnswersPreservingManualScores(
  answers: ExamAttemptAnswers,
  answerKey: AnyExamAnswerKey,
  answerKeyRevision: number,
  structure: ExamStructureSnapshot | undefined,
  previousGrading: ExamAttemptGradingSnapshot | undefined,
  preserveCompletedManualGrading: boolean,
): ExamAttemptGradingSnapshot {
  const objectiveGrading = gradeExamAttemptAnswers(
    answers,
    answerKey,
    answerKeyRevision,
    structure,
  );

  if (
    !structure ||
    !isDynamicAttemptGradingSnapshot(objectiveGrading) ||
    !("objectiveScoreHundredths" in objectiveGrading)
  ) {
    return objectiveGrading;
  }

  const previousManualEssayScores =
    previousGrading && isDynamicAttemptGradingSnapshot(previousGrading)
      ? previousGrading.manualEssayScores
      : undefined;
  const manualEssayScores =
    previousManualEssayScores ?? objectiveGrading.manualEssayScores;

  if (!manualEssayScores) {
    return objectiveGrading;
  }

  return preserveCompletedManualGrading
    ? applyManualEssayScores(
        objectiveGrading,
        structure,
        manualEssayScores,
        true,
      )
    : applyManualEssayScores(
        objectiveGrading,
        structure,
        manualEssayScores,
        false,
      );
}
