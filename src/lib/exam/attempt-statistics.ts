import { EXAM_STRUCTURE, PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  isDynamicAttemptGradingSnapshot,
  hasFinalTotalScore,
  scoreHundredthsToPoints,
} from "@/lib/exam/grading";
import {
  getExamQuestionTopicAssignments,
  type ExamQuestionTopicsSource,
} from "@/lib/exam/question-topics";
import type {
  CompletedExamAttemptGradingSnapshot,
  DynamicAttemptGradingSnapshot,
  ExamAttemptGradingStatus,
  ExamAttemptGradingSnapshot,
  ExamAttemptStatus,
} from "@/types/exam-attempt";
import type { ExamQuestionTopicIds } from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
import type {
  AdminExamDynamicQuestionStatistics,
  AdminExamDynamicQuestionStatisticsItem,
  AdminExamQuestionStatistics,
  AdminExamTopicStatistics,
  AdminStudentTopicStatistics,
  PerformanceStatistics,
  ScoreStatistics,
} from "@/types/reporting";

export interface ScoredAttempt {
  id: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date;
  grading: ExamAttemptGradingSnapshot;
  gradingStatus?: ExamAttemptGradingStatus;
}

interface FinalScoredAttempt extends ScoredAttempt {
  grading: CompletedExamAttemptGradingSnapshot;
}

function isFinalScoredAttempt(
  attempt: ScoredAttempt,
): attempt is FinalScoredAttempt {
  return (
    (attempt.gradingStatus ?? EXAM_ATTEMPT_GRADING_STATUS.COMPLETED) ===
      EXAM_ATTEMPT_GRADING_STATUS.COMPLETED &&
    hasFinalTotalScore(attempt.grading)
  );
}

export interface ScoreAggregateHundredths {
  count: number;
  total: number;
  highest: number | null;
  lowest: number | null;
}

export function calculateScoreAggregate(
  attempts: ScoredAttempt[],
): ScoreAggregateHundredths {
  const finalAttempts = attempts.filter(isFinalScoredAttempt);
  let total = 0;
  let highest: number | null = null;
  let lowest: number | null = null;

  for (const attempt of finalAttempts) {
    const score = attempt.grading.totalScoreHundredths;
    total += score;
    highest = highest === null ? score : Math.max(highest, score);
    lowest = lowest === null ? score : Math.min(lowest, score);
  }

  return { count: finalAttempts.length, total, highest, lowest };
}

export function toScoreStatistics(
  aggregate: ScoreAggregateHundredths,
): ScoreStatistics {
  return {
    average:
      aggregate.count === 0
        ? null
        : scoreHundredthsToPoints(aggregate.total) / aggregate.count,
    highest:
      aggregate.highest === null
        ? null
        : scoreHundredthsToPoints(aggregate.highest),
    lowest:
      aggregate.lowest === null
        ? null
        : scoreHundredthsToPoints(aggregate.lowest),
  };
}

export function calculatePerformanceStatistics(
  attempts: ScoredAttempt[],
): PerformanceStatistics {
  const finalAttempts = attempts.filter(isFinalScoredAttempt);
  const aggregate = calculateScoreAggregate(attempts);

  if (finalAttempts.length === 0) {
    return {
      completedAttemptCount: attempts.length,
      first: null,
      latest: null,
      best: null,
      improvement: null,
      ...toScoreStatistics(aggregate),
    };
  }

  const chronologicalAttempts = [...finalAttempts].sort((left, right) => {
    const submittedDifference =
      left.submittedAt.getTime() - right.submittedAt.getTime();

    return submittedDifference !== 0
      ? submittedDifference
      : left.attemptNumber - right.attemptNumber;
  });
  const firstHundredths = chronologicalAttempts[0].grading.totalScoreHundredths;
  const latestHundredths =
    chronologicalAttempts[chronologicalAttempts.length - 1].grading
      .totalScoreHundredths;

  return {
    completedAttemptCount: attempts.length,
    first: scoreHundredthsToPoints(firstHundredths),
    latest: scoreHundredthsToPoints(latestHundredths),
    best:
      aggregate.highest === null
        ? null
        : scoreHundredthsToPoints(aggregate.highest),
    improvement: scoreHundredthsToPoints(latestHundredths - firstHundredths),
    ...toScoreStatistics(aggregate),
  };
}

