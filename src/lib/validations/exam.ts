import { z } from "zod";

import {
  EXAM_STATUSES,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  EXAM_VISIBILITY_MODES,
  PART3_INPUT_MODE,
  PART3_INPUT_MODES,
  PART_ONE_CHOICES,
  PART_TWO_STATEMENTS,
  SHORT_ANSWER_SLOT_OPTIONS,
} from "@/lib/constants/exam";
import {
  isValidCanonicalShortAnswer,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import { examPdfUploadReferenceSchema } from "@/lib/validations/exam-pdf";
import { studentIdSchema } from "@/lib/validations/user";
import type { PartOneAnswer, PartTwoAnswer } from "@/types/exam";

export const examStatusSchema = z.enum(EXAM_STATUSES);
export const examVisibilityModeSchema = z.enum(EXAM_VISIBILITY_MODES);
export const part3InputModeSchema = z
  .enum(PART3_INPUT_MODES)
  .default(PART3_INPUT_MODE.BUBBLE);
export const partOneAnswerSchema = z.enum(PART_ONE_CHOICES);

export const partTwoAnswerSchema = z.strictObject({
  a: z.boolean(),
  b: z.boolean(),
  c: z.boolean(),
  d: z.boolean(),
});

export const canonicalShortAnswerSchema = z
  .string()
  .refine(isValidCanonicalShortAnswer, "Đáp án ngắn không hợp lệ.");

export const examAnswerKeySchema = z.strictObject({
  partOne: z
    .array(partOneAnswerSchema)
    .length(
      EXAM_STRUCTURE.partOneQuestions,
      `Phần I phải có đúng ${EXAM_STRUCTURE.partOneQuestions} đáp án.`,
    ),
  partTwo: z
    .array(partTwoAnswerSchema)
    .length(
      EXAM_STRUCTURE.partTwoQuestions,
      `Phần II phải có đúng ${EXAM_STRUCTURE.partTwoQuestions} câu.`,
    ),
  partThree: z
    .array(canonicalShortAnswerSchema)
    .length(
      EXAM_STRUCTURE.partThreeQuestions,
      `Phần III phải có đúng ${EXAM_STRUCTURE.partThreeQuestions} đáp án.`,
    ),
});

export const examSettingsSchema = z.strictObject({
  allowRetake: z.boolean(),
  showScoreAfterSubmission: z.boolean(),
  showAnswersAfterSubmission: z.boolean(),
});

const assignedStudentIdListSchema = z
  .array(studentIdSchema)
  .transform((studentIds) => [...new Set(studentIds)]);

const titleSchema = z
  .string()
  .trim()
  .min(3, "Tiêu đề phải có ít nhất 3 ký tự.")
  .max(150, "Tiêu đề không được vượt quá 150 ký tự.");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Mô tả không được vượt quá 2000 ký tự.")
  .optional()
  .transform((description) => description || undefined);

export const examPdfSchema = z.strictObject({
  publicId: z.string().trim().min(1),
  secureUrl: z.url().refine((url) => url.startsWith("https://")),
  originalFilename: z.string().trim().min(1).max(255),
});

const examBaseFields = {
  title: titleSchema,
  description: descriptionSchema,
  status: examStatusSchema,
  part3InputMode: part3InputModeSchema,
  settings: examSettingsSchema,
};

const examFields = {
  ...examBaseFields,
  visibilityMode: examVisibilityModeSchema,
  assignedStudentIds: assignedStudentIdListSchema,
};

type OptionalExamAssignment = {
  visibilityMode?: (typeof EXAM_VISIBILITY_MODES)[number];
  assignedStudentIds?: string[];
};

function validateExamAssignmentPair(
  exam: OptionalExamAssignment,
  context: z.RefinementCtx,
): void {
  if (
    (exam.visibilityMode === undefined) !==
    (exam.assignedStudentIds === undefined)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Phạm vi học sinh và danh sách phân công phải được gửi cùng nhau.",
      path: ["visibilityMode"],
    });
  }
}

function normalizeLegacyExamAssignment<TExam extends OptionalExamAssignment>(
  exam: TExam,
) {
  const visibilityMode =
    exam.visibilityMode ?? EXAM_VISIBILITY_MODE.ALL_STUDENTS;

  return {
    ...exam,
    visibilityMode,
    assignedStudentIds:
      visibilityMode === EXAM_VISIBILITY_MODE.ALL_STUDENTS
        ? []
        : (exam.assignedStudentIds ?? []),
  };
}

function normalizeExamAssignment<
  TExam extends {
    visibilityMode: (typeof EXAM_VISIBILITY_MODES)[number];
    assignedStudentIds: string[];
  },
>(exam: TExam): TExam {
  return exam.visibilityMode === EXAM_VISIBILITY_MODE.ALL_STUDENTS
    ? { ...exam, assignedStudentIds: [] }
    : exam;
}

