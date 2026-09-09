import "server-only";

import { Schema } from "mongoose";

import {
  EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
  EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
  EXAM_STRUCTURE_MAX_SECTIONS,
  EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS,
  EXAM_STRUCTURE_QUESTION_TYPE,
  EXAM_STRUCTURE_QUESTION_TYPES,
  EXAM_STRUCTURE_SECTION_TITLE_MAX_LENGTH,
  EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
} from "@/lib/constants/exam-structure-template";
import {
  getExamStructureQuestionCount,
  getExamStructureTotalScoreHundredths,
} from "@/lib/exam/structure";
import type {
  ExamStructureQuestion,
  ExamStructureSection,
  ExamStructureSnapshot,
} from "@/types/exam-structure-template";

const examStructureQuestionSchema = new Schema<ExamStructureQuestion>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      maxlength: EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
    },
    type: {
      type: String,
      enum: EXAM_STRUCTURE_QUESTION_TYPES,
      required: true,
    },
    maxScoreHundredths: {
      type: Number,
      required: true,
      min: 1,
      max: EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
      validate: {
        validator: Number.isInteger,
        message: "Question maximum score must be an integer.",
      },
    },
  },
  { _id: false },
);

const examStructureSectionSchema = new Schema<ExamStructureSection>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      maxlength: EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: EXAM_STRUCTURE_SECTION_TITLE_MAX_LENGTH,
    },
    questions: {
      type: [examStructureQuestionSchema],
      required: true,
      validate: {
        validator: (questions: ExamStructureQuestion[]) =>
          questions.length >= 1 &&
          questions.length <= EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
        message: "Each Exam structure section must contain 1 to 100 questions.",
      },
    },
  },
  { _id: false },
);

function hasUniqueStructureIds(sections: ExamStructureSection[]): boolean {
  const sectionIds = sections.map((section) => section.id);
  const questionIds = sections.flatMap((section) =>
    section.questions.map((question) => question.id),
  );

  return (
    new Set(sectionIds).size === sectionIds.length &&
    new Set(questionIds).size === questionIds.length
  );
}

export function createExamStructureSectionsPathDefinition() {
  return {
    type: [examStructureSectionSchema],
    required: true,
    validate: [
      {
        validator: (sections: ExamStructureSection[]) =>
          sections.length >= 1 &&
          sections.length <= EXAM_STRUCTURE_MAX_SECTIONS,
        message: "An Exam structure must contain 1 to 20 sections.",
      },
      {
        validator: (sections: ExamStructureSection[]) =>
          getExamStructureQuestionCount({ sections }) <=
          EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS,
        message: "An Exam structure cannot exceed 200 questions.",
      },
      {
        validator: hasUniqueStructureIds,
        message:
          "Section and question IDs must be unique within the structure.",
      },
      {
        validator: (sections: ExamStructureSection[]) =>
          sections.every((section) =>
            section.questions.every(
              (question) =>
                question.type !== EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE ||
                question.maxScoreHundredths % 20 === 0,
            ),
          ),
        message:
          "True/false question maximum scores must be divisible by 20 hundredths.",
      },
      {
        validator: (sections: ExamStructureSection[]) =>
          getExamStructureTotalScoreHundredths({ sections }) ===
          EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
        message: "An Exam structure must total exactly 1000 hundredths.",
      },
    ],
  };
}

export const examStructureSnapshotMongooseSchema =
  new Schema<ExamStructureSnapshot>(
    { sections: createExamStructureSectionsPathDefinition() },
    { _id: false },
  );