export function calculateQuestionStatistics(
  attempts: ScoredAttempt[],
): AdminExamQuestionStatistics {
  if (
    attempts.some((attempt) => isDynamicAttemptGradingSnapshot(attempt.grading))
  ) {
    return { partOne: [], partTwo: [], partThree: [] };
  }

  const completedAttemptCount = attempts.length;
  const correctRatePercent = (correctCount: number): number | null =>
    completedAttemptCount === 0
      ? null
      : (correctCount * 100) / completedAttemptCount;
  const partOneCorrectCounts = Array<number>(
    EXAM_STRUCTURE.partOneQuestions,
  ).fill(0);
  const partTwoFullCorrectCounts = Array<number>(
    EXAM_STRUCTURE.partTwoQuestions,
  ).fill(0);
  const partTwoScoreTotals = Array<number>(
    EXAM_STRUCTURE.partTwoQuestions,
  ).fill(0);
  const partTwoStatementCorrectCounts = Array.from(
    { length: EXAM_STRUCTURE.partTwoQuestions },
    () => ({ a: 0, b: 0, c: 0, d: 0 }),
  );
  const partThreeCorrectCounts = Array<number>(
    EXAM_STRUCTURE.partThreeQuestions,
  ).fill(0);

  for (const attempt of attempts) {
    if (isDynamicAttemptGradingSnapshot(attempt.grading)) {
      continue;
    }

    attempt.grading.partOne.forEach((question, questionIndex) => {
      if (question.isCorrect) {
        partOneCorrectCounts[questionIndex] += 1;
      }
    });
    attempt.grading.partTwo.forEach((question, questionIndex) => {
      if (
        question.correctStatementCount ===
        EXAM_STRUCTURE.partTwoStatementsPerQuestion
      ) {
        partTwoFullCorrectCounts[questionIndex] += 1;
      }

      partTwoScoreTotals[questionIndex] += question.scoreHundredths;
      for (const statement of PART_TWO_STATEMENTS) {
        if (question.statements[statement]) {
          partTwoStatementCorrectCounts[questionIndex][statement] += 1;
        }
      }
    });
    attempt.grading.partThree.forEach((question, questionIndex) => {
      if (question.isCorrect) {
        partThreeCorrectCounts[questionIndex] += 1;
      }
    });
  }

  return {
    partOne: partOneCorrectCounts.map((correctCount, questionIndex) => ({
      questionNumber: questionIndex + 1,
      completedAttemptCount,
      correctCount,
      incorrectCount: completedAttemptCount - correctCount,
      correctRatePercent: correctRatePercent(correctCount),
    })),
    partTwo: partTwoFullCorrectCounts.map((fullCorrectCount, questionIndex) => {
      const statementCounts = partTwoStatementCorrectCounts[questionIndex];

      return {
        questionNumber: questionIndex + 1,
        completedAttemptCount,
        fullCorrectCount,
        fullCorrectRatePercent: correctRatePercent(fullCorrectCount),
        averageScoreHundredths:
          completedAttemptCount === 0
            ? null
            : partTwoScoreTotals[questionIndex] / completedAttemptCount,
        statements: {
          a: {
            correctCount: statementCounts.a,
            correctRatePercent: correctRatePercent(statementCounts.a),
          },
          b: {
            correctCount: statementCounts.b,
            correctRatePercent: correctRatePercent(statementCounts.b),
          },
          c: {
            correctCount: statementCounts.c,
            correctRatePercent: correctRatePercent(statementCounts.c),
          },
          d: {
            correctCount: statementCounts.d,
            correctRatePercent: correctRatePercent(statementCounts.d),
          },
        },
      };
    }),
    partThree: partThreeCorrectCounts.map((correctCount, questionIndex) => ({
      questionNumber: questionIndex + 1,
      completedAttemptCount,
      correctCount,
      incorrectCount: completedAttemptCount - correctCount,
      correctRatePercent: correctRatePercent(correctCount),
    })),
  };
}

