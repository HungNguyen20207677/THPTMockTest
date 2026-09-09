import { z } from "zod";

import {
  EXAM_STRUCTURE_QUESTION_TYPE,
  EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
  EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
  EXAM_STRUCTURE_MAX_SECTIONS,
  EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS,
  EXAM_STRUCTURE_QUESTION_TYPES,
  EXAM_STRUCTURE_SECTION_TITLE_MAX_LENGTH,
  EXAM_STRUCTURE_TEMPLATE_NAME_MAX_LENGTH,
  EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
} from "@/lib/constants/exam-structure-template";
import {
  getExamStructureQuestionCount,
  getExamStructureTotalScoreHundredths,
} from "@/lib/exam/structure";
import type { ExamStructureSection } from "@/types/exam-structure-template";

export const examStructureTemplateIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã mẫu cấu trúc không hợp lệ.")
  .transform((templateId) => templateId.toLowerCase());

const structureItemIdSchema = z
  .string()
  .trim()
  .min(1, "Mã cấu trúc không được để trống.")
  .max(
    EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
    `Mã cấu trúc không được vượt quá ${EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH} ký tự.`,
  );

const templateNameSchema = z
  .string()
  .trim()
  .min(1, "Tên mẫu cấu trúc là bắt buộc.")
  .max(
    EXAM_STRUCTURE_TEMPLATE_NAME_MAX_LENGTH,
    `Tên mẫu không được vượt quá ${EXAM_STRUCTURE_TEMPLATE_NAME_MAX_LENGTH} ký tự.`,
  );

const sectionTitleSchema = z
  .string()
  .trim()
  .min(1, "Tên phần là bắt buộc.")
  .max(
    EXAM_STRUCTURE_SECTION_TITLE_MAX_LENGTH,
    `Tên phần không được vượt quá ${EXAM_STRUCTURE_SECTION_TITLE_MAX_LENGTH} ký tự.`,
  );

export const examStructureQuestionTypeSchema = z.enum(
  EXAM_STRUCTURE_QUESTION_TYPES,
  { error: "Loại câu hỏi không được hỗ trợ." },
);

export const examStructureQuestionSchema = z.strictObject({
  id: structureItemIdSchema,
  type: examStructureQuestionTypeSchema,
  maxScoreHundredths: z
    .number("Điểm tối đa phải là một số nguyên.")
    .int("Điểm tối đa phải là một số nguyên.")
    .positive("Điểm tối đa phải lớn hơn 0.")
    .max(
      EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
      "Điểm tối đa của một câu không được vượt quá 10,00 điểm.",
    ),
});

export const examStructureSectionSchema = z.strictObject({
  id: structureItemIdSchema,
  title: sectionTitleSchema,
  questions: z
    .array(examStructureQuestionSchema)
    .min(1, "Mỗi phần phải có ít nhất 1 câu hỏi.")
    .max(
      EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
      `Mỗi phần không được vượt quá ${EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION} câu hỏi.`,
    ),
});

const sectionsSchema = z
  .array(examStructureSectionSchema)
  .min(1, "Mẫu cấu trúc phải có ít nhất 1 phần.")
  .max(
    EXAM_STRUCTURE_MAX_SECTIONS,
    `Mẫu cấu trúc không được vượt quá ${EXAM_STRUCTURE_MAX_SECTIONS} phần.`,
  );

function validateExamStructure(
  structure: { sections: ExamStructureSection[] },
  context: z.RefinementCtx,
): void {
  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();

  structure.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) {
      context.addIssue({
        code: "custom",
        message: "Mã phần phải là duy nhất trong mẫu cấu trúc.",
        path: ["sections", sectionIndex, "id"],
      });
    }
    sectionIds.add(section.id);

    section.questions.forEach((question, questionIndex) => {
      if (questionIds.has(question.id)) {
        context.addIssue({
          code: "custom",
          message: "Mã câu hỏi phải là duy nhất trong mẫu cấu trúc.",
          path: ["sections", sectionIndex, "questions", questionIndex, "id"],
        });
      }
      questionIds.add(question.id);

      if (
        question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE &&
        question.maxScoreHundredths % 20 !== 0
      ) {
        context.addIssue({
          code: "custom",
          message: "Điểm tối đa của câu Đúng/Sai phải chia hết cho 0,20 điểm.",
          path: [
            "sections",
            sectionIndex,
            "questions",
            questionIndex,
            "maxScoreHundredths",
          ],
        });
      }
    });
  });

  if (
    getExamStructureQuestionCount(structure) >
    EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS
  ) {
    context.addIssue({
      code: "custom",
      message: `Mẫu cấu trúc không được vượt quá ${EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS} câu hỏi.`,
      path: ["sections"],
    });
  }

  if (
    getExamStructureTotalScoreHundredths(structure) !==
    EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS
  ) {
    context.addIssue({
      code: "custom",
      message: "Tổng điểm của mẫu cấu trúc phải bằng đúng 10,00 điểm.",
      path: ["sections"],
    });
  }
}

