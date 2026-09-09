import { z } from "zod";

import { EXAM_STRUCTURE, PART_ONE_CHOICES } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { shortAnswerSlotsSchema } from "@/lib/validations/exam";
import type {
  AttemptAnswers,
  DynamicAttemptAnswers,
  ExamAttemptAnswers,
} from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

const attemptPartTwoAnswerSchema = z.strictObject({
  a: z.boolean().nullable(),
  b: z.boolean().nullable(),
  c: z.boolean().nullable(),
  d: z.boolean().nullable(),
});

export const attemptAnswersSchema: z.ZodType<AttemptAnswers> = z.strictObject({
  partOne: z
    .array(z.enum(PART_ONE_CHOICES).nullable())
    .length(EXAM_STRUCTURE.partOneQuestions),
  partTwo: z
    .array(attemptPartTwoAnswerSchema)
    .length(EXAM_STRUCTURE.partTwoQuestions),
  partThree: z
    .array(shortAnswerSlotsSchema)
    .length(EXAM_STRUCTURE.partThreeQuestions),
});

export const dynamicAttemptAnswersSchema: z.ZodType<DynamicAttemptAnswers> =
  z.strictObject({
    answersByQuestionId: z.record(
      z.string(),
      z.union([
        z.enum(PART_ONE_CHOICES).nullable(),
        attemptPartTwoAnswerSchema,
        shortAnswerSlotsSchema,
      ]),
    ),
  });

export const examAttemptAnswersSchema: z.ZodType<ExamAttemptAnswers> = z.union([
  attemptAnswersSchema,
  dynamicAttemptAnswersSchema,
]);

export function isDynamicAttemptAnswers(
  answers: ExamAttemptAnswers,
): answers is DynamicAttemptAnswers {
  return "answersByQuestionId" in answers;
}

export function createAttemptAnswersSchemaForStructure(
  structure?: ExamStructureSnapshot,
) {
  if (!structure) {
    return attemptAnswersSchema;
  }

  return dynamicAttemptAnswersSchema.superRefine((answers, context) => {
    const questions = structure.sections.flatMap(
      (section) => section.questions,
    );
    const expectedQuestionIds = new Set(
      questions.map((question) => question.id),
    );

    for (const questionId of Object.keys(answers.answersByQuestionId)) {
      if (!expectedQuestionIds.has(questionId)) {
        context.addIssue({
          code: "custom",
          message: "Câu trả lời không thuộc cấu trúc đề thi.",
          path: ["answersByQuestionId", questionId],
        });
      }
    }

    for (const question of questions) {
      if (!(question.id in answers.answersByQuestionId)) {
        context.addIssue({
          code: "custom",
          message: "Thiếu trạng thái trả lời của câu hỏi.",
          path: ["answersByQuestionId", question.id],
        });
        continue;
      }

      const answer = answers.answersByQuestionId[question.id];
      const schema =
        question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE
          ? z.enum(PART_ONE_CHOICES).nullable()
          : question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE
            ? attemptPartTwoAnswerSchema
            : question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER
              ? shortAnswerSlotsSchema
              : null;

      if (!schema || !schema.safeParse(answer).success) {
        context.addIssue({
          code: "custom",
          message: "Câu trả lời không đúng định dạng của loại câu hỏi.",
          path: ["answersByQuestionId", question.id],
        });
      }
    }
  });
}

export const attemptAnswersRequestSchema = z.strictObject({
  answers: examAttemptAnswersSchema,
});

export type AttemptAnswersRequest = z.infer<typeof attemptAnswersRequestSchema>;