export function calculateDynamicQuestionStatistics(
  structure: ExamStructureSnapshot,
  attempts: ScoredAttempt[],
): AdminExamDynamicQuestionStatistics {
  const completedAttempts = attempts.filter(
    (attempt) =>
      (attempt.status === EXAM_ATTEMPT_STATUS.SUBMITTED ||
        attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED) &&
      isDynamicAttemptGradingSnapshot(attempt.grading),
  );
  const completedAttemptCount = completedAttempts.length;
  const toRate = (correctCount: number): number | null =>
    completedAttemptCount === 0
      ? null
      : (correctCount * 100) / completedAttemptCount;

  return {
    sections: structure.sections.map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      questions:
        section.questions.flatMap<AdminExamDynamicQuestionStatisticsItem>(
          (question, questionIndex) => {
            if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE) {
              return [];
            }

            const results = completedAttempts.map(
              (attempt) =>
                (attempt.grading as DynamicAttemptGradingSnapshot)
                  .questionsById[question.id],
            );
            const identity = {
              sectionId: section.id,
              sectionTitle: section.title,
              questionId: question.id,
              questionNumber: questionIndex + 1,
              questionType: question.type,
            };

            if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
              const trueFalseResults = results.filter(
                (result) => result && "correctStatementCount" in result,
              );
              const fullCorrectCount = trueFalseResults.filter(
                (result) => result.correctStatementCount === 4,
              ).length;
              const statementCorrectCounts = { a: 0, b: 0, c: 0, d: 0 };
              let totalScoreHundredths = 0;

              for (const result of trueFalseResults) {
                totalScoreHundredths += result.scoreHundredths;
                for (const statement of PART_TWO_STATEMENTS) {
                  if (result.statements[statement]) {
                    statementCorrectCounts[statement] += 1;
                  }
                }
              }

              return [
                {
                  ...identity,
                  completedAttemptCount,
                  fullCorrectCount,
                  fullCorrectRatePercent: toRate(fullCorrectCount),
                  averageScoreHundredths:
                    completedAttemptCount === 0
                      ? null
                      : totalScoreHundredths / completedAttemptCount,
                  statements: Object.fromEntries(
                    PART_TWO_STATEMENTS.map((statement) => [
                      statement,
                      {
                        correctCount: statementCorrectCounts[statement],
                        correctRatePercent: toRate(
                          statementCorrectCounts[statement],
                        ),
                      },
                    ]),
                  ) as {
                    a: {
                      correctCount: number;
                      correctRatePercent: number | null;
                    };
                    b: {
                      correctCount: number;
                      correctRatePercent: number | null;
                    };
                    c: {
                      correctCount: number;
                      correctRatePercent: number | null;
                    };
                    d: {
                      correctCount: number;
                      correctRatePercent: number | null;
                    };
                  },
                },
              ];
            }

            const correctCount = results.filter(
              (result) => result && "isCorrect" in result && result.isCorrect,
            ).length;
            return [
              {
                ...identity,
                completedAttemptCount,
                correctCount,
                incorrectCount: completedAttemptCount - correctCount,
                correctRatePercent: toRate(correctCount),
              },
            ];
          },
        ),
    })),
  };
}

interface TopicPerformanceAggregate {
  taggedQuestionCount: number;
  observationCount: number;
  totalPerformancePercent: number;
}

