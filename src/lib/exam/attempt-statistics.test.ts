import { describe, expect, it } from "vitest";

import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  calculateDynamicQuestionStatistics,
  calculatePerformanceStatistics,
  calculateQuestionStatistics,
  calculateScoreAggregate,
  calculateStudentTopicStatistics,
  calculateTopicStatistics,
  getAttemptTimeUsedSeconds,
  toScoreStatistics,
  type ScoredAttempt,
} from "@/lib/exam/attempt-statistics";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";
import type {
  AttemptGradingSnapshot,
  DynamicAttemptGradingSnapshot,
} from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

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

function createDynamicAttempt(
  attemptNumber: number,
  questionsById: DynamicAttemptGradingSnapshot["questionsById"],
  status: ScoredAttempt["status"] = EXAM_ATTEMPT_STATUS.SUBMITTED,
): ScoredAttempt {
  return {
    ...createAttempt(
      0,
      attemptNumber,
      `2026-08-${String(attemptNumber).padStart(2, "0")}T00:00:00.000Z`,
    ),
    status,
    grading: {
      answerKeyRevision: 1,
      totalScoreHundredths: 0,
      sectionScoresHundredths: {},
      questionsById,
    },
  };
}

const pendingEssayStructure: ExamStructureSnapshot = {
  sections: [
    {
      id: "pending-section",
      title: "Pending section",
      questions: [
        {
          id: "essay-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          maxScoreHundredths: 500,
        },
        {
          id: "choice-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 100,
        },
        {
          id: "short-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
          maxScoreHundredths: 100,
        },
        {
          id: "true-false-question",
          type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
          maxScoreHundredths: 200,
        },
      ],
    },
  ],
};

