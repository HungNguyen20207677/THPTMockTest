import { EXAM_STRUCTURE, PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { scoreHundredthsToPoints } from "@/lib/exam/grading";
import type {
  AttemptGradingSnapshot,
  ExamAttemptStatus,
} from "@/types/exam-attempt";
import type { ExamQuestionTopicIds } from "@/types/exam";
import type {
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
  grading: AttemptGradingSnapshot;
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
  let total = 0;
  let highest: number | null = null;
  let lowest: number | null = null;

  for (const attempt of attempts) {
    const score = attempt.grading.totalScoreHundredths;
    total += score;
    highest = highest === null ? score : Math.max(highest, score);
    lowest = lowest === null ? score : Math.min(lowest, score);
  }

  return { count: attempts.length, total, highest, lowest };
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
  const aggregate = calculateScoreAggregate(attempts);

  if (attempts.length === 0) {
    return {
      completedAttemptCount: 0,
      first: null,
      latest: null,
      best: null,
      improvement: null,
      ...toScoreStatistics(aggregate),
    };
  }

  const chronologicalAttempts = [...attempts].sort((left, right) => {
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

interface TopicPerformanceAggregate {
  taggedQuestionCount: number;
  observationCount: number;
  totalPerformancePercent: number;
}

function accumulateTopicPerformance(
  aggregateByTopicId: Map<string, TopicPerformanceAggregate>,
  questionTopicIds: ExamQuestionTopicIds,
  attempts: ScoredAttempt[],
): void {
  const questions: Array<{
    topicIds: string[];
    getPerformance: (grading: AttemptGradingSnapshot) => number;
  }> = [
    ...questionTopicIds.partOne.map((topicIds, questionIndex) => ({
      topicIds: [...new Set(topicIds)],
      getPerformance: (grading: AttemptGradingSnapshot) =>
        grading.partOne[questionIndex].isCorrect ? 100 : 0,
    })),
    ...questionTopicIds.partTwo.map((topicIds, questionIndex) => ({
      topicIds: [...new Set(topicIds)],
      getPerformance: (grading: AttemptGradingSnapshot) =>
        grading.partTwo[questionIndex].scoreHundredths,
    })),
    ...questionTopicIds.partThree.map((topicIds, questionIndex) => ({
      topicIds: [...new Set(topicIds)],
      getPerformance: (grading: AttemptGradingSnapshot) =>
        grading.partThree[questionIndex].isCorrect ? 100 : 0,
    })),
  ];

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

      const performance = question.getPerformance(attempt.grading);

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
  questionTopicIds: ExamQuestionTopicIds,
  attempts: ScoredAttempt[],
  topics: Array<{ id: string; name: string }>,
): AdminExamTopicStatistics[] {
  const aggregateByTopicId = new Map<string, TopicPerformanceAggregate>();
  accumulateTopicPerformance(aggregateByTopicId, questionTopicIds, attempts);

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
    attempts: ScoredAttempt[];
  }>,
  topics: Array<{ id: string; name: string }>,
): AdminStudentTopicStatistics[] {
  const aggregateByTopicId = new Map<string, TopicPerformanceAggregate>();

  for (const exam of exams) {
    accumulateTopicPerformance(
      aggregateByTopicId,
      exam.questionTopicIds,
      exam.attempts,
    );
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
