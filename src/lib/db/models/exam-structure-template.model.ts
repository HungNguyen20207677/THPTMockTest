import "server-only";

import { model, models, Schema, type Model } from "mongoose";

import { EXAM_STRUCTURE_TEMPLATE_NAME_MAX_LENGTH } from "@/lib/constants/exam-structure-template";
import { createExamStructureSectionsPathDefinition } from "@/lib/db/schemas/exam-structure.schema";
import type { ExamStructureSection } from "@/types/exam-structure-template";

export interface ExamStructureTemplateRecord {
  name: string;
  isBuiltIn: boolean;
  sections: ExamStructureSection[];
  createdAt: Date;
  updatedAt: Date;
}

const examStructureTemplateSchema = new Schema<ExamStructureTemplateRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: EXAM_STRUCTURE_TEMPLATE_NAME_MAX_LENGTH,
    },
    isBuiltIn: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },
    sections: createExamStructureSectionsPathDefinition(),
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

examStructureTemplateSchema.index({ createdAt: -1 });
examStructureTemplateSchema.index(
  { isBuiltIn: 1 },
  {
    unique: true,
    partialFilterExpression: { isBuiltIn: true },
  },
);

export const ExamStructureTemplateModel =
  (models.ExamStructureTemplate as
    Model<ExamStructureTemplateRecord> | undefined) ??
  model<ExamStructureTemplateRecord>(
    "ExamStructureTemplate",
    examStructureTemplateSchema,
  );
