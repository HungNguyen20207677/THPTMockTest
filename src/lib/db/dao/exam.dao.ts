import "server-only";

import type { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { ExamModel } from "@/lib/db/models/exam.model";
import type {
  ExamAnswerKey,
  ExamPdf,
  ExamSettings,
  ExamStatus,
} from "@/types/exam";

export interface ExamPersistenceRecord {
  id: string;
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveExamRecordInput {
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
}

interface ExamDocumentData {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

let examIndexesPromise: Promise<void> | null = null;

async function prepareExamModel(): Promise<void> {
  await connectToDatabase();

  if (!examIndexesPromise) {
    examIndexesPromise = ExamModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        examIndexesPromise = null;
        throw error;
      });
  }

  await examIndexesPromise;
}

function toExamRecord(exam: ExamDocumentData): ExamPersistenceRecord {
  return {
    id: exam._id.toString(),
    title: exam.title,
    description: exam.description,
    status: exam.status,
    pdf: exam.pdf,
    settings: exam.settings,
    answerKey: exam.answerKey,
    createdBy: exam.createdBy.toString(),
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  };
}

export async function listExamRecords(): Promise<ExamPersistenceRecord[]> {
  await prepareExamModel();

  const exams = await ExamModel.find()
    .sort({ createdAt: -1 })
    .lean<ExamDocumentData[]>()
    .exec();

  return exams.map(toExamRecord);
}

export async function findExamRecordById(
  examId: string,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findById(examId).lean<ExamDocumentData>().exec();

  return exam ? toExamRecord(exam) : null;
}

export async function createExamRecord(
  input: SaveExamRecordInput,
  createdBy: string,
): Promise<ExamPersistenceRecord> {
  await prepareExamModel();

  const exam = await ExamModel.create({ ...input, createdBy });
  return toExamRecord(exam.toObject() as ExamDocumentData);
}

export async function updateExamRecord(
  examId: string,
  input: SaveExamRecordInput,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const { description, ...requiredFields } = input;
  const update =
    description === undefined
      ? { $set: requiredFields, $unset: { description: 1 } }
      : { $set: input };

  const exam = await ExamModel.findOneAndUpdate(
    { _id: examId, updatedAt: expectedUpdatedAt },
    update,
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function updateExamRecordStatus(
  examId: string,
  status: ExamStatus,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOneAndUpdate(
    { _id: examId, updatedAt: expectedUpdatedAt },
    { $set: { status } },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function deleteExamRecord(
  examId: string,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOneAndDelete({
    _id: examId,
    updatedAt: expectedUpdatedAt,
  })
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}
