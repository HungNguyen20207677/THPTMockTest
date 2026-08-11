import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { scoreHundredthsToPoints } from "@/lib/exam/grading";
import type {
  AttemptGradingSnapshot,
  ExamAttemptStatus,
} from "@/types/exam-attempt";
import type { PerformanceStatistics, ScoreStatistics } from "@/types/reporting";

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
