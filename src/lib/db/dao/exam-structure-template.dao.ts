import "server-only";

import type { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { ExamStructureTemplateModel } from "@/lib/db/models/exam-structure-template.model";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { createBuiltInThptExamStructureTemplateData } from "@/lib/exam/structure";
import type { ExamStructureSection } from "@/types/exam-structure-template";

export interface ExamStructureTemplatePersistenceRecord {
  id: string;
  name: string;
  isBuiltIn: boolean;
  sections: ExamStructureSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveExamStructureTemplateRecordInput {
  name: string;
  sections: ExamStructureSection[];
}

interface ExamStructureTemplateDocumentData {
  _id: Types.ObjectId;
  name: string;
  isBuiltIn: boolean;
  sections: ExamStructureSection[];
  createdAt: Date;
  updatedAt: Date;
}

let templateIndexesPromise: Promise<void> | null = null;

async function prepareExamStructureTemplateModel(): Promise<void> {
  await connectToDatabase();

  if (!templateIndexesPromise) {
    templateIndexesPromise = ExamStructureTemplateModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        templateIndexesPromise = null;
        throw error;
      });
  }

  await templateIndexesPromise;
}

function toExamStructureTemplateRecord(
  template: ExamStructureTemplateDocumentData,
): ExamStructureTemplatePersistenceRecord {
  return {
    id: template._id.toString(),
    name: template.name,
    isBuiltIn: template.isBuiltIn,
    sections: template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      questions: section.questions.map((question) => ({ ...question })),
    })),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function ensureBuiltInAfterModelPreparation(): Promise<ExamStructureTemplatePersistenceRecord> {
  const now = new Date();
  let template: ExamStructureTemplateDocumentData | null = null;

  try {
    template = await ExamStructureTemplateModel.findOneAndUpdate(
      { isBuiltIn: true },
      {
        $setOnInsert: {
          ...createBuiltInThptExamStructureTemplateData(),
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
        timestamps: false,
      },
    )
      .lean<ExamStructureTemplateDocumentData>()
      .exec();
  } catch (error) {
    if (!isMongoDuplicateKeyError(error)) {
      throw error;
    }

    template = await ExamStructureTemplateModel.findOne({ isBuiltIn: true })
      .lean<ExamStructureTemplateDocumentData>()
      .exec();
  }

  if (!template) {
    throw new Error(
      "Could not initialize the built-in Exam structure template.",
    );
  }

  return toExamStructureTemplateRecord(template);
}

async function prepareExamStructureTemplateCollection(): Promise<void> {
  await prepareExamStructureTemplateModel();
  await ensureBuiltInAfterModelPreparation();
}

export async function ensureBuiltInExamStructureTemplateRecord(): Promise<ExamStructureTemplatePersistenceRecord> {
  await prepareExamStructureTemplateModel();
  return ensureBuiltInAfterModelPreparation();
}

export async function listExamStructureTemplateRecords(): Promise<
  ExamStructureTemplatePersistenceRecord[]
> {
  await prepareExamStructureTemplateCollection();
  const templates = await ExamStructureTemplateModel.find()
    .sort({ isBuiltIn: -1, createdAt: -1, _id: -1 })
    .lean<ExamStructureTemplateDocumentData[]>()
    .exec();

  return templates.map(toExamStructureTemplateRecord);
}

export async function findExamStructureTemplateRecordById(
  templateId: string,
): Promise<ExamStructureTemplatePersistenceRecord | null> {
  await prepareExamStructureTemplateCollection();
  const template = await ExamStructureTemplateModel.findById(templateId)
    .lean<ExamStructureTemplateDocumentData>()
    .exec();

  return template ? toExamStructureTemplateRecord(template) : null;
}

export async function createExamStructureTemplateRecord(
  input: SaveExamStructureTemplateRecordInput,
): Promise<ExamStructureTemplatePersistenceRecord> {
  await prepareExamStructureTemplateCollection();
  const template = await ExamStructureTemplateModel.create({
    ...input,
    isBuiltIn: false,
  });

  return toExamStructureTemplateRecord(
    template.toObject() as ExamStructureTemplateDocumentData,
  );
}

export async function updateExamStructureTemplateRecord(
  templateId: string,
  input: SaveExamStructureTemplateRecordInput,
  expectedUpdatedAt: Date,
): Promise<ExamStructureTemplatePersistenceRecord | null> {
  await prepareExamStructureTemplateCollection();
  const template = await ExamStructureTemplateModel.findOneAndUpdate(
    {
      _id: templateId,
      isBuiltIn: false,
      updatedAt: expectedUpdatedAt,
    },
    { $set: input },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamStructureTemplateDocumentData>()
    .exec();

  return template ? toExamStructureTemplateRecord(template) : null;
}

export async function deleteExamStructureTemplateRecord(
  templateId: string,
  expectedUpdatedAt: Date,
): Promise<ExamStructureTemplatePersistenceRecord | null> {
  await prepareExamStructureTemplateCollection();
  const template = await ExamStructureTemplateModel.findOneAndDelete({
    _id: templateId,
    isBuiltIn: false,
    updatedAt: expectedUpdatedAt,
  })
    .lean<ExamStructureTemplateDocumentData>()
    .exec();

  return template ? toExamStructureTemplateRecord(template) : null;
}