function accumulateTopicPerformance(
  aggregateByTopicId: Map<string, TopicPerformanceAggregate>,
  source: ExamQuestionTopicIds | ExamQuestionTopicsSource,
  attempts: ScoredAttempt[],
): void {
  const normalizedSource: ExamQuestionTopicsSource =
    "partOne" in source ? { questionTopicIds: source } : source;
  const questions = getExamQuestionTopicAssignments(normalizedSource);

  for (const question of questions) {
    for (const topicId of question.topicIds) {
      const aggregate = aggregateByTopicId.get(topicId) ?? {
        taggedQuestionCount: 0,
        observationCount: 0,
        totalPerformancePercent: 0,
      };
      aggregate.taggedQuestionCount += 1;
      aggregateByTopicId.set(topicId, aggregate);
    }
  }

  for (const attempt of attempts) {
    if (
      attempt.status !== EXAM_ATTEMPT_STATUS.SUBMITTED &&
      attempt.status !== EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
    ) {
      continue;
    }

    for (const question of questions) {
      if (question.topicIds.length === 0) {
        continue;
      }

      let performance: number;

      if (isDynamicAttemptGradingSnapshot(attempt.grading)) {
        if (!normalizedSource.structureSnapshot) {
          continue;
        }

        const result = attempt.grading.questionsById[question.questionId];
        if (!result) {
          continue;
        }
        performance =
          (result.scoreHundredths * 100) / question.maxScoreHundredths;
      } else {
        if (normalizedSource.structureSnapshot) {
          continue;
        }

        const questionIndex = question.questionNumber - 1;
        performance =
          question.questionType === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE
            ? attempt.grading.partOne[questionIndex].isCorrect
              ? 100
              : 0
            : question.questionType === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE
              ? attempt.grading.partTwo[questionIndex].scoreHundredths
              : attempt.grading.partThree[questionIndex].isCorrect
                ? 100
                : 0;
      }

      for (const topicId of question.topicIds) {
        const aggregate = aggregateByTopicId.get(topicId);

        if (aggregate) {
          aggregate.observationCount += 1;
          aggregate.totalPerformancePercent += performance;
        }
      }
    }
  }
}

export function calculateTopicStatistics(
  source: ExamQuestionTopicIds | ExamQuestionTopicsSource,
  attempts: ScoredAttempt[],
  topics: Array<{ id: string; name: string }>,
): AdminExamTopicStatistics[] {
  const aggregateByTopicId = new Map<string, TopicPerformanceAggregate>();
  accumulateTopicPerformance(aggregateByTopicId, source, attempts);

  const topicNameById = new Map(
    topics.map((topic) => [topic.id, topic.name] as const),
  );
  const statistics: AdminExamTopicStatistics[] = [];

  for (const [topicId, aggregate] of aggregateByTopicId) {
    const topicName = topicNameById.get(topicId);

    if (topicName === undefined) {
      continue;
    }

    statistics.push({
      topicId,
      topicName,
      taggedQuestionCount: aggregate.taggedQuestionCount,
      observationCount: aggregate.observationCount,
      averagePerformancePercent:
        aggregate.observationCount === 0
          ? null
          : aggregate.totalPerformancePercent / aggregate.observationCount,
    });
  }

  statistics.sort(
    (left, right) =>
      right.taggedQuestionCount - left.taggedQuestionCount ||
      left.topicName.localeCompare(right.topicName, "vi") ||
      left.topicId.localeCompare(right.topicId),
  );
  return statistics;
}

export function calculateStudentTopicStatistics(
  exams: Array<{
    questionTopicIds: ExamQuestionTopicIds;
    questionTopics?: ExamQuestionTopicsSource["questionTopics"];
    structureSnapshot?: ExamStructureSnapshot;
    attempts: ScoredAttempt[];
  }>,
  topics: Array<{ id: string; name: string }>,
): AdminStudentTopicStatistics[] {
  const aggregateByTopicId = new Map<string, TopicPerformanceAggregate>();

  for (const exam of exams) {
    accumulateTopicPerformance(aggregateByTopicId, exam, exam.attempts);
  }

  const topicNameById = new Map(
    topics.map((topic) => [topic.id, topic.name] as const),
  );
  const statistics: AdminStudentTopicStatistics[] = [];

  for (const [topicId, aggregate] of aggregateByTopicId) {
    const topicName = topicNameById.get(topicId);

    if (topicName === undefined || aggregate.observationCount === 0) {
      continue;
    }

    statistics.push({
      topicId,
      topicName,
      observationCount: aggregate.observationCount,
      averagePerformancePercent:
        aggregate.totalPerformancePercent / aggregate.observationCount,
    });
  }

  statistics.sort(
    (left, right) =>
      right.observationCount - left.observationCount ||
      left.topicName.localeCompare(right.topicName, "vi") ||
      left.topicId.localeCompare(right.topicId),
  );
  return statistics;
}

export function getAttemptTimeUsedSeconds(attempt: {
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date;
}): number {
  const endedAt =
    attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
      ? attempt.expiresAt
      : attempt.submittedAt;

  return Math.max(
    0,
    Math.round((endedAt.getTime() - attempt.startedAt.getTime()) / 1000),
  );
}
