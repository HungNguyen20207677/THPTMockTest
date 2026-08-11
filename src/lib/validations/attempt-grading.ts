import { z } from "zod";

import { EXAM_SCORING_HUNDREDTHS, EXAM_STRUCTURE } from "@/lib/constants/exam";
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

export const attemptGradingSnapshotSchema: z.ZodType<AttemptGradingSnapshot> =
  z.strictObject({
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
  });