function createPendingDynamicAttempt(
  attemptNumber: number,
  questionsById: DynamicAttemptGradingSnapshot["questionsById"],
  status: ScoredAttempt["status"] = EXAM_ATTEMPT_STATUS.SUBMITTED,
): ScoredAttempt {
  const objectiveScoreHundredths = Object.values(questionsById).reduce(
    (total, question) => total + question.scoreHundredths,
    0,
  );

  return {
    ...createDynamicAttempt(attemptNumber, questionsById, status),
    gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
    grading: {
      answerKeyRevision: 1,
      objectiveScoreHundredths,
      objectiveMaxScoreHundredths: 400,
      sectionScoresHundredths: {
        "pending-section": objectiveScoreHundredths,
      },
      questionsById,
    },
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

  it("excludes pending manual attempts from final scores without dropping terminal counts", () => {
    const completedAttempt = createAttempt(800, 1, "2026-08-01T00:00:00.000Z");
    const pendingAttempt = createPendingDynamicAttempt(
      2,
      {},
      EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    );

    expect(
      calculatePerformanceStatistics([completedAttempt, pendingAttempt]),
    ).toEqual({
      completedAttemptCount: 2,
      average: 8,
      highest: 8,
      lowest: 8,
      first: 8,
      latest: 8,
      best: 8,
      improvement: 0,
    });
    expect(calculateScoreAggregate([completedAttempt, pendingAttempt])).toEqual(
      {
        count: 1,
        total: 800,
        highest: 800,
        lowest: 800,
      },
    );
    expect(calculatePerformanceStatistics([pendingAttempt])).toEqual({
      completedAttemptCount: 1,
      average: null,
      highest: null,
      lowest: null,
      first: null,
      latest: null,
      best: null,
      improvement: null,
    });
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

  it("aggregates a variable dynamic structure in snapshot order and excludes active retakes", () => {
    const structure: ExamStructureSnapshot = {
      sections: [
        {
          id: "mixed-section",
          title: "Mixed section",
          questions: [
            {
              id: "short-answer",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
              maxScoreHundredths: 100,
            },
            {
              id: "single-choice",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScoreHundredths: 100,
            },
          ],
        },
        {
          id: "true-false-section",
          title: "True/false section",
          questions: [
            {
              id: "true-false",
              type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              maxScoreHundredths: 200,
            },
          ],
        },
      ],
    };
    const submittedAttempt = createDynamicAttempt(1, {
      "true-false": {
        correctStatementCount: 4,
        scoreHundredths: 200,
        statements: { a: true, b: true, c: true, d: true },
      },
      "single-choice": { isCorrect: true, scoreHundredths: 100 },
      "short-answer": { isCorrect: false, scoreHundredths: 0 },
    });
    const autoSubmittedRetake = createDynamicAttempt(
      2,
      {
        "single-choice": { isCorrect: false, scoreHundredths: 0 },
        "short-answer": { isCorrect: true, scoreHundredths: 100 },
        "true-false": {
          correctStatementCount: 2,
          scoreHundredths: 50,
          statements: { a: true, b: false, c: true, d: false },
        },
      },
      EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    );
    const activeRetake = createDynamicAttempt(
      3,
      {
        "short-answer": { isCorrect: true, scoreHundredths: 100 },
        "single-choice": { isCorrect: true, scoreHundredths: 100 },
        "true-false": {
          correctStatementCount: 4,
          scoreHundredths: 200,
          statements: { a: true, b: true, c: true, d: true },
        },
      },
      EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    );

    expect(
      calculateDynamicQuestionStatistics(structure, [
        submittedAttempt,
        autoSubmittedRetake,
        activeRetake,
      ]),
    ).toEqual({
      sections: [
        {
          sectionId: "mixed-section",
          sectionTitle: "Mixed section",
          questions: [
            {
              sectionId: "mixed-section",
              sectionTitle: "Mixed section",
              questionId: "short-answer",
              questionNumber: 1,
              questionType: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
              completedAttemptCount: 2,
              correctCount: 1,
              incorrectCount: 1,
              correctRatePercent: 50,
            },
            {
              sectionId: "mixed-section",
              sectionTitle: "Mixed section",
              questionId: "single-choice",
              questionNumber: 2,
              questionType: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              completedAttemptCount: 2,
              correctCount: 1,
              incorrectCount: 1,
              correctRatePercent: 50,
            },
          ],
        },
        {
          sectionId: "true-false-section",
          sectionTitle: "True/false section",
          questions: [
            {
              sectionId: "true-false-section",
              sectionTitle: "True/false section",
              questionId: "true-false",
              questionNumber: 1,
              questionType: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              completedAttemptCount: 2,
              fullCorrectCount: 1,
              fullCorrectRatePercent: 50,
              averageScoreHundredths: 125,
              statements: {
                a: { correctCount: 2, correctRatePercent: 100 },
                b: { correctCount: 1, correctRatePercent: 50 },
                c: { correctCount: 2, correctRatePercent: 100 },
                d: { correctCount: 1, correctRatePercent: 50 },
              },
            },
          ],
        },
      ],
    });
  });

  it("aggregates pending objective grading and omits ESSAY_IMAGE question analytics", () => {
    const submittedAttempt = createPendingDynamicAttempt(1, {
      "choice-question": { isCorrect: true, scoreHundredths: 100 },
      "short-question": { isCorrect: false, scoreHundredths: 0 },
      "true-false-question": {
        correctStatementCount: 2,
        scoreHundredths: 50,
        statements: { a: true, b: false, c: true, d: false },
      },
    });
    const autoSubmittedAttempt = createPendingDynamicAttempt(
      2,
      {
        "choice-question": { isCorrect: false, scoreHundredths: 0 },
        "short-question": { isCorrect: true, scoreHundredths: 100 },
        "true-false-question": {
          correctStatementCount: 4,
          scoreHundredths: 200,
          statements: { a: true, b: true, c: true, d: true },
        },
      },
      EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    );

    const statistics = calculateDynamicQuestionStatistics(
      pendingEssayStructure,
      [submittedAttempt, autoSubmittedAttempt],
    );

    expect(
      statistics.sections[0].questions.map((question) => ({
        questionId: question.questionId,
        questionNumber: question.questionNumber,
        completedAttemptCount: question.completedAttemptCount,
      })),
    ).toEqual([
      {
        questionId: "choice-question",
        questionNumber: 2,
        completedAttemptCount: 2,
      },
      {
        questionId: "short-question",
        questionNumber: 3,
        completedAttemptCount: 2,
      },
      {
        questionId: "true-false-question",
        questionNumber: 4,
        completedAttemptCount: 2,
      },
    ]);
    expect(statistics.sections[0].questions[0]).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      correctRatePercent: 50,
    });
    expect(statistics.sections[0].questions[1]).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      correctRatePercent: 50,
    });
    expect(statistics.sections[0].questions[2]).toMatchObject({
      fullCorrectCount: 1,
      fullCorrectRatePercent: 50,
      averageScoreHundredths: 125,
      statements: {
        a: { correctCount: 2, correctRatePercent: 100 },
        b: { correctCount: 1, correctRatePercent: 50 },
        c: { correctCount: 2, correctRatePercent: 100 },
        d: { correctCount: 1, correctRatePercent: 50 },
      },
    });
    expect(JSON.stringify(statistics)).not.toContain("essay-question");
  });

  it("returns null dynamic rates when there are no completed attempts", () => {
    const structure: ExamStructureSnapshot = {
      sections: [
        {
          id: "empty-section",
          title: "Empty section",
          questions: [
            {
              id: "empty-choice",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScoreHundredths: 100,
            },
            {
              id: "empty-true-false",
              type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              maxScoreHundredths: 100,
            },
          ],
        },
      ],
    };

    expect(calculateDynamicQuestionStatistics(structure, [])).toEqual({
      sections: [
        {
          sectionId: "empty-section",
          sectionTitle: "Empty section",
          questions: [
            {
              sectionId: "empty-section",
              sectionTitle: "Empty section",
              questionId: "empty-choice",
              questionNumber: 1,
              questionType: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              completedAttemptCount: 0,
              correctCount: 0,
              incorrectCount: 0,
              correctRatePercent: null,
            },
            {
              sectionId: "empty-section",
              sectionTitle: "Empty section",
              questionId: "empty-true-false",
              questionNumber: 2,
              questionType: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              completedAttemptCount: 0,
              fullCorrectCount: 0,
              fullCorrectRatePercent: null,
              averageScoreHundredths: null,
              statements: {
                a: { correctCount: 0, correctRatePercent: null },
                b: { correctCount: 0, correctRatePercent: null },
                c: { correctCount: 0, correctRatePercent: null },
                d: { correctCount: 0, correctRatePercent: null },
              },
            },
          ],
        },
      ],
    });
  });

  it("normalizes Part I and Part III correctness to 0 or 100 percent", () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["part-one-topic"];
    questionTopicIds.partThree[0] = ["part-three-topic"];
    const attempts = [
      {
        ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
        grading: createQuestionGrading({
          partOneCorrect: [0],
          partThreeCorrect: [],
        }),
      },
      {
        ...createAttempt(0, 2, "2026-08-02T00:00:00.000Z"),
        grading: createQuestionGrading({
          partOneCorrect: [],
          partThreeCorrect: [0],
        }),
      },
    ];

    expect(
      calculateTopicStatistics(questionTopicIds, attempts, [
        { id: "part-one-topic", name: "Part I" },
        { id: "part-three-topic", name: "Part III" },
      ]),
    ).toEqual([
      {
        topicId: "part-one-topic",
        topicName: "Part I",
        taggedQuestionCount: 1,
        observationCount: 2,
        averagePerformancePercent: 50,
      },
      {
        topicId: "part-three-topic",
        topicName: "Part III",
        taggedQuestionCount: 1,
        observationCount: 2,
        averagePerformancePercent: 50,
      },
    ]);
  });

  it("uses the persisted Part II partial score as its normalized percentage", () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partTwo[0] = ["partial-topic"];
    const attempt = {
      ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
      grading: createQuestionGrading({
        partTwo: [
          {
            correctStatementCount: 2,
            scoreHundredths: 25,
            statements: { a: true, b: true, c: false, d: false },
          },
        ],
      }),
    };

    expect(
      calculateTopicStatistics(
        questionTopicIds,
        [attempt],
        [{ id: "partial-topic", name: "Partial" }],
      ),
    ).toEqual([
      {
        topicId: "partial-topic",
        topicName: "Partial",
        taggedQuestionCount: 1,
        observationCount: 1,
        averagePerformancePercent: 25,
      },
    ]);
  });

  it("fully credits multi-topic questions and counts terminal retakes separately", () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["broad-topic"];
    questionTopicIds.partOne[1] = ["broad-topic", "shared-topic"];
    const submittedAttempt = {
      ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
      grading: createQuestionGrading({ partOneCorrect: [0] }),
    };
    const autoSubmittedRetake = {
      ...createAttempt(0, 2, "2026-08-02T00:00:00.000Z"),
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      grading: createQuestionGrading({ partOneCorrect: [1] }),
    };
    const activeAttempt = {
      ...createAttempt(0, 3, "2026-08-03T00:00:00.000Z"),
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      grading: createQuestionGrading({ partOneCorrect: [0, 1] }),
    };

    expect(
      calculateTopicStatistics(
        questionTopicIds,
        [submittedAttempt, autoSubmittedRetake, activeAttempt],
        [
          { id: "broad-topic", name: "Broad" },
          { id: "shared-topic", name: "Shared" },
        ],
      ),
    ).toEqual([
      {
        topicId: "broad-topic",
        topicName: "Broad",
        taggedQuestionCount: 2,
        observationCount: 4,
        averagePerformancePercent: 50,
      },
      {
        topicId: "shared-topic",
        topicName: "Shared",
        taggedQuestionCount: 1,
        observationCount: 2,
        averagePerformancePercent: 50,
      },
    ]);
  });

  it("returns assigned topics with null performance when no attempt is complete", () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = ["topic-b", "topic-a"];

    expect(
      calculateTopicStatistics(
        questionTopicIds,
        [],
        [
          { id: "topic-b", name: "Beta" },
          { id: "topic-a", name: "Alpha" },
        ],
      ),
    ).toEqual([
      {
        topicId: "topic-a",
        topicName: "Alpha",
        taggedQuestionCount: 1,
        observationCount: 0,
        averagePerformancePercent: null,
      },
      {
        topicId: "topic-b",
        topicName: "Beta",
        taggedQuestionCount: 1,
        observationCount: 0,
        averagePerformancePercent: null,
      },
    ]);
  });

  it("returns empty topic statistics for an Exam without assignments", () => {
    expect(
      calculateTopicStatistics(
        createEmptyQuestionTopicIds(),
        [createAttempt(0, 1, "2026-08-01T00:00:00.000Z")],
        [],
      ),
    ).toEqual([]);
  });

  it("normalizes ID-keyed dynamic Exam Topics by max score and fully credits each Topic", () => {
    const structure: ExamStructureSnapshot = {
      sections: [
        {
          id: "dynamic-section",
          title: "Dynamic section",
          questions: [
            {
              id: "unassigned-question",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScoreHundredths: 100,
            },
            {
              id: "weighted-question",
              type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              maxScoreHundredths: 200,
            },
          ],
        },
      ],
    };
    const attempt = createDynamicAttempt(1, {
      "weighted-question": {
        correctStatementCount: 3,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: false },
      },
      "unassigned-question": { isCorrect: true, scoreHundredths: 100 },
    });

    expect(
      calculateTopicStatistics(
        {
          questionTopicIds: createEmptyQuestionTopicIds(),
          questionTopics: [
            {
              questionId: "weighted-question",
              topicIds: ["topic-b", "topic-a"],
            },
          ],
          structureSnapshot: structure,
        },
        [attempt],
        [
          { id: "topic-b", name: "Beta" },
          { id: "topic-a", name: "Alpha" },
        ],
      ),
    ).toEqual([
      {
        topicId: "topic-a",
        topicName: "Alpha",
        taggedQuestionCount: 1,
        observationCount: 1,
        averagePerformancePercent: 50,
      },
      {
        topicId: "topic-b",
        topicName: "Beta",
        taggedQuestionCount: 1,
        observationCount: 1,
        averagePerformancePercent: 50,
      },
    ]);
  });

  it("keeps pending ESSAY_IMAGE Topics unobserved in Exam and Student analytics", () => {
    const pendingAttempt = createPendingDynamicAttempt(1, {
      "choice-question": { isCorrect: true, scoreHundredths: 100 },
      "short-question": { isCorrect: false, scoreHundredths: 0 },
      "true-false-question": {
        correctStatementCount: 3,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: false },
      },
    });
    const pendingTopics = [
      { questionId: "essay-question", topicIds: ["shared", "essay-only"] },
      { questionId: "choice-question", topicIds: ["shared"] },
      { questionId: "short-question", topicIds: ["objective"] },
      { questionId: "true-false-question", topicIds: ["objective"] },
    ];
    const topics = [
      { id: "shared", name: "Shared" },
      { id: "objective", name: "Objective" },
      { id: "essay-only", name: "Essay only" },
    ];

    expect(
      calculateTopicStatistics(
        {
          questionTopicIds: createEmptyQuestionTopicIds(),
          questionTopics: pendingTopics,
          structureSnapshot: pendingEssayStructure,
        },
        [pendingAttempt],
        topics,
      ),
    ).toEqual([
      {
        topicId: "objective",
        topicName: "Objective",
        taggedQuestionCount: 2,
        observationCount: 2,
        averagePerformancePercent: 25,
      },
      {
        topicId: "shared",
        topicName: "Shared",
        taggedQuestionCount: 2,
        observationCount: 1,
        averagePerformancePercent: 100,
      },
      {
        topicId: "essay-only",
        topicName: "Essay only",
        taggedQuestionCount: 1,
        observationCount: 0,
        averagePerformancePercent: null,
      },
    ]);

    const legacyTopicIds = createEmptyQuestionTopicIds();
    legacyTopicIds.partOne[0] = ["shared"];
    expect(
      calculateStudentTopicStatistics(
        [
          {
            questionTopicIds: legacyTopicIds,
            attempts: [
              {
                ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
                grading: createQuestionGrading({ partOneCorrect: [0] }),
              },
            ],
          },
          {
            questionTopicIds: createEmptyQuestionTopicIds(),
            questionTopics: pendingTopics,
            structureSnapshot: pendingEssayStructure,
            attempts: [pendingAttempt],
          },
        ],
        topics,
      ),
    ).toEqual([
      {
        topicId: "objective",
        topicName: "Objective",
        observationCount: 2,
        averagePerformancePercent: 25,
      },
      {
        topicId: "shared",
        topicName: "Shared",
        observationCount: 2,
        averagePerformancePercent: 100,
      },
    ]);
  });

  it("merges student topic observations across Exams with shared normalization", () => {
    const firstExamTopicIds = createEmptyQuestionTopicIds();
    firstExamTopicIds.partOne[0] = ["shared-topic"];
    firstExamTopicIds.partTwo[0] = ["shared-topic", "second-topic"];
    const secondExamTopicIds = createEmptyQuestionTopicIds();
    secondExamTopicIds.partThree[0] = ["shared-topic"];
    secondExamTopicIds.partThree[1] = ["shared-topic"];
    const submittedAttempt = {
      ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
      grading: createQuestionGrading({
        partOneCorrect: [0],
        partTwo: [
          {
            correctStatementCount: 2,
            scoreHundredths: 25,
            statements: { a: true, b: true, c: false, d: false },
          },
        ],
      }),
    };
    const autoSubmittedRetake = {
      ...createAttempt(0, 2, "2026-08-02T00:00:00.000Z"),
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      grading: createQuestionGrading({
        partTwo: [
          {
            correctStatementCount: 3,
            scoreHundredths: 50,
            statements: { a: true, b: true, c: true, d: false },
          },
        ],
      }),
    };
    const activeAttempt = {
      ...createAttempt(0, 3, "2026-08-03T00:00:00.000Z"),
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      grading: createQuestionGrading({
        partOneCorrect: [0],
        partTwo: [
          {
            correctStatementCount: 4,
            scoreHundredths: 100,
            statements: { a: true, b: true, c: true, d: true },
          },
        ],
      }),
    };
    const otherExamAttempt = {
      ...createAttempt(0, 1, "2026-08-04T00:00:00.000Z"),
      grading: createQuestionGrading({ partThreeCorrect: [0] }),
    };

    const statistics = calculateStudentTopicStatistics(
      [
        {
          questionTopicIds: firstExamTopicIds,
          attempts: [submittedAttempt, autoSubmittedRetake, activeAttempt],
        },
        {
          questionTopicIds: secondExamTopicIds,
          attempts: [otherExamAttempt],
        },
      ],
      [
        { id: "second-topic", name: "Second" },
        { id: "shared-topic", name: "Shared" },
      ],
    );

    expect(statistics).toHaveLength(2);
    expect(statistics[0]).toMatchObject({
      topicId: "shared-topic",
      topicName: "Shared",
      observationCount: 6,
    });
    expect(statistics[0].averagePerformancePercent).toBeCloseTo(275 / 6);
    expect(statistics[1]).toEqual({
      topicId: "second-topic",
      topicName: "Second",
      observationCount: 2,
      averagePerformancePercent: 37.5,
    });
  });

  it("returns no student topic row without a completed tagged observation", () => {
    const untaggedExamTopicIds = createEmptyQuestionTopicIds();
    const activeExamTopicIds = createEmptyQuestionTopicIds();
    activeExamTopicIds.partOne[0] = ["unused-topic"];
    const activeAttempt = {
      ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      grading: createQuestionGrading({ partOneCorrect: [0] }),
    };

    expect(
      calculateStudentTopicStatistics(
        [
          {
            questionTopicIds: untaggedExamTopicIds,
            attempts: [
              {
                ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
                grading: createQuestionGrading(),
              },
            ],
          },
          {
            questionTopicIds: activeExamTopicIds,
            attempts: [activeAttempt],
          },
        ],
        [{ id: "unused-topic", name: "Unused" }],
      ),
    ).toEqual([]);
    expect(calculateStudentTopicStatistics([], [])).toEqual([]);
  });

  it("merges one legacy and one dynamic Exam into the same Student Topic ID", () => {
    const legacyTopicIds = createEmptyQuestionTopicIds();
    legacyTopicIds.partOne[0] = ["shared-topic"];
    const dynamicStructure: ExamStructureSnapshot = {
      sections: [
        {
          id: "dynamic-section",
          title: "Dynamic section",
          questions: [
            {
              id: "dynamic-shared-question",
              type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              maxScoreHundredths: 200,
            },
          ],
        },
      ],
    };
    const dynamicAttempt = createDynamicAttempt(1, {
      "dynamic-shared-question": {
        correctStatementCount: 3,
        scoreHundredths: 100,
        statements: { a: true, b: true, c: true, d: false },
      },
    });

    expect(
      calculateStudentTopicStatistics(
        [
          {
            questionTopicIds: legacyTopicIds,
            attempts: [
              {
                ...createAttempt(0, 1, "2026-08-01T00:00:00.000Z"),
                grading: createQuestionGrading({ partOneCorrect: [0] }),
              },
            ],
          },
          {
            questionTopicIds: createEmptyQuestionTopicIds(),
            questionTopics: [
              {
                questionId: "dynamic-shared-question",
                topicIds: ["shared-topic"],
              },
            ],
            structureSnapshot: dynamicStructure,
            attempts: [dynamicAttempt],
          },
        ],
        [{ id: "shared-topic", name: "Shared" }],
      ),
    ).toEqual([
      {
        topicId: "shared-topic",
        topicName: "Shared",
        observationCount: 2,
        averagePerformancePercent: 75,
      },
    ]);
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
