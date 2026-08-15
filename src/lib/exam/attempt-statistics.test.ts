import { describe, expect, it } from "vitest";

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  calculatePerformanceStatistics,
  calculateScoreAggregate,
  getAttemptTimeUsedSeconds,
  toScoreStatistics,
  type ScoredAttempt,
} from "@/lib/exam/attempt-statistics";
import type { AttemptGradingSnapshot } from "@/types/exam-attempt";

function createGrading(score: number): AttemptGradingSnapshot {
  return {
    answerKeyRevision: 1,
    totalScoreHundredths: score,
    sectionScoresHundredths: {
      partOne: score,
      partTwo: 0,
      partThree: 0,
    },
    partOne: [],
    partTwo: [],
    partThree: [],
  };
}

function createAttempt(
  score: number,
  attemptNumber: number,
  submittedAt: string,
): ScoredAttempt {
  return {
    id: `attempt-${attemptNumber}`,
    attemptNumber,
    status: EXAM_ATTEMPT_STATUS.SUBMITTED,
    startedAt: new Date("2026-08-11T01:00:00.000Z"),
    expiresAt: new Date("2026-08-11T02:30:00.000Z"),
    submittedAt: new Date(submittedAt),
    grading: createGrading(score),
  };
}

describe("attempt statistics", () => {
  it("returns null score metrics for an empty completed set", () => {
    expect(calculatePerformanceStatistics([])).toEqual({
      completedAttemptCount: 0,
      average: null,
      highest: null,
      lowest: null,
      first: null,
      latest: null,
      best: null,
      improvement: null,
    });
  });

  it("keeps totals in integer hundredths and does not drop zero scores", () => {
    const attempts = [
      createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
      createAttempt(333, 2, "2026-08-02T00:00:00.000Z"),
      createAttempt(1000, 3, "2026-08-03T00:00:00.000Z"),
    ];
    const aggregate = calculateScoreAggregate(attempts);

    expect(aggregate).toEqual({
      count: 3,
      total: 1333,
      highest: 1000,
      lowest: 0,
    });
    expect(toScoreStatistics(aggregate)).toEqual({
      average: 13.33 / 3,
      highest: 10,
      lowest: 0,
    });
  });

  it("uses chronological first and latest scores and allows regression", () => {
    const statistics = calculatePerformanceStatistics([
      createAttempt(500, 2, "2026-08-03T00:00:00.000Z"),
      createAttempt(800, 1, "2026-08-01T00:00:00.000Z"),
      createAttempt(700, 3, "2026-08-02T00:00:00.000Z"),
    ]);

    expect(statistics).toMatchObject({
      completedAttemptCount: 3,
      first: 8,
      latest: 5,
      best: 8,
      improvement: -3,
      highest: 8,
      lowest: 5,
    });
    expect(statistics.average).toBeCloseTo(20 / 3);
  });

  it("uses expiration for auto-submit duration and submission for manual duration", () => {
    const attempt = createAttempt(500, 1, "2026-08-11T01:30:00.000Z");

    expect(getAttemptTimeUsedSeconds(attempt)).toBe(30 * 60);
    expect(
      getAttemptTimeUsedSeconds({
        ...attempt,
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      }),
    ).toBe(90 * 60);
  });
});
