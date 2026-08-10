import "server-only";

import { randomUUID } from "node:crypto";

import type { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import {
  ExamModel,
  ExamPdfOperationLeaseModel,
} from "@/lib/db/models/exam.model";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
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
const EXAM_PDF_OPERATION_LEASE_DURATION_MS = 60 * 60 * 1000;

export interface ExamPdfOperationLease {
  publicId: string;
  token: string;
}

async function prepareExamModel(): Promise<void> {
  await connectToDatabase();

  if (!examIndexesPromise) {
    examIndexesPromise = Promise.all([
      ExamModel.init(),
      ExamPdfOperationLeaseModel.init(),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        examIndexesPromise = null;
        throw error;
      });
  }

  await examIndexesPromise;
}

export async function acquireExamPdfOperationLease(
  publicId: string,
): Promise<ExamPdfOperationLease | null> {
  await prepareExamModel();

  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + EXAM_PDF_OPERATION_LEASE_DURATION_MS,
  );
  const reclaimedLease = await ExamPdfOperationLeaseModel.findOneAndUpdate(
    { _id: publicId, expiresAt: { $lte: now } },
    { $set: { token, expiresAt } },
    { returnDocument: "after" },
  ).exec();

  if (reclaimedLease) {
    return { publicId, token };
  }

  try {
    await ExamPdfOperationLeaseModel.create({
      _id: publicId,
      token,
      expiresAt,
    });

    return { publicId, token };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return null;
    }

    throw error;
  }
}

export async function releaseExamPdfOperationLease(
  lease: ExamPdfOperationLease,
): Promise<void> {
  await prepareExamModel();
  await ExamPdfOperationLeaseModel.deleteOne({
    _id: lease.publicId,
    token: lease.token,
  }).exec();
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

export async function findExamRecordByPdfPublicId(
  publicId: string,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOne({ "pdf.publicId": publicId })
    .lean<ExamDocumentData>()
    .exec();

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
