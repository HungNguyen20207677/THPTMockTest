import { z } from "zod";

import {
  EXAM_SCORING_HUNDREDTHS,
  EXAM_STRUCTURE,
  INITIAL_ANSWER_KEY_REVISION,
} from "@/lib/constants/exam";
import type { AttemptGradingSnapshot } from "@/types/exam-attempt";

const scoreHundredthsSchema = z
  .number()
  .int()
  .min(0)
  .max(EXAM_SCORING_HUNDREDTHS.totalMaximum);
const correctnessSchema = z.strictObject({ isCorrect: z.boolean() });
const statementCorrectnessSchema = z.strictObject({
  a: z.boolean(),
  b: z.boolean(),
  c: z.boolean(),
  d: z.boolean(),
});

export const attemptGradingSnapshotSchema: z.ZodType<AttemptGradingSnapshot> = z
  .strictObject({
    answerKeyRevision: z
      .number()
      .int()
      .min(INITIAL_ANSWER_KEY_REVISION)
      .default(INITIAL_ANSWER_KEY_REVISION),
    totalScoreHundredths: scoreHundredthsSchema,
    sectionScoresHundredths: z.strictObject({
      partOne: scoreHundredthsSchema.max(
        EXAM_SCORING_HUNDREDTHS.partOneMaximum,
      ),
      partTwo: scoreHundredthsSchema.max(
        EXAM_SCORING_HUNDREDTHS.partTwoMaximum,
      ),
      partThree: scoreHundredthsSchema.max(
        EXAM_SCORING_HUNDREDTHS.partThreeMaximum,
      ),
    }),
    partOne: z.array(correctnessSchema).length(EXAM_STRUCTURE.partOneQuestions),
    partTwo: z
      .array(
        z.strictObject({
          correctStatementCount: z
            .number()
            .int()
            .min(0)
            .max(EXAM_STRUCTURE.partTwoStatementsPerQuestion),
          scoreHundredths: scoreHundredthsSchema.max(100),
          statements: statementCorrectnessSchema,
        }),
      )
      .length(EXAM_STRUCTURE.partTwoQuestions),
    partThree: z
      .array(correctnessSchema)
      .length(EXAM_STRUCTURE.partThreeQuestions),
  })
  .superRefine((grading, context) => {
    const partOneScore =
      grading.partOne.filter((item) => item.isCorrect).length *
      EXAM_SCORING_HUNDREDTHS.partOnePointsPerAnswer;
    let partTwoScore = 0;

    grading.partTwo.forEach((item, questionIndex) => {
      const correctStatementCount = Object.values(item.statements).filter(
        Boolean,
      ).length;
      const expectedScore =
        EXAM_SCORING_HUNDREDTHS.partTwoPointsByCorrectStatements[
          correctStatementCount as 0 | 1 | 2 | 3 | 4
        ];

      if (
        item.correctStatementCount !== correctStatementCount ||
        item.scoreHundredths !== expectedScore
      ) {
        context.addIssue({
          code: "custom",
          path: ["partTwo", questionIndex],
          message: "Kết quả chấm Phần II không nhất quán.",
        });
      }

      partTwoScore += expectedScore;
    });

    const partThreeScore =
      grading.partThree.filter((item) => item.isCorrect).length *
      EXAM_SCORING_HUNDREDTHS.partThreePointsPerAnswer;
    const derivedSections = {
      partOne: partOneScore,
      partTwo: partTwoScore,
      partThree: partThreeScore,
    };

    for (const section of ["partOne", "partTwo", "partThree"] as const) {
      if (
        grading.sectionScoresHundredths[section] !== derivedSections[section]
      ) {
        context.addIssue({
          code: "custom",
          path: ["sectionScoresHundredths", section],
          message: "Điểm thành phần không khớp với kết quả từng câu.",
        });
      }
    }

    if (
      grading.totalScoreHundredths !==
      partOneScore + partTwoScore + partThreeScore
    ) {
      context.addIssue({
        code: "custom",
        path: ["totalScoreHundredths"],
        message: "Tổng điểm không khớp với điểm thành phần.",
      });
    }
  });