export const examUpsertSchema = z
  .strictObject({
    ...examBaseFields,
    visibilityMode: examVisibilityModeSchema.optional(),
    assignedStudentIds: assignedStudentIdListSchema.optional(),
    answerKey: examAnswerKeySchema,
  })
  .superRefine(validateExamAssignmentPair)
  .transform(normalizeLegacyExamAssignment);

export const createExamRequestSchema = z.strictObject({
  exam: examUpsertSchema,
  pdfUpload: examPdfUploadReferenceSchema,
});

export const updateExamSchema = z
  .strictObject({
    ...examBaseFields,
    visibilityMode: examVisibilityModeSchema.optional(),
    assignedStudentIds: assignedStudentIdListSchema.optional(),
    answerKey: examAnswerKeySchema,
    expectedUpdatedAt: z.string().datetime(),
  })
  .superRefine(validateExamAssignmentPair)
  .transform((exam) =>
    exam.visibilityMode === EXAM_VISIBILITY_MODE.ALL_STUDENTS
      ? { ...exam, assignedStudentIds: [] }
      : exam,
  );

export const updateExamRequestSchema = z.strictObject({
  exam: updateExamSchema,
  replacementPdfUpload: examPdfUploadReferenceSchema.optional(),
  confirmAnswerKeyCorrection: z.literal(true).optional(),
});

export const publishableExamSchema = z.strictObject({
  title: titleSchema,
  part3InputMode: part3InputModeSchema,
  pdf: examPdfSchema,
  answerKey: examAnswerKeySchema,
});

export const updateExamStatusSchema = z.strictObject({
  status: examStatusSchema,
  expectedUpdatedAt: z.string().datetime(),
});

export const deleteExamSchema = z.strictObject({
  expectedUpdatedAt: z.string().datetime(),
});

export const examIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã đề thi không hợp lệ.")
  .transform((examId) => examId.toLowerCase());

const editorPartOneAnswerSchema = z.union([partOneAnswerSchema, z.literal("")]);

const editorPartOneSchema = z
  .array(editorPartOneAnswerSchema)
  .length(EXAM_STRUCTURE.partOneQuestions)
  .superRefine((answers, context) => {
    answers.forEach((answer, index) => {
      if (answer === "") {
        context.addIssue({
          code: "custom",
          message: "Vui lòng chọn đáp án.",
          path: [index],
        });
      }
    });
  })
  .transform((answers) => answers as PartOneAnswer[]);

const editorPartTwoQuestionSchema = z
  .strictObject({
    a: z.boolean().nullable(),
    b: z.boolean().nullable(),
    c: z.boolean().nullable(),
    d: z.boolean().nullable(),
  })
  .superRefine((answer, context) => {
    PART_TWO_STATEMENTS.forEach((statement) => {
      if (answer[statement] === null) {
        context.addIssue({
          code: "custom",
          message: "Vui lòng chọn Đúng hoặc Sai.",
          path: [statement],
        });
      }
    });
  })
  .transform(
    (answer) =>
      ({
        a: answer.a,
        b: answer.b,
        c: answer.c,
        d: answer.d,
      }) as PartTwoAnswer,
  );

const editorSlotSchema = z.enum(SHORT_ANSWER_SLOT_OPTIONS).nullable();
export const shortAnswerSlotsSchema = z.tuple([
  editorSlotSchema,
  editorSlotSchema,
  editorSlotSchema,
  editorSlotSchema,
]);

const editorPartThreeAnswerSchema = shortAnswerSlotsSchema.transform(
  (slots, context) => {
    const canonicalValue = shortAnswerSlotsToCanonicalValue(slots);

    if (!canonicalValue) {
      context.addIssue({
        code: "custom",
        message: "Đáp án ngắn không hợp lệ.",
      });
      return z.NEVER;
    }

    return canonicalValue;
  },
);

export const examEditorSchema = z
  .strictObject({
    ...examFields,
    answerKey: z.strictObject({
      partOne: editorPartOneSchema,
      partTwo: z
        .array(editorPartTwoQuestionSchema)
        .length(EXAM_STRUCTURE.partTwoQuestions),
      partThree: z
        .array(editorPartThreeAnswerSchema)
        .length(EXAM_STRUCTURE.partThreeQuestions),
    }),
  })
  .transform(normalizeExamAssignment);

export type UpsertExamInput = z.output<typeof examUpsertSchema>;
export type UpdateExamInput = z.output<typeof updateExamSchema>;
export type ExamEditorInput = z.input<typeof examEditorSchema>;
export type ExamEditorOutput = z.output<typeof examEditorSchema>;
export type UpdateExamStatusInput = z.infer<typeof updateExamStatusSchema>;
export type DeleteExamInput = z.infer<typeof deleteExamSchema>;