export const examStructureSnapshotSchema = z
  .strictObject({ sections: sectionsSchema })
  .superRefine(validateExamStructure);

export const upsertExamStructureTemplateSchema = z
  .strictObject({
    name: templateNameSchema,
    sections: sectionsSchema,
  })
  .superRefine(validateExamStructure);

export const updateExamStructureTemplateSchema = z
  .strictObject({
    name: templateNameSchema,
    sections: sectionsSchema,
    expectedUpdatedAt: z.string().datetime(),
  })
  .superRefine(validateExamStructure);

export const deleteExamStructureTemplateSchema = z.strictObject({
  expectedUpdatedAt: z.string().datetime(),
});

export function parseExamStructureScorePointsToHundredths(
  value: string,
): number | null {
  const normalizedValue = value.trim().replace(",", ".");
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(normalizedValue);

  if (!match) {
    return null;
  }

  const wholePoints = Number(match[1]);
  const fractionalHundredths = Number((match[2] ?? "").padEnd(2, "0"));
  const scoreHundredths = wholePoints * 100 + fractionalHundredths;

  return Number.isSafeInteger(scoreHundredths) ? scoreHundredths : null;
}

const editorScoreSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập điểm tối đa.")
  .transform((value, context) => {
    const maxScoreHundredths = parseExamStructureScorePointsToHundredths(value);

    if (maxScoreHundredths === null) {
      context.addIssue({
        code: "custom",
        message: "Điểm phải là số có tối đa 2 chữ số thập phân.",
      });
      return z.NEVER;
    }

    if (
      maxScoreHundredths <= 0 ||
      maxScoreHundredths > EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS
    ) {
      context.addIssue({
        code: "custom",
        message: "Điểm phải lớn hơn 0 và không vượt quá 10,00.",
      });
      return z.NEVER;
    }

    return maxScoreHundredths;
  });

const editorQuestionSchema = z
  .strictObject({
    id: structureItemIdSchema,
    type: examStructureQuestionTypeSchema,
    maxScore: editorScoreSchema,
  })
  .transform(({ maxScore, ...question }) => ({
    ...question,
    maxScoreHundredths: maxScore,
  }));

const editorSectionSchema = z.strictObject({
  id: structureItemIdSchema,
  title: sectionTitleSchema,
  questions: z
    .array(editorQuestionSchema)
    .min(1, "Mỗi phần phải có ít nhất 1 câu hỏi.")
    .max(
      EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
      `Mỗi phần không được vượt quá ${EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION} câu hỏi.`,
    ),
});

export const examStructureTemplateEditorSchema = z
  .strictObject({
    name: templateNameSchema,
    sections: z
      .array(editorSectionSchema)
      .min(1, "Mẫu cấu trúc phải có ít nhất 1 phần.")
      .max(
        EXAM_STRUCTURE_MAX_SECTIONS,
        `Mẫu cấu trúc không được vượt quá ${EXAM_STRUCTURE_MAX_SECTIONS} phần.`,
      ),
  })
  .superRefine(validateExamStructure);

export type UpsertExamStructureTemplateInput = z.output<
  typeof upsertExamStructureTemplateSchema
>;
export type UpdateExamStructureTemplateInput = z.output<
  typeof updateExamStructureTemplateSchema
>;
export type DeleteExamStructureTemplateInput = z.output<
  typeof deleteExamStructureTemplateSchema
>;
export type ExamStructureTemplateEditorInput = z.input<
  typeof examStructureTemplateEditorSchema
>;
export type ExamStructureTemplateEditorOutput = z.output<
  typeof examStructureTemplateEditorSchema
>;
export type ValidExamStructureSnapshot = z.output<
  typeof examStructureSnapshotSchema
>;
