import { describe, expect, it } from "vitest";

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  calculatePerformanceStatistics,
  calculateQuestionStatistics,
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

function createQuestionGrading({
  partOneCorrect = [],
  partTwo = [],
  partThreeCorrect = [],
}: {
  partOneCorrect?: number[];
  partTwo?: AttemptGradingSnapshot["partTwo"];
  partThreeCorrect?: number[];
} = {}): AttemptGradingSnapshot {
  return {
    answerKeyRevision: 1,
    totalScoreHundredths: 0,
    sectionScoresHundredths: {
      partOne: 0,
      partTwo: 0,
      partThree: 0,
    },
    partOne: Array.from({ length: 12 }, (_, questionIndex) => ({
      isCorrect: partOneCorrect.includes(questionIndex),
    })),
    partTwo: Array.from(
      { length: 4 },
      (_, questionIndex) =>
        partTwo[questionIndex] ?? {
          correctStatementCount: 0,
          scoreHundredths: 0,
          statements: { a: false, b: false, c: false, d: false },
        },
    ),
    partThree: Array.from({ length: 6 }, (_, questionIndex) => ({
      isCorrect: partThreeCorrect.includes(questionIndex),
    })),
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

  it("aggregates Part I and Part III correct and incorrect attempts", () => {
    const attempts = [
      {
        ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
        grading: createQuestionGrading({
          partOneCorrect: [0, 1],
          partThreeCorrect: [0],
        }),
      },
      {
        ...createAttempt(0, 2, "2026-08-02T00:00:00.000Z"),
        grading: createQuestionGrading({
          partOneCorrect: [0],
          partThreeCorrect: [],
        }),
      },
    ];

    const statistics = calculateQuestionStatistics(attempts);

    expect(statistics.partOne[0]).toEqual({
      questionNumber: 1,
      completedAttemptCount: 2,
      correctCount: 2,
      incorrectCount: 0,
      correctRatePercent: 100,
    });
    expect(statistics.partOne[1]).toEqual({
      questionNumber: 2,
      completedAttemptCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      correctRatePercent: 50,
    });
    expect(statistics.partThree[0]).toEqual({
      questionNumber: 1,
      completedAttemptCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      correctRatePercent: 50,
    });
    expect(statistics.partOne.map((item) => item.questionNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(statistics.partThree.map((item) => item.questionNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("uses Part II snapshot correctness and score hundredths", () => {
    const partTwoResults: AttemptGradingSnapshot["partTwo"][number][] = [
      {
        correctStatementCount: 4,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: true },
      },
      {
        correctStatementCount: 3,
        scoreHundredths: 50,
        statements: { a: true, b: true, c: true, d: false },
      },
      {
        correctStatementCount: 2,
        scoreHundredths: 25,
        statements: { a: true, b: true, c: false, d: false },
      },
      {
        correctStatementCount: 1,
        scoreHundredths: 10,
        statements: { a: true, b: false, c: false, d: false },
      },
    ];
    const attempts = partTwoResults.map((partTwoResult, index) => ({
      ...createAttempt(0, index + 1, `2026-08-0${index + 1}T00:00:00.000Z`),
      grading: createQuestionGrading({ partTwo: [partTwoResult] }),
    }));

    const question = calculateQuestionStatistics(attempts).partTwo[0];

    expect(question).toEqual({
      questionNumber: 1,
      completedAttemptCount: 4,
      fullCorrectCount: 1,
      fullCorrectRatePercent: 25,
      averageScoreHundredths: 46.25,
      statements: {
        a: { correctCount: 4, correctRatePercent: 100 },
        b: { correctCount: 3, correctRatePercent: 75 },
        c: { correctCount: 2, correctRatePercent: 50 },
        d: { correctCount: 1, correctRatePercent: 25 },
      },
    });
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
